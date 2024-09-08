import { AgentRoleAPI } from '../AgentRoleAPI';
import { ChainConfig } from '../ChainConfig';
import { logInfo, logOK } from '../log';
import { TxOptions } from '../types';
import { defaultTxOptions } from '../utils';

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
    if (options.mute !== true) {
      logInfo(`Address '${addressAlias}' is already an agent of '${target}'`);
    }
    return false;
  }

  await AgentRoleAPI.addAgent(agentRole, address, agentRoleOwner, options);

  if (options) {
    if (options.mute !== true) {
      logOK(`Address '${addressAlias}' is now an agent of '${target}'`);
    } else {
      if (options.progress) {
        options.progress.logStep(`Address '${addressAlias}' is now an agent of '${target}'`);
      }
    }
  }

  return true;
}
