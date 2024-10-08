import { ethers as EthersT } from 'ethers';
import { DVATransferManager__factory, IDVATransferManager } from '../artifacts';
import { ChainConfig } from '../ChainConfig';
import { TokenAPI } from '../TokenAPI';
import { TxOptions } from '../types';
import { IdentityRegistryAPI } from '../IdentityRegistryAPI';
import { FheERC3643Error, throwIfNotAgent } from '../errors';
import { DVATransferManagerAPI } from '../DVATransferManagerAPI';
import { txWait } from '../utils';

export async function cmdTransferManagerCreate(
  tokenAddressOrSaltOrNameOrSymbol: string | undefined,
  userAddressAlias: string,
  agentWalletAlias: string,
  transferManagerCountry: bigint,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const token = await chainConfig.tryResolveToken(tokenAddressOrSaltOrNameOrSymbol);

  const agentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(agentWalletAlias);

  const dvaTransferManager = await new DVATransferManager__factory(agentWallet).deploy();
  await dvaTransferManager.waitForDeployment();

  const { identity, userAddress } = await TokenAPI.userAddressAliasToIdentity(
    token,
    userAddressAlias,
    chainConfig.provider,
    chainConfig,
  );

  const identityRegistry = await TokenAPI.identityRegistry(token);

  if (!(await IdentityRegistryAPI.isVerified(identityRegistry, userAddress, chainConfig.provider))) {
    throw new FheERC3643Error(
      `Identity of ${userAddressAlias} is not verified (id=${await identity.getAddress()}, id-registry=${await identityRegistry.getAddress()})`,
    );
  }

  await IdentityRegistryAPI.registerIdentity(
    identityRegistry,
    dvaTransferManager,
    identity,
    transferManagerCountry,
    agentWallet,
    chainConfig,
    options,
  );

  const transferManagerAddress = await dvaTransferManager.getAddress();
  await chainConfig.saveContract(transferManagerAddress, 'DVATransferManager');

  return {
    transferManagerAddress,
    transferManagerCountry,
    tokenAddress: await token.getAddress(),
    tokenName: await token.name(),
    identityAddress: await identity.getAddress(),
    identityAddressAlias: userAddressAlias,
  };
}

export async function cmdTransferManagerSetApprovalCriteria(
  tokenAddressOrSaltOrNameOrSymbol: string | undefined,
  tokenAgentWalletAlias: string,
  dvaAddressOrUserAlias: string,
  includeRecipientApprover: boolean,
  includeAgentApprover: boolean,
  sequentialApproval: boolean,
  additionalApproversAlias: Array<string>,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const token = await chainConfig.tryResolveToken(tokenAddressOrSaltOrNameOrSymbol);
  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const additionalApprovers = additionalApproversAlias.map(v =>
    chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(v),
  );

  await throwIfNotAgent(tokenAgentWallet, 'Token', await token.getAddress(), chainConfig.provider, chainConfig);

  const dvaAddress = await chainConfig.findDVATransferManagerAddress(token, dvaAddressOrUserAlias);
  if (!dvaAddress) {
    throw new FheERC3643Error(`Unable to retreive DVA Transfer manager associated to ${dvaAddressOrUserAlias}`);
  }

  await TokenAPI.throwIfNotVerified(token, dvaAddress, dvaAddressOrUserAlias, chainConfig.provider);

  const dva = DVATransferManagerAPI.from(dvaAddress);

  const tokenAddress = await token.getAddress();

  await txWait(
    dva
      .connect(tokenAgentWallet)
      .setApprovalCriteria(
        tokenAddress,
        includeRecipientApprover,
        includeAgentApprover,
        sequentialApproval,
        additionalApprovers,
      ),
    options,
  );

  const [_includeRecipientApprover, _includeAgentApprover, _sequentialApproval, _additionalApprovers, _hash] = await dva
    .connect(chainConfig.provider)
    .getApprovalCriteria(tokenAddress);

  if (
    _includeRecipientApprover !== includeRecipientApprover ||
    _includeAgentApprover !== includeAgentApprover ||
    _sequentialApproval !== sequentialApproval
  ) {
    throw new FheERC3643Error(`The set approval criteria of the token command failed`);
  }

  /*
    bytes32 hash = keccak256(
      abi.encode(tokenAddress, includeRecipientApprover, includeAgentApprover, additionalApprovers)
    );
  */
  return {
    tokenAddress,
    tokenName: await token.name(),
    transferManagerAddress: dvaAddress,
    transferManagerIdAlias: dvaAddressOrUserAlias,
    tokenAgentWalletAlias,
    tokenAgentAddress: tokenAgentWallet.address,
    includeAgentApprover,
    includeRecipientApprover,
    sequentialApproval,
    additionalApprovers,
    additionalApproversAlias,
    hash: _hash,
  };
}

export async function cmdTransferManagerCalculateTransferID(
  tokenAddressOrSaltOrNameOrSymbol: string | undefined,
  dvaAddressOrUserAlias: string,
  nonce: bigint,
  senderAddressAlias: string,
  recipientAddressAlias: string,
  eamount: bigint,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const token = await chainConfig.tryResolveToken(tokenAddressOrSaltOrNameOrSymbol);
  const senderAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(senderAddressAlias);
  const recipientAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(recipientAddressAlias);

  const dvaAddress = await chainConfig.findDVATransferManagerAddress(token, dvaAddressOrUserAlias);
  if (!dvaAddress) {
    throw new FheERC3643Error(`Unable to retreive DVA Transfer manager associated to ${dvaAddressOrUserAlias}`);
  }

  await TokenAPI.throwIfNotVerified(token, dvaAddress, dvaAddressOrUserAlias, chainConfig.provider);

  const dva = DVATransferManagerAPI.from(dvaAddress);

  const tokenAddress = await token.getAddress();

  const res = await DVATransferManagerAPI.calculateTransferID(
    dva,
    nonce,
    senderAddress,
    recipientAddress,
    eamount,
    chainConfig.provider,
  );

  return {
    token,
    tokenAddress,
    senderAddress,
    senderAddressAlias,
    recipientAddress,
    recipientAddressAlias,
    transferManagerAddress: dvaAddress,
    transferManagerIdAlias: dvaAddressOrUserAlias,
    transferID: res,
    nonce,
    eamount,
  };
}

export async function cmdTransferManagerInitiate(
  tokenAddressOrSaltOrNameOrSymbol: string | undefined,
  dvaAddressOrUserAlias: string,
  senderWalletAlias: string,
  recipientAddressAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const token = await chainConfig.tryResolveToken(tokenAddressOrSaltOrNameOrSymbol);
  const senderWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(senderWalletAlias);
  const recipientAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(recipientAddressAlias);

  const dvaAddress = await chainConfig.findDVATransferManagerAddress(token, dvaAddressOrUserAlias);
  if (!dvaAddress) {
    throw new FheERC3643Error(`Unable to retreive DVA Transfer manager associated to ${dvaAddressOrUserAlias}`);
  }

  await TokenAPI.throwIfNotVerified(token, dvaAddress, dvaAddressOrUserAlias, chainConfig.provider);

  const dva = DVATransferManagerAPI.from(dvaAddress);

  const tokenAddress = await token.getAddress();

  const encAmount = await chainConfig.encrypt64(dvaAddress, senderWallet, amount);

  const nonce = await dva.connect(chainConfig.provider).getNextTxNonce();

  const eamount = EthersT.toBigInt(encAmount.handles[0]);
  const transferID = await DVATransferManagerAPI.calculateTransferID(
    dva,
    nonce,
    senderWallet,
    recipientAddress,
    eamount,
    chainConfig.provider,
  );

  await DVATransferManagerAPI.initiateTransfer(
    dva,
    token,
    senderWallet,
    recipientAddress,
    encAmount.handles[0],
    encAmount.inputProof,
    options,
  );

  return {
    tokenAddress,
    tokenName: await token.name(),
    senderAddress: senderWallet.address,
    senderAddressAlias: senderWalletAlias,
    recipientAddress,
    recipientAddressAlias,
    transferManagerAddress: dvaAddress,
    transferManagerIdAlias: dvaAddressOrUserAlias,
    amount,
    eamount,
    transferID,
    nonce,
  };
}

export async function cmdTransferManagerDelegateApprove(
  tokenAddressOrSaltOrNameOrSymbol: string | undefined,
  dvaAddressOrUserAlias: string,
  transferID: string,
  signersWalletAlias: string[],
  callerWalletAlias: string,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const token = await chainConfig.tryResolveToken(tokenAddressOrSaltOrNameOrSymbol);
  const callerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(callerWalletAlias);

  const signers: EthersT.Signer[] = [];
  for (let i = 0; i < signersWalletAlias.length; ++i) {
    signers.push(chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(signersWalletAlias[i]));
  }

  const dvaAddress = await chainConfig.findDVATransferManagerAddress(token, dvaAddressOrUserAlias);
  if (!dvaAddress) {
    throw new FheERC3643Error(`Unable to retreive DVA Transfer manager associated to ${dvaAddressOrUserAlias}`);
  }

  await TokenAPI.throwIfNotVerified(token, dvaAddress, dvaAddressOrUserAlias, chainConfig.provider);

  const dva = DVATransferManagerAPI.from(dvaAddress);

  const tokenAddress = await token.getAddress();

  const { txReceipt, tokenTransfer, ...res } = await DVATransferManagerAPI.signAndDelegateApproveTransfer(
    dva,
    transferID,
    signers,
    callerWallet,
    options,
  );

  const signersAddresses = await Promise.all(signers.map(s => s.getAddress()));

  const output = {
    tokenName: await token.name(),
    tokenAddress,
    transferManagerAddress: dvaAddress,
    ...res,
    ...(tokenTransfer ? { tokenTransfer } : {}),
    signatures: signersAddresses.map((s, i) => {
      return { signer: s, signature: res.signatures[i] };
    }),
  };

  return output;
}

export async function cmdTransferManagerGetTransfer(
  tokenAddressOrSaltOrNameOrSymbol: string | undefined,
  dvaAddressOrUserAlias: string,
  transferID: string,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const token = await chainConfig.tryResolveToken(tokenAddressOrSaltOrNameOrSymbol);

  const dvaAddress = await chainConfig.findDVATransferManagerAddress(token, dvaAddressOrUserAlias);
  if (!dvaAddress) {
    throw new FheERC3643Error(`Unable to retreive DVA Transfer manager associated to ${dvaAddressOrUserAlias}`);
  }

  await TokenAPI.throwIfNotVerified(token, dvaAddress, dvaAddressOrUserAlias, chainConfig.provider);

  const dva = DVATransferManagerAPI.from(dvaAddress);

  const tokenAddress = await token.getAddress();

  const res = await DVATransferManagerAPI.getTransfer(dva, transferID, chainConfig.provider, options);

  if (res.tokenAddress !== tokenAddress) {
    throw new FheERC3643Error(`Invalid transferID ${transferID} (token address mismatch)`);
  }

  const details = {
    transferID,
    transferManagerAddress: dvaAddress,
    tokenAddress,
    tokenName: await token.name(),
    senderAddress: res.sender,
    recipientAddress: res.recipient,
    eamount: res.eamount,
    eactualAmount: res.eactualAmount,
    status: res.status,
    statusString: DVATransferManagerAPI.transferStatusToString(res.status),
    approvers: res.approvers.map(a => {
      return {
        anyTokenAgent: a.anyTokenAgent,
        approved: a.approved,
        wallet: a.wallet,
        walletAlias: [] as Array<string>,
      };
    }),
    approvalCriteriaHash: res.approvalCriteriaHash,
  };

  for (let i = 0; i < details.approvers.length; ++i) {
    const a = details.approvers[i];
    a.walletAlias = chainConfig.getWalletNamesFromAddress(a.wallet);
  }

  return details;
}

export async function cmdTransferManagerApprove(
  tokenAddressOrSaltOrNameOrSymbol: string | undefined,
  dvaAddressOrUserAlias: string,
  transferID: string,
  approverWalletAlias: string,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const token = await chainConfig.tryResolveToken(tokenAddressOrSaltOrNameOrSymbol);
  const approverWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(approverWalletAlias);

  const dvaAddress = await chainConfig.findDVATransferManagerAddress(token, dvaAddressOrUserAlias);
  if (!dvaAddress) {
    throw new FheERC3643Error(`Unable to retreive DVA Transfer manager associated to ${dvaAddressOrUserAlias}`);
  }

  await TokenAPI.throwIfNotVerified(token, dvaAddress, dvaAddressOrUserAlias, chainConfig.provider);

  const dva = DVATransferManagerAPI.from(dvaAddress);

  const tokenAddress = await token.getAddress();

  const { txReceipt, tokenTransfer, ...res } = await DVATransferManagerAPI.approveTransfer(
    dva,
    transferID,
    approverWallet,
    options,
  );

  return {
    tokenName: await token.name(),
    tokenAddress,
    transferManagerAddress: dvaAddress,
    ...res,
    ...(tokenTransfer ? { tokenTransfer } : {}),
  };
}
