import assert from 'assert';
import { ChainConfig } from '../ChainConfig';
import { FheERC3643Error, throwIfInvalidAddress, throwIfNotDeployed, throwIfNotOwner } from '../errors';
import { SupplyLimitModuleAPI } from '../SupplyLimitModuleAPI';
import { TokenAPI } from '../TokenAPI';
import { TxOptions } from '../types';
import { defaultTxOptions } from '../utils';
import { logStepMsg, logStepOK } from '../log';
import { TimeExchangeLimitsModuleAPI } from '../TimeExchangeLimitsModuleAPI';

export async function cmdTokenTimeExchangeIsId(
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

  const { module, compliance } = await TimeExchangeLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  const ok = await TimeExchangeLimitsModuleAPI.isExchangeID(module, userIdInfo.identity, chainConfig.provider, options);

  if (ok) {
    logStepMsg(`User ${userAddressAlias} ID is tagged as being an exchange ID`, options);
  } else {
    logStepMsg(`User ${userAddressAlias} ID is not tagged as being an exchange ID`, options);
  }

  return ok;
}

export async function cmdTokenTimeExchangeAddId(
  tokenAddress: string,
  userAddressAlias: string,
  timeExchangeLimitsModuleOwnerWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  const timeExchangeLimitsModuleOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(
    timeExchangeLimitsModuleOwnerWalletAlias,
  );
  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);
  const userIdInfo = await TokenAPI.identityFromUser(token, userAddress, chainConfig.provider);
  if (!userIdInfo) {
    throw new FheERC3643Error(`user ${userAddressAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await TimeExchangeLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await TimeExchangeLimitsModuleAPI.addExchangeID(
    module,
    userIdInfo.identity,
    timeExchangeLimitsModuleOwnerWallet,
    chainConfig,
    options,
  );

  logStepOK(`User ${userAddressAlias} id has been successfully tagged as exchange`, options);
}

export async function cmdTokenTimeExchangeRemoveId(
  tokenAddress: string,
  userAddressAlias: string,
  timeExchangeLimitsModuleOwnerWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  const timeExchangeLimitsModuleOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(
    timeExchangeLimitsModuleOwnerWalletAlias,
  );
  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);
  const userIdInfo = await TokenAPI.identityFromUser(token, userAddress, chainConfig.provider);
  if (!userIdInfo) {
    throw new FheERC3643Error(`user ${userAddressAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await TimeExchangeLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await TimeExchangeLimitsModuleAPI.removeExchangeID(
    module,
    userIdInfo.identity,
    timeExchangeLimitsModuleOwnerWallet,
    chainConfig,
    options,
  );

  logStepOK(`User ${userAddressAlias} id has been successfully untagged as exchange`, options);
}

// export async function cmdTokenSetSupplyLimit(
//   tokenAddress: string,
//   amount: bigint,
//   complianceOwnerWalletAlias: string,
//   chainConfig: ChainConfig,
//   options?: TxOptions,
// ) {
//   options = options ?? defaultTxOptions(1);

//   throwIfInvalidAddress(tokenAddress);
//   await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

//   const complianceOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(complianceOwnerWalletAlias);

//   const token = TokenAPI.from(tokenAddress, chainConfig.provider);
//   const { module, compliance } = await SupplyLimitModuleAPI.fromToken(token, chainConfig.provider, options);

//   await throwIfNotOwner("token's Compliance", chainConfig, compliance, complianceOwnerWallet);

//   return await SupplyLimitModuleAPI.setSupplyLimit(
//     module,
//     compliance,
//     amount,
//     complianceOwnerWallet,
//     chainConfig,
//     options,
//   );
// }
