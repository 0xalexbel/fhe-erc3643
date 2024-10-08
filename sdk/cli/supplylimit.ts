import { ChainConfig } from '../ChainConfig';
import { throwIfInvalidAddress, throwIfNotDeployed, throwIfNotOwner } from '../errors';
import { SupplyLimitModuleAPI } from '../SupplyLimitModuleAPI';
import { TokenAPI } from '../TokenAPI';
import { TxOptions } from '../types';
import { logStepMsg } from '../log';

export async function cmdTokenGetSupplyLimit(tokenAddress: string, chainConfig: ChainConfig, options: TxOptions) {
  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);
  const { module, compliance } = await SupplyLimitModuleAPI.fromToken(token, chainConfig.provider, options);

  const encSupplyLimit = await SupplyLimitModuleAPI.getSupplyLimit(module, compliance, chainConfig, options);

  const moduleAddress = await module.getAddress();
  logStepMsg(`Decrypting token supply limit (module address: ${moduleAddress})...`, options);

  const supplyLimit = await chainConfig.decrypt64(encSupplyLimit);

  logStepMsg(`Token supply limit = ${supplyLimit} (module address: ${moduleAddress})`, options);

  return {
    fhevmHandle: encSupplyLimit,
    value: supplyLimit,
  };

  return {};
}

export async function cmdTokenSetSupplyLimit(
  tokenAddress: string,
  amount: bigint,
  complianceOwnerWalletAlias: string,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const complianceOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(complianceOwnerWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);
  const { module, compliance } = await SupplyLimitModuleAPI.fromToken(token, chainConfig.provider, options);

  await throwIfNotOwner("token's Compliance", compliance, complianceOwnerWallet, chainConfig.provider, chainConfig);

  await SupplyLimitModuleAPI.setSupplyLimit(module, compliance, amount, complianceOwnerWallet, chainConfig, options);

  logStepMsg(`Module supply limit is now set to ${amount} (module address: ${await module.getAddress()})...`, options);
}
