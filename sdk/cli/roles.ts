import { AgentRoleAPI } from '../AgentRoleAPI';
import { ChainConfig } from '../ChainConfig';
import { logStepInfo, logStepOK } from '../log';
import { TxOptions } from '../types';

/**
 * @returns true if role was added, false if was already added or throw an error if failed.
 */
export async function cmdAddAgent(
  addressAlias: string,
  target: string,
  wallet: string,
  chainConfig: ChainConfig,
  options: TxOptions,
): Promise<boolean> {
  const address = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(addressAlias);

  const agentRoleOwner =
    wallet === 'auto'
      ? await chainConfig.getOwnerWallet(target)
      : chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(wallet);

  const agentRole = await AgentRoleAPI.fromWithOwner(target, agentRoleOwner);
  if (await agentRole.isAgent(address)) {
    logStepInfo(`Address '${addressAlias}' is already an agent of '${target}'`, options);
    return false;
  }

  await AgentRoleAPI.addAgent(agentRole, address, agentRoleOwner, options);

  logStepOK(`Address '${addressAlias}' is now an agent of '${target}'`, options);

  return true;
}
