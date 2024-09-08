import { scope } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadChainConfig } from './utils';
import { SCOPE_IDENTITY, SCOPE_IDENTITY_NEW } from './task-names';
import { importCliModule } from './internal/imp';
import { FheERC3643Error } from '../sdk/errors';

const identityScope = scope(SCOPE_IDENTITY, 'Manage identities');

identityScope
  .task(SCOPE_IDENTITY_NEW)
  .setDescription('Creates a new identity managed by a specified wallet and added to a given identity factory')
  .addParam('wallet', 'New identity management wallet', undefined, string)
  .addParam('factory', 'Identity factory address', undefined, string)
  .addOptionalParam('type', 'id/trex', 'id', string)
  .setAction(
    async (
      { wallet, factory, type }: { wallet: string; factory: string; type: string },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('identity', hre);
      const chainConfig = await loadChainConfig(hre);

      if (type !== 'id' && type !== 'trex') {
        throw new FheERC3643Error(`Unknown --factory-type option value, got '${type}', was expecting 'id' or 'trex'`);
      }

      return await cmds.cmdIdentityNew(wallet, factory, type, chainConfig);
    },
  );
