import { ContractTransactionReceipt, ethers as EthersT, JsonRpcProvider } from 'ethers';
import {
  DVATransferManager,
  DVATransferManager__factory,
  IDVATransferManager,
  Token,
  Token__factory,
} from './artifacts';
import { queryLogEventArgs, txWaitAndCatchError } from './utils';
import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider';
import { FheERC3643Error } from './errors';
import { TxOptions } from './types';

enum TransactionStatus {
  PENDING = 0,
  COMPLETED = 1,
  CANCELLED = 2,
  REJECTED = 3,
}

async function signTransfer(
  transferID: string,
  signer: EthersT.Signer,
): Promise<{
  v: number;
  r: string;
  s: string;
}> {
  if (!(signer.provider instanceof HardhatEthersProvider) && !(signer.provider instanceof EthersT.JsonRpcProvider)) {
    throw new FheERC3643Error('Invalid provider, unable to sign message');
  }
  const rawSignature = await signer.signMessage(EthersT.getBytes(transferID));
  const { v, r, s } = EthersT.Signature.from(rawSignature);
  return { v, r, s };
}

function signMessage(
  message: string | Uint8Array,
  address: string,
  provider: JsonRpcProvider | HardhatEthersProvider,
): Promise<string> {
  const resolvedMessage = typeof message === 'string' ? EthersT.toUtf8Bytes(message) : message;
  return provider.send('personal_sign', [EthersT.hexlify(resolvedMessage), address.toLowerCase()]);
}

export class DVATransferManagerAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): DVATransferManager {
    const contract = DVATransferManager__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async getName(dva: DVATransferManager, runner: EthersT.ContractRunner) {
    return await dva.connect(runner).name();
  }

  static async calculateTransferID(
    dva: DVATransferManager,
    nonce: bigint,
    sender: EthersT.AddressLike,
    recipient: EthersT.AddressLike,
    eamount: bigint,
    runner: EthersT.ContractRunner,
  ) {
    return await dva.connect(runner).calculateTransferID(nonce, sender, recipient, eamount);
  }

  static async throwIfKnownError(dva: DVATransferManager, error: any) {
    if (!(error instanceof Error)) {
      return;
    }

    if (!('data' in error)) {
      return;
    }

    if (typeof error.data !== 'string') {
      return;
    }

    if (!EthersT.isHexString(error.data)) {
      return;
    }

    const decodedError = dva.interface.parseError(error.data);
    if (!decodedError) {
      return;
    }

    if (decodedError.name === 'TokenIsNotRegistered') {
      throw new FheERC3643Error(
        `Token ${decodedError.args[0]} is not registered in the transfer manager. Set the approval criteria first.`,
      );
    }

    throw new FheERC3643Error(`Transfer manager error ${decodedError.name}`);
  }

  static async initiateTransfer(
    dva: DVATransferManager,
    token: Token,
    sender: EthersT.Signer,
    recipient: EthersT.AddressLike,
    eamount: Uint8Array,
    inputProof: Uint8Array,
    options: TxOptions,
  ) {
    // Check if approval criteria has been configured
    try {
      /* const criteria: IDVATransferManager.ApprovalCriteriaStructOutput = */
      await dva.connect(sender).getApprovalCriteria(token);
    } catch (e) {
      await DVATransferManagerAPI.throwIfKnownError(dva, e);
      throw e;
    }

    // recipient must have been verified. (perfomed earlier)
    const txReceipt = await txWaitAndCatchError(
      dva.connect(sender).initiateTransfer(await token.getAddress(), recipient, eamount, inputProof),
      options,
    );
    return txReceipt;
  }

  static async getTransfer(
    dva: DVATransferManager,
    transferID: string,
    runner: EthersT.ContractRunner,
    options: TxOptions,
  ) {
    const transferIDDetails = await dva.connect(runner).getTransfer(transferID);

    const { tokenAddress, sender, recipient, eamount, eactualAmount, status, approvers, approvalCriteriaHash } =
      transferIDDetails;

    return {
      tokenAddress,
      sender,
      recipient,
      eamount,
      eactualAmount,
      status,
      approvers: approvers.map(a => {
        return { wallet: a.wallet, anyTokenAgent: a.anyTokenAgent, approved: a.approved };
      }),
      approvalCriteriaHash,
      statusString: DVATransferManagerAPI.transferStatusToString(status),
    };
  }

  static async delegateApproveTransfer(
    dva: DVATransferManager,
    transferID: string,
    signatures: IDVATransferManager.SignatureStruct[],
    caller: EthersT.Signer,
    options: TxOptions,
  ) {
    if (signatures.length === 0) {
      throw new FheERC3643Error(`Signatures cannot be empty (transferID=${transferID})`);
    }

    const transferDetails: {
      tokenAddress: string;
      sender: string;
      recipient: string;
      eamount: bigint;
      eactualAmount: bigint;
      status: bigint;
      approvers: {
        wallet: string;
        anyTokenAgent: boolean;
        approved: boolean;
      }[];
      approvalCriteriaHash: string;
    } = await dva.connect(caller).getTransfer(transferID);

    if (transferDetails.tokenAddress === EthersT.ZeroAddress) {
      throw new FheERC3643Error(`Invalid transferID=${transferID}`);
    }
    if (transferDetails.status !== BigInt(TransactionStatus.PENDING)) {
      throw new FheERC3643Error(`Transfer is not in pending status (transferID=${transferID})`);
    }

    const txReceipt = await txWaitAndCatchError(
      dva.connect(caller).delegateApproveTransfer(transferID, signatures),
      options,
    );
    return txReceipt;
  }

  static async approveTransfer(
    dva: DVATransferManager,
    transferID: string,
    approver: EthersT.Signer,
    options: TxOptions,
  ) {
    const txReceipt = await txWaitAndCatchError(dva.connect(approver).approveTransfer(transferID), options);

    const args = queryLogEventArgs(txReceipt, 'TransferApproved', dva.interface);

    let _approver: { transferID: string; address: string } | undefined = undefined;

    if (args && args.length >= 2) {
      _approver = {
        transferID: args[0],
        address: args[1],
      };
    }

    const transferDetails = await DVATransferManagerAPI.getTransfer(dva, transferID, approver, options);
    const tokenTransfer = queryTokenTransferEvent(txReceipt);

    return {
      txReceipt,
      approver: _approver,
      transferID,
      transferDetails,
      tokenTransfer,
    };
  }

  static async cancelTransfer(dva: DVATransferManager, transferID: string, caller: EthersT.Signer, options: TxOptions) {
    const txReceipt = await txWaitAndCatchError(dva.connect(caller).cancelTransfer(transferID), options);
    return txReceipt;
  }

  static async rejectTransfer(dva: DVATransferManager, transferID: string, caller: EthersT.Signer, options: TxOptions) {
    const txReceipt = await txWaitAndCatchError(dva.connect(caller).rejectTransfer(transferID), options);
    return txReceipt;
  }

  static async getNextApprover(dva: DVATransferManager, transferID: string, runner: EthersT.ContractRunner) {
    const n: {
      nextApprover: string;
      anyTokenAgent: boolean;
    } = await dva.connect(runner).getNextApprover(transferID);
    return n;
  }

  static async getNextTxNonce(dva: DVATransferManager, runner: EthersT.ContractRunner) {
    return dva.connect(runner).getNextTxNonce();
  }

  static transferStatusToString(status: bigint): string {
    switch (status) {
      case 0n:
        return 'PENDING';
      case 1n:
        return 'COMPLETED';
      case 2n:
        return 'CANCELLED';
      case 3n:
        return 'REJECTED';
      default:
        throw new FheERC3643Error(`Unknown transfer status ${status}.`);
    }
  }

  static async signAndDelegateApproveTransfer(
    dva: DVATransferManager,
    transferID: string,
    signers: EthersT.Signer[],
    caller: EthersT.Signer,
    options: TxOptions,
  ) {
    const signatures: IDVATransferManager.SignatureStruct[] = [];
    for (let i = 0; i < signers.length; ++i) {
      const s = await signTransfer(transferID, signers[i]);
      signatures.push(s);
    }

    const txReceipt = await DVATransferManagerAPI.delegateApproveTransfer(dva, transferID, signatures, caller, options);

    const args = queryLogEventArgs(txReceipt, 'TransferApproved', dva.interface);

    let approver: { transferID: string; address: string } | undefined = undefined;

    if (args && args.length >= 2) {
      approver = {
        transferID: args[0],
        address: args[1],
      };
    }

    const transferDetails = await DVATransferManagerAPI.getTransfer(dva, transferID, caller, options);
    const tokenTransfer = queryTokenTransferEvent(txReceipt);

    return {
      txReceipt,
      signatures,
      approver,
      transferID,
      transferDetails,
      tokenTransfer,
    };
  }
}

function queryTokenTransferEvent(txReceipt: ContractTransactionReceipt | null) {
  let tokenTransfer: { from: string; to: string; eamount: any } | null = null;
  const args = queryLogEventArgs(txReceipt, 'Transfer', Token__factory.createInterface());
  if (args && args.length === 3) {
    tokenTransfer = {
      from: EthersT.getAddress(args[0]),
      to: EthersT.getAddress(args[1]),
      eamount: args[2],
    };
  }
  return tokenTransfer;
}
