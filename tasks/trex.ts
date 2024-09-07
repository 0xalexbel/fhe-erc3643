import { scope } from 'hardhat/config';
import { ethers as EthersT } from 'ethers';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadChainConfig } from './utils';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_BALANCE,
  SCOPE_TOKEN_MINT,
  SCOPE_TOKEN_SUPPLY_GET_LIMIT,
  SCOPE_TOKEN_SUPPLY_SET_LIMIT,
  SCOPE_TOKEN_TIME_EXCHANGE_IS_ID,
  SCOPE_TOKEN_TOTAL_SUPPLY,
  SCOPE_TREX,
  SCOPE_TREX_NEW_FACTORY,
  SCOPE_TREX_SETUP,
  SCOPE_TREX_TEST,
} from './task-names';
import { logContractOwner, logDeployOK, logInfo, logMsg, logOK } from '../sdk/log';
import { importCliModule } from './internal/imp';
import { defaultTxOptions } from '../sdk/utils';

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
trexScope.task(SCOPE_TREX_SETUP).setAction(async ({}, hre: HardhatRuntimeEnvironment) => {
  const cmds = await importCliModule('trex', hre);
  const chainConfig = await loadChainConfig(hre);

  const options = defaultTxOptions(37 + 4);
  options.mute = true;

  const output: { tokenAddress: string } = await cmds.cmdTREXSetup(chainConfig, options);

  logOK(`New TREX token has been deployed at ${output.tokenAddress}`);

  return output;
});
//npx hardhat --network fhevm token mint --token 0x15eBd3B03cD7939Ecb07C42a3F127Bd30CF5c770 --user alice --amount 9 --agent token-agent
//npx hardhat token test
trexScope.task(SCOPE_TREX_TEST).setAction(async ({}, hre: HardhatRuntimeEnvironment) => {
  const cmds = await importCliModule('trex', hre);
  const chainConfig = await loadChainConfig(hre);

  const options = defaultTxOptions(37 + 4);
  options.mute = true;

  const output: { tokenAddress: string } = await cmds.cmdTREXSetup(chainConfig, options);

  // // check alice balance
  // const b1 = await hre.run(
  //   { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BALANCE },
  //   { token: output.tokenAddress, user: 'alice' },
  // );

  // // get total supply
  // const l1 = await hre.run({ scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TOTAL_SUPPLY }, { token: output.tokenAddress });
  // // get supply limit
  // const l = await hre.run({ scope: SCOPE_TOKEN, task: SCOPE_TOKEN_SUPPLY_GET_LIMIT }, { token: output.tokenAddress });

  await hre.run(
    { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_IS_ID },
    { token: output.tokenAddress, user: 'alice' },
  );

  // // set supply limit
  // await hre.run(
  //   { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_SUPPLY_SET_LIMIT },
  //   { token: output.tokenAddress, amount: 10n, wallet: 'token-owner' },
  // );

  // // mint to alice account
  // await hre.run(
  //   { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_MINT },
  //   { token: output.tokenAddress, user: 'alice', agent: 'token-agent', amount: 9n },
  // );

  // // check alice balance
  // const b2 = await hre.run(
  //   { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BALANCE },
  //   { token: output.tokenAddress, user: 'alice' },
  // );

  //console.log(b2);
});
