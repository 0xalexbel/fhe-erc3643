import { scope } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadChainConfig } from './utils';
import { SCOPE_IDENTITY, SCOPE_IDENTITY_NEW, SCOPE_IDENTITY_SHOW } from './task-names';
import { importCliModule, importTypes } from './internal/imp';
import { FheERC3643Error } from '../sdk/errors';
import { defaultTxOptions, logJSONResult, logOK, LogOptions } from '../sdk/log';

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
      await importTypes(hre);
      const cmds = await import('../sdk/cli/identity');
      const chainConfig = await loadChainConfig(hre);

      if (type !== 'id' && type !== 'trex') {
        throw new FheERC3643Error(`Unknown --factory-type option value, got '${type}', was expecting 'id' or 'trex'`);
      }

      const options = defaultTxOptions(1);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdIdentityNew(wallet, factory, type, chainConfig, options);

      return res;
    },
  );

identityScope
  .task(SCOPE_IDENTITY_SHOW)
  .setDescription('Tries to resolve an identity address given a wallet address')
  .addParam('wallet', 'The wallet of an identity manager', undefined, string)
  .addFlag('json', 'Output in json format')
  .addOptionalParam('token', 'A token where the identity should be registered', undefined, string)
  .setAction(
    async (
      { wallet, token, json }: { wallet: string; token: string; json: boolean },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/identity');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdIdentityShow(wallet, token, chainConfig, options);

      if (json) {
        logJSONResult(res);
      } else {
        logOK(`address          : ${res.address}`, lo);
        logOK(`version          : ${res.version}`, lo);
      }

      return res;
    },
  );
