import { ChainConfig } from '../ChainConfig';
import { FheERC3643Error, throwIfInvalidAddress, throwIfNotDeployed, throwIfNotOwner } from '../errors';
import { TokenAPI } from '../TokenAPI';
import { TxOptions } from '../types';
import { defaultTxOptions } from '../utils';
import { logStepMsg, logStepOK } from '../log';
import { ExchangeMonthlyLimitsModuleAPI } from '../ExchangeMonthlyLimitsModuleAPI';
import { fhevm } from 'hardhat';

// npx hardhat --network fhevm token exchangemonthly:is-id --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice
export async function cmdTokenExchangeMonthlyIsId(
  tokenAddress: string,
  userAddressAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);
  const userIdInfo = await TokenAPI.identityFromUser(token, userAddress, chainConfig.provider);
  if (!userIdInfo) {
    throw new FheERC3643Error(`user ${userAddressAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await ExchangeMonthlyLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  const ok = await ExchangeMonthlyLimitsModuleAPI.isExchangeID(
    module,
    userIdInfo.identity,
    chainConfig.provider,
    options,
  );

  if (ok) {
    logStepMsg(`User ${userAddressAlias} ID is tagged as being an exchange ID`, options);
  } else {
    logStepMsg(`User ${userAddressAlias} ID is not tagged as being an exchange ID`, options);
  }

  return ok;
}

// npx hardhat --network fhevm token exchangemonthly:add-id --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice --owner token-owner
export async function cmdTokenExchangeMonthlyAddId(
  tokenAddress: string,
  userAddressAlias: string,
  exchangeMonthlyLimitsModuleOwnerWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  const exchangeMonthlyLimitsModuleOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(
    exchangeMonthlyLimitsModuleOwnerWalletAlias,
  );
  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);
  const userIdInfo = await TokenAPI.identityFromUser(token, userAddress, chainConfig.provider);
  if (!userIdInfo) {
    throw new FheERC3643Error(`user ${userAddressAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await ExchangeMonthlyLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await ExchangeMonthlyLimitsModuleAPI.addExchangeID(
    module,
    userIdInfo.identity,
    exchangeMonthlyLimitsModuleOwnerWallet,
    chainConfig,
    options,
  );

  logStepOK(`User ${userAddressAlias} id has been successfully tagged as exchange`, options);
}

// npx hardhat --network fhevm token exchangemonthly:remove-id --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice --owner token-owner
export async function cmdTokenExchangeMonthlyRemoveId(
  tokenAddress: string,
  userAddressAlias: string,
  exchangeMonthlyLimitsModuleOwnerWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  const exchangeMonthlyLimitsModuleOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(
    exchangeMonthlyLimitsModuleOwnerWalletAlias,
  );
  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);
  const userIdInfo = await TokenAPI.identityFromUser(token, userAddress, chainConfig.provider);
  if (!userIdInfo) {
    throw new FheERC3643Error(`user ${userAddressAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await ExchangeMonthlyLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await ExchangeMonthlyLimitsModuleAPI.removeExchangeID(
    module,
    userIdInfo.identity,
    exchangeMonthlyLimitsModuleOwnerWallet,
    chainConfig,
    options,
  );

  logStepOK(`User ${userAddressAlias} id has been successfully untagged as exchange`, options);
}

// npx hardhat --network fhevm token exchangemonthly:get-monthly-counter --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --exchange-id alice --investor-id bob
export async function cmdTokenExchangeMonthlyGetMonthlyCounter(
  tokenAddress: string,
  investorIdAlias: string,
  exchangeIdAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);

  const investorIdWalletAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(investorIdAlias);
  const exchangeIdWalletAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(exchangeIdAlias);

  const investorIdInfo = await TokenAPI.identityFromUser(token, investorIdWalletAddress, chainConfig.provider);
  if (!investorIdInfo) {
    throw new FheERC3643Error(`user ${investorIdAlias} has no registered identity stored in token ${tokenAddress}`);
  }
  const exchangeIdInfo = await TokenAPI.identityFromUser(token, exchangeIdWalletAddress, chainConfig.provider);
  if (!exchangeIdInfo) {
    throw new FheERC3643Error(`user ${exchangeIdAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await ExchangeMonthlyLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  const enc = await module.getMonthlyCounter(compliance, exchangeIdInfo.identity, investorIdInfo.identity);

  return {
    value: await fhevm.decrypt64(enc),
    handle: enc,
  };
}

// npx hardhat --network fhevm token exchangemonthly:set-exchange-limit --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --exchange-id alice --limit 100
export async function cmdTokenSetExchangeMonthlyLimit(
  tokenAddress: string,
  exchangeIdAlias: string,
  newExchangeMonthlyLimit: bigint,
  complianceOwnerWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);

  const complianceOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(complianceOwnerWalletAlias);
  const exchangeIdWalletAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(exchangeIdAlias);

  const exchangeIdInfo = await TokenAPI.identityFromUser(token, exchangeIdWalletAddress, chainConfig.provider);
  if (!exchangeIdInfo) {
    throw new FheERC3643Error(`user ${exchangeIdAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await ExchangeMonthlyLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await throwIfNotOwner("token's Compliance", chainConfig, compliance, complianceOwnerWallet);

  await ExchangeMonthlyLimitsModuleAPI.setExchangeMonthlyLimit(
    module,
    compliance,
    exchangeIdInfo.identity,
    newExchangeMonthlyLimit,
    complianceOwnerWallet,
    chainConfig,
    options,
  );

  const ml = await module.getExchangeMonthlyLimit(compliance, exchangeIdInfo.identity);

  return ml;
}
