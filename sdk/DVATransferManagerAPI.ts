import { ethers as EthersT, JsonRpcProvider } from 'ethers';
import { DVATransferManager, DVATransferManager__factory, IDVATransferManager, Token } from './artifacts';
import { txWaitAndCatchError } from './utils';
import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider';
import { FheERC3643Error } from './errors';
import { TxOptions } from './types';
import { getLogEventArgs } from '../test/utils';

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
  //const rawSignature = await signMessage(EthersT.getBytes(transferID), await signer.getAddress(), signer.provider);
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

  static async initiateTransfer(
    dva: DVATransferManager,
    token: Token,
    sender: EthersT.Signer,
    recipient: EthersT.AddressLike,
    eamount: Uint8Array,
    inputProof: Uint8Array,
    options: TxOptions,
  ) {
    const txReceipt = await txWaitAndCatchError(
      dva.connect(sender).initiateTransfer(await token.getAddress(), recipient, eamount, inputProof),
      options,
    );
    return txReceipt;
  }

  static async delegateApproveTransfer(
    dva: DVATransferManager,
    transferID: string,
    signatures: IDVATransferManager.SignatureStruct[],
    caller: EthersT.Signer,
    options: TxOptions,
  ) {
    const txReceipt = await txWaitAndCatchError(
      dva.connect(caller).delegateApproveTransfer(transferID, signatures),
      options,
    );
    return txReceipt;
  }

  static async approveTransfer(
    dva: DVATransferManager,
    transferID: string,
    caller: EthersT.Signer,
    options: TxOptions,
  ) {
    const txReceipt = await txWaitAndCatchError(dva.connect(caller).approveTransfer(transferID), options);
    return txReceipt;
  }

  static async cancelTransfer(dva: DVATransferManager, transferID: string, caller: EthersT.Signer, options: TxOptions) {
    const txReceipt = await txWaitAndCatchError(dva.connect(caller).cancelTransfer(transferID), options);
    return txReceipt;
  }

  static async rejectTransfer(dva: DVATransferManager, transferID: string, caller: EthersT.Signer, options: TxOptions) {
    const txReceipt = await txWaitAndCatchError(dva.connect(caller).rejectTransfer(transferID), options);
    return txReceipt;
  }

  static async getTransfer(dva: DVATransferManager, transferID: string, runner: EthersT.ContractRunner) {
    const t: IDVATransferManager.TransferStructOutput = await dva.connect(runner).getTransfer(transferID);
    return t;
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

    const args = getLogEventArgs(txReceipt, 'TransferApproved', undefined, dva);

    let approver: { transferID: string; address: string } | undefined = undefined;

    if (args.length >= 2) {
      approver = {
        transferID: args[0],
        address: args[1],
      };
    }

    return {
      txReceipt,
      signatures,
      approver,
    };
  }

  /*
    function initiateTransfer(
        address tokenAddress,
        address recipient,
        einput encryptedAmount,
        bytes calldata inputProof

  */
}

/*
          const tx = context.suite.transferManager
            .connect(context.accounts.anotherWallet)
            .delegateApproveTransfer(context.transferID, [
              await signTransfer(context.transferID, context.accounts.charlieWallet),
            ]);


    const transferID = await context.suite.transferManager.calculateTransferID(
      0,
      context.accounts.aliceWallet.address,
      context.accounts.bobWallet.address,
      ethers.toBigInt(encHundredHandle),
    );

    await context.suite.transferManager
      .connect(context.accounts.aliceWallet)
      .initiateTransfer(
        context.suite.token,
        context.accounts.bobWallet.address,
        encHundredHandle,
        encHundred.inputProof,
      );

*/
