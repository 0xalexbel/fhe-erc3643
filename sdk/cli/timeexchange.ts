import { ChainConfig } from '../ChainConfig';
import { FheERC3643Error, throwIfInvalidUint32, throwIfNotOwner } from '../errors';
import { TokenAPI } from '../TokenAPI';
import { TxOptions } from '../types';
import { logStepMsg, logStepOK } from '../log';
import { TimeExchangeLimitsModuleAPI } from '../TimeExchangeLimitsModuleAPI';

export async function cmdTokenTimeExchangeIsId(
  tokenAddress: string,
  userAddressAlias: string,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);
  const userIdInfo = await TokenAPI.userToIdentityAndCountry(token, userAddress, chainConfig.provider);
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
  options: TxOptions,
) {
  const timeExchangeLimitsModuleOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(
    timeExchangeLimitsModuleOwnerWalletAlias,
  );
  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);
  const userIdInfo = await TokenAPI.userToIdentityAndCountry(token, userAddress, chainConfig.provider);
  if (!userIdInfo) {
    throw new FheERC3643Error(`user ${userAddressAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await TimeExchangeLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await TimeExchangeLimitsModuleAPI.addExchangeID(
    module,
    userIdInfo.identity,
    timeExchangeLimitsModuleOwnerWallet,
    chainConfig.provider,
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
  options: TxOptions,
) {
  const timeExchangeLimitsModuleOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(
    timeExchangeLimitsModuleOwnerWalletAlias,
  );
  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);
  const userIdInfo = await TokenAPI.userToIdentityAndCountry(token, userAddress, chainConfig.provider);
  if (!userIdInfo) {
    throw new FheERC3643Error(`user ${userAddressAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await TimeExchangeLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await TimeExchangeLimitsModuleAPI.removeExchangeID(
    module,
    userIdInfo.identity,
    timeExchangeLimitsModuleOwnerWallet,
    chainConfig.provider,
    chainConfig,
    options,
  );

  logStepOK(`User ${userAddressAlias} id has been successfully untagged as exchange`, options);
}

export async function cmdTokenTimeExchangeSetLimits(
  tokenAddress: string,
  userAddressAlias: string,
  timeLimit: number,
  valueLimit: bigint,
  complianceOwnerWalletAlias: string,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const complianceOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(complianceOwnerWalletAlias);
  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  throwIfInvalidUint32(timeLimit);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);
  const userIdInfo = await TokenAPI.userToIdentityAndCountry(token, userAddress, chainConfig.provider);
  if (!userIdInfo) {
    throw new FheERC3643Error(`user ${userAddressAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await TimeExchangeLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await throwIfNotOwner("token's Compliance", compliance, complianceOwnerWallet, chainConfig.provider, chainConfig);

  await TimeExchangeLimitsModuleAPI.setExchangeLimits(
    module,
    compliance,
    userIdInfo.identity,
    timeLimit,
    valueLimit,
    complianceOwnerWallet,
    chainConfig,
    options,
  );

  logStepOK(
    `User ${userAddressAlias} ID limits have been successfully set to {time: ${timeLimit}, value: ${valueLimit}}`,
    options,
  );
}

export async function cmdTokenTimeExchangeGetLimits(
  tokenAddress: string,
  userAddressAlias: string,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);
  const userIdInfo = await TokenAPI.userToIdentityAndCountry(token, userAddress, chainConfig.provider);
  if (!userIdInfo) {
    throw new FheERC3643Error(`user ${userAddressAlias} has no registered identity stored in token ${tokenAddress}`);
  }

  const { module, compliance } = await TimeExchangeLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  const encLimits = await TimeExchangeLimitsModuleAPI.getExchangeLimits(
    module,
    compliance,
    userIdInfo.identity,
    chainConfig,
    options,
  );

  const moduleAddress = await module.getAddress();
  logStepMsg(`Decrypting ${userAddressAlias} ID exchange limits (module: ${moduleAddress})...`, options);

  if (encLimits.length === 0) {
    logStepMsg(`${userAddressAlias} ID has no exchange limit`, options);
    return [];
  }

  const clearLimits = [];
  for (let i = 0; i < encLimits.length; ++i) {
    const v = await chainConfig.decrypt64(encLimits[i].valueLimitFhevmHandle);
    clearLimits.push({ timeLimit: Number(encLimits[i].timeLimit), valueLimit: v });
  }

  const msg =
    `${userAddressAlias} ID exchange limits are:\n` +
    clearLimits.map(v => `{time: ${v.timeLimit}, value: ${v.valueLimit}}`).join('\n');

  logStepMsg(msg, options);

  return clearLimits;
}
