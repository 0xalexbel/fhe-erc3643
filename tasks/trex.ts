import { scope } from 'hardhat/config';
import { ethers as EthersT } from 'ethers';
import { bigint, string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { clearHistory, loadChainConfig } from './utils';
import { SCOPE_TREX, SCOPE_TREX_NEW_FACTORY, SCOPE_TREX_SETUP } from './task-names';
import { logOK, logJSONResult, logMsgResult } from '../sdk/log';
import { importCliModule, importTypes } from './internal/imp';
import { TxOptions } from '../sdk/types';
import { CmdTREXSetupOutput } from '../sdk/cli/trex';

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

//npx hardhat --network fhevm trex setup
trexScope
  .task(SCOPE_TREX_SETUP)
  .addFlag('unpause', 'Unpause token after creation')
  .addFlag('noProgress', 'Disable progress')
  .addFlag('json', 'Output result in json format')
  .addParam('mint', 'Default mint amount', undefined, bigint)
  .setAction(
    async (
      {
        mint,
        unpause,
        noProgress,
        json,
      }: { mint: bigint; unpause: boolean; noProgress: boolean; json: boolean; stderr: boolean },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/trex');

      if (hre.network.name === 'hardhat') {
        clearHistory(hre);
      }

      const chainConfig = await loadChainConfig(hre, noProgress);

      const options: TxOptions = cmds.cmdTREXSetupTxOptions();
      options.noProgress = noProgress;

      const result: CmdTREXSetupOutput = await cmds.cmdTREXSetup(chainConfig, mint, unpause, options);

      if (json) {
        // Result logs ignore the quiet flag
        logJSONResult(result);
      } else {
        logOK(`New TREX token has been deployed at:`, { quiet: noProgress });
        logMsgResult(`${result.tokenAddress}`);
      }

      return result;
    },
  );
