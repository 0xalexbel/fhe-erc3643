import { scope } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadChainConfig } from './utils';
import { SCOPE_ROLES, SCOPE_ROLES_ADD_AGENT } from './task-names';
import { importCliModule } from './internal/imp';

const rolesScope = scope(SCOPE_ROLES, 'Manage roles');

rolesScope
  .task(SCOPE_ROLES_ADD_AGENT)
  .addPositionalParam('address', 'The address or wallet index of the future agent', undefined, string)
  .addParam('target', 'The contract accepting agents (target must be a Ownable contract)', undefined, string)
  .addOptionalParam('wallet', 'The target owner wallet (index/alias/address/private key or "auto")', 'auto', string)
  .setAction(
    async (
      { address, target, wallet }: { address: string; target: string; wallet: string },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('roles', hre);
      const chainConfig = await loadChainConfig(hre);

      await cmds.cmdAddAgent(address, target, wallet, chainConfig);
    },
  );
