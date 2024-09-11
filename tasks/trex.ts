import { scope } from 'hardhat/config';
import { ethers as EthersT } from 'ethers';
import { bigint, string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { clearHistory, loadChainConfig } from './utils';
import { SCOPE_TREX, SCOPE_TREX_NEW_FACTORY, SCOPE_TREX_SETUP } from './task-names';
import { logOK, logMsg } from '../sdk/log';
import { importCliModule, importTypes } from './internal/imp';
import { TxOptions } from '../sdk/types';

const trexScope = scope(SCOPE_TREX, 'Manage TREX factories');

//npx hardhat --network fhevm trex new-factory --wallet admin
trexScope
  .task(SCOPE_TREX_NEW_FACTORY)
  .addOptionalParam('wallet', 'TREX factory owner wallet (index/alias/address/private key)', 'admin', string)
  .setAction(async ({ wallet }: { wallet: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('trex', hre);
    const chainConfig = await loadChainConfig(hre);

    const ouput: {
      idFactory: EthersT.BaseContract;
      authority: EthersT.BaseContract;
      factory: EthersT.BaseContract;
    } = await cmds.cmdTREXNewFactory(wallet, chainConfig);

    // await logStepDeployOK('TREX factory identity registry', ouput.idFactory);
    // await logContractOwner('TREX factory', ouput.factory, chainConfig);

    return ouput;
  });

//npx hardhat --network fhevm trex setup --wallet admin
trexScope
  .task(SCOPE_TREX_SETUP)
  .addFlag('unpause', 'Unpause token after creation')
  .addFlag('quiet', 'Disable progress, displays the meaningful results to stdout')
  .addOptionalParam('mint', 'Default mint amount', 0n, bigint)
  .setAction(
    async (
      { mint, unpause, quiet }: { mint: bigint; unpause: boolean; quiet: boolean },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/trex');

      if (hre.network.name === 'hardhat') {
        clearHistory(hre);
      }

      const chainConfig = await loadChainConfig(hre, { quiet });

      const options: TxOptions = cmds.cmdTREXSetupTxOptions();
      options.quiet = quiet;

      const result: { tokenAddress: string } = await cmds.cmdTREXSetup(chainConfig, mint, unpause, options);

      if (!quiet) {
        logOK(`New TREX token has been deployed at:`, { stderr: true });
      }
      logMsg(`${result.tokenAddress}`);

      return result;
    },
  );
