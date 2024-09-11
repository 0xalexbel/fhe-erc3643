import { ChainConfig } from '../ChainConfig';
import { throwIfInvalidAddress, throwIfNotOwner } from '../errors';
import { TokenAPI } from '../TokenAPI';
import { TxOptions } from '../types';
import { logStepMsg, logStepOK } from '../log';
import { ExchangeMonthlyLimitsModuleAPI } from '../ExchangeMonthlyLimitsModuleAPI';

// npx hardhat --network fhevm token exchangemonthly:is-id --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice
export async function cmdTokenExchangeMonthlyIsId(
  tokenAddressOrSaltOrNameOrSymbol: string,
  userAddressAlias: string,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  throwIfInvalidAddress(userAddress);

  const token = await chainConfig.tryResolveToken(tokenAddressOrSaltOrNameOrSymbol);
  const userIdentity = await TokenAPI.userAddressAliasToIdentity(
    token,
    userAddressAlias,
    chainConfig.provider,
    chainConfig,
  );

  const { module, compliance } = await ExchangeMonthlyLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  const ok = await ExchangeMonthlyLimitsModuleAPI.isExchangeID(
    module,
    userIdentity.identity,
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
  options: TxOptions,
) {
  const exchangeMonthlyLimitsModuleOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(
    exchangeMonthlyLimitsModuleOwnerWalletAlias,
  );

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);
  const userIdentity = await TokenAPI.userAddressAliasToIdentity(
    token,
    userAddressAlias,
    chainConfig.provider,
    chainConfig,
  );

  const { module, compliance } = await ExchangeMonthlyLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await ExchangeMonthlyLimitsModuleAPI.addExchangeID(
    module,
    userIdentity.identity,
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
  options: TxOptions,
) {
  const exchangeMonthlyLimitsModuleOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(
    exchangeMonthlyLimitsModuleOwnerWalletAlias,
  );

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);
  const userIdentity = await TokenAPI.userAddressAliasToIdentity(
    token,
    userAddressAlias,
    chainConfig.provider,
    chainConfig,
  );

  const { module, compliance } = await ExchangeMonthlyLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await ExchangeMonthlyLimitsModuleAPI.removeExchangeID(
    module,
    userIdentity.identity,
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
  options: TxOptions,
) {
  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  const investorId = await TokenAPI.userAddressAliasToIdentity(
    token,
    investorIdAlias,
    chainConfig.provider,
    chainConfig,
  );
  const exchangeId = await TokenAPI.userAddressAliasToIdentity(
    token,
    exchangeIdAlias,
    chainConfig.provider,
    chainConfig,
  );

  const { module, compliance } = await ExchangeMonthlyLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  const enc = await module.getMonthlyCounter(compliance, exchangeId.identity, investorId.identity);
  const value = await chainConfig.decrypt64(enc);

  return {
    value,
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
  options: TxOptions,
) {
  const complianceOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(complianceOwnerWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);
  const exchangeId = await TokenAPI.userAddressAliasToIdentity(
    token,
    exchangeIdAlias,
    chainConfig.provider,
    chainConfig,
  );

  const { module, compliance } = await ExchangeMonthlyLimitsModuleAPI.fromToken(token, chainConfig.provider, options);

  await throwIfNotOwner("token's Compliance", compliance, complianceOwnerWallet, chainConfig.provider, chainConfig);

  await ExchangeMonthlyLimitsModuleAPI.setExchangeMonthlyLimit(
    module,
    compliance,
    exchangeId.identity,
    newExchangeMonthlyLimit,
    complianceOwnerWallet,
    options,
  );

  const ml = await module.getExchangeMonthlyLimit(compliance, exchangeId.identity);

  return ml;
}
