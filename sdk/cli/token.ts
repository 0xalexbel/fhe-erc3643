import { ChainConfig } from '../ChainConfig';
import { FheERC3643Error, throwIfInvalidAddress, throwIfNotDeployed } from '../errors';
import { IdentityAPI } from '../IdentityAPI';
import { logStepInfo, logStepMsg, logStepOK } from '../log';
import { TokenAPI } from '../TokenAPI';
import { TokenConfig } from '../TokenConfig';
import { TREXFactoryAPI } from '../TREXFactory';
import { TxOptions } from '../types';
import { defaultTxOptions } from '../utils';

export type NewTokenResult = {
  token: string;
  ir: string;
  irs: string;
  tir: string;
  ctr: string;
  mc: string;
  saltHash: string;
};

export async function cmdTokenNew(
  configFile: string,
  tokenOwnerWalletAlias: string,
  trexFactoryAddress: string,
  salt: string,
  trexFactoryOwnerWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  const trexFactoryOwnerWallet =
    trexFactoryOwnerWalletAlias === 'auto'
      ? await chainConfig.getOwnerWallet(trexFactoryAddress)
      : chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(trexFactoryOwnerWalletAlias);

  throwIfInvalidAddress(trexFactoryAddress);
  await throwIfNotDeployed('TREX factory', chainConfig.provider, trexFactoryAddress);

  const tokenOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenOwnerWalletAlias);

  const c = await TokenConfig.load(configFile, chainConfig);
  c.token.owner = tokenOwnerWallet.address;
  c.salt = salt;

  const params = TokenConfig.toCallParams(c);
  const trexFactory = await TREXFactoryAPI.fromWithOwner(trexFactoryAddress, trexFactoryOwnerWallet);

  if (chainConfig.networkName === 'hardhat') {
    const res: NewTokenResult = await TREXFactoryAPI.deployTREXSuiteManual(
      trexFactory,
      params.salt,
      params.tokenDetails,
      params.claimDetails,
      tokenOwnerWallet,
      trexFactoryOwnerWallet,
      chainConfig,
      options,
    );
    return res;
  }

  const res: NewTokenResult = await TREXFactoryAPI.deployTREXSuite(
    trexFactory,
    params.salt,
    params.tokenDetails,
    params.claimDetails,
    trexFactoryOwnerWallet,
    chainConfig,
    options,
  );

  if (options?.mute !== true) {
    console.log(
      JSON.stringify(
        { ...res, config: c },
        (key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2, // return everything else unchanged
      ),
    );
  }

  return res;
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenAddIdentity(
  tokenAddress: string,
  userWalletAlias: string,
  identityAddress: string,
  country: bigint,
  tokenIRAgentWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  throwIfInvalidAddress(identityAddress);
  await throwIfNotDeployed('User identity', chainConfig.provider, identityAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userWalletAlias);
  const agentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenIRAgentWalletAlias);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);
  const identity = IdentityAPI.from(identityAddress, chainConfig.provider);

  const alreadyStored = await TokenAPI.hasIdentity(token, userAddress, identity, country, chainConfig.provider);

  if (alreadyStored) {
    logStepInfo(
      `Identity ${identityAddress} with user ${userWalletAlias} and country ${country.toString()} is already registered by token ${tokenAddress}`,
      options,
    );
    return;
  }

  options.progress?.pause();

  await TokenAPI.registerIdentity(token, userAddress, identity, country, agentWallet, options);

  options.progress?.unpause();

  logStepOK(
    `Identity ${identityAddress} with user ${userAddress} and country ${country.toString()} has been successfully added to token ${tokenAddress}`,
    options,
  );
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenBalance(
  tokenAddress: string,
  userWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userWalletAlias);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);

  const encBalance = await TokenAPI.balanceOf(token, userAddress, chainConfig.provider, options);

  logStepMsg(`Decrypting balance of ${userWalletAlias}...`, options);

  const balance = await chainConfig.decrypt64(encBalance);

  logStepMsg(
    `Balance of ${userWalletAlias} is : ${balance.toString()} (fhevm handle=${encBalance.toString()})`,
    options,
  );

  return {
    fhevmHandle: encBalance,
    value: balance,
  };
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenTotalSupply(tokenAddress: string, chainConfig: ChainConfig, options?: TxOptions) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);

  const fhevmHandle = await TokenAPI.totalSupply(token, chainConfig.provider, options);

  logStepMsg(`Decrypting token total supply ...`, options);

  const value = await chainConfig.decrypt64(fhevmHandle);

  logStepMsg(`Token total supply is : ${value.toString()} (fhevm handle=${fhevmHandle.toString()})`, options);

  return {
    fhevmHandle,
    value,
  };
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenMint(
  tokenAddress: string,
  userWalletAlias: string,
  tokenAgentWalletAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userWalletAlias);
  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  const encAmount = await chainConfig.encrypt64(await token.getAddress(), userAddress, amount);

  await TokenAPI.mint(
    token,
    userAddress,
    encAmount.handles[0],
    encAmount.inputProof,
    tokenAgentWallet,
    chainConfig,
    options,
  );

  const enc = await TokenAPI.balanceOf(token, userAddress, chainConfig.provider, options);
  const balance = await chainConfig.decrypt64(enc);

  logStepOK(
    `Minted ${amount.toString()} tokens to '${userWalletAlias}' (new balance is ${balance.toString()})`,
    options,
  );
}

export async function cmdTokenBurn(
  tokenAddress: string,
  userWalletAlias: string,
  tokenAgentWalletAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userWalletAlias);
  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  const encAmount = await chainConfig.encrypt64(await token.getAddress(), userAddress, amount);

  await TokenAPI.burn(token, userAddress, encAmount.handles[0], encAmount.inputProof, tokenAgentWallet, options);
}

export async function cmdTokenFreeze(
  tokenAddress: string,
  userWalletAlias: string,
  tokenAgentWalletAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userWalletAlias);
  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  const encAmount = await chainConfig.encrypt64(await token.getAddress(), userAddress, amount);

  await TokenAPI.freezePartialTokens(
    token,
    userAddress,
    encAmount.handles[0],
    encAmount.inputProof,
    tokenAgentWallet,
    options,
  );
}

export async function cmdTokenTransfer(
  tokenAddress: string,
  fromWalletAlias: string,
  toAddressAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const fromWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(fromWalletAlias);
  const toAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(toAddressAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  const encAmount = await chainConfig.encrypt64(await token.getAddress(), fromWallet.address, amount);

  await TokenAPI.transfer(token, toAddress, encAmount.handles[0], encAmount.inputProof, fromWallet, options);
}

export async function cmdTokenUnfreeze(
  tokenAddress: string,
  userAddressAlias: string,
  tokenAgentWalletAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);
  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  const encAmount = await chainConfig.encrypt64(await token.getAddress(), userAddress, amount);

  await TokenAPI.unfreezePartialTokens(
    token,
    userAddress,
    encAmount.handles[0],
    encAmount.inputProof,
    tokenAgentWallet,
    options,
  );
}

export async function cmdTokenFrozenTokens(
  tokenAddress: string,
  userAddressAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);

  const encValue = await TokenAPI.getFrozenTokens(token, userAddress, chainConfig.provider, options);

  logStepMsg(`Decrypting frozen tokens of ${userAddressAlias}...`, options);

  let value: bigint | undefined = undefined;
  if (encValue !== 0n) {
    value = await chainConfig.decrypt64(encValue);
  }

  logStepMsg(`The number of frozen tokens of ${userAddressAlias} is : ${value} (fhevm handle=${encValue})`, options);

  return {
    fhevmHandle: encValue,
    value,
  };
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenPause(
  tokenAddress: string,
  tokenAgentWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  let isPaused = await TokenAPI.paused(token, chainConfig.provider, options);

  if (isPaused) {
    logStepInfo(`Token ${tokenAddress} is already paused`, options);
    return;
  }

  await TokenAPI.pause(token, tokenAgentWallet, options);

  isPaused = await TokenAPI.paused(token, chainConfig.provider, options);

  if (!isPaused) {
    throw new FheERC3643Error(`Pause token ${tokenAddress} failed.`);
  }

  logStepOK(`Token ${tokenAddress} is paused`, options);
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenUnpause(
  tokenAddress: string,
  tokenAgentWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  let isPaused = await TokenAPI.paused(token, chainConfig.provider, options);

  if (!isPaused) {
    logStepInfo(`Token ${tokenAddress} is already unpaused`, options);
    return;
  }

  await TokenAPI.unpause(token, tokenAgentWallet, options);

  isPaused = await TokenAPI.paused(token, chainConfig.provider, options);

  if (isPaused) {
    throw new FheERC3643Error(`Unpause token ${tokenAddress} failed.`);
  }

  logStepOK(`Token ${tokenAddress} is unpaused`, options);
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenIsPaused(tokenAddress: string, chainConfig: ChainConfig, options?: TxOptions) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  const isPaused = await TokenAPI.paused(token, chainConfig.provider, options);

  if (isPaused) {
    logStepMsg(`Token ${tokenAddress} is paused`, options);
  } else {
    logStepMsg(`Token ${tokenAddress} is unpaused`, options);
  }

  return isPaused;
}

////////////////////////////////////////////////////////////////////////////////
