import { scope } from 'hardhat/config';
import { ethers as EthersT } from 'ethers';
import { bigint, string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadChainConfig } from './utils';
import { SCOPE_TREX, SCOPE_TREX_NEW_FACTORY, SCOPE_TREX_SETUP } from './task-names';
import { logContractOwner, logDeployOK, logOK } from '../sdk/log';
import { importCliModule } from './internal/imp';

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

    await logDeployOK('TREX factory identity registry', ouput.idFactory);
    await logContractOwner('TREX factory', ouput.factory, chainConfig);

    return ouput;
  });

//npx hardhat --network fhevm trex setup --wallet admin
trexScope
  .task(SCOPE_TREX_SETUP)
  .addOptionalParam('mint', 'Default mint amount', 0n, bigint)
  .addFlag('unpause', 'Unpause token after creation')
  .setAction(async ({ mint, unpause }: { mint: bigint; unpause: boolean }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('trex', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = cmds.cmdTREXSetupTxOptions();
    options.mute = true;

    const output: { tokenAddress: string } = await cmds.cmdTREXSetup(chainConfig, mint, unpause, options);

    logOK(`New TREX token has been deployed at ${output.tokenAddress}`);

    return output;
  });
