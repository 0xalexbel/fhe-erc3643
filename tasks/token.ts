import assert from 'assert';
import { ethers as EthersT } from 'ethers';
import { scope } from 'hardhat/config';
import { bigint, inputFile, string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadChainConfig } from './utils';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_BALANCE,
  SCOPE_TOKEN_BURN,
  SCOPE_TOKEN_FREEZE,
  SCOPE_TOKEN_FROZEN_TOKENS,
  SCOPE_TOKEN_IS_PAUSED,
  SCOPE_TOKEN_MINT,
  SCOPE_TOKEN_NEW,
  SCOPE_TOKEN_PAUSE,
  SCOPE_TOKEN_SUPPLY_GET_LIMIT,
  SCOPE_TOKEN_SUPPLY_SET_LIMIT,
  SCOPE_TOKEN_TIME_EXCHANGE_ADD_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_IS_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_REMOVE_ID,
  SCOPE_TOKEN_TOTAL_SUPPLY,
  SCOPE_TOKEN_TRANSFER,
  SCOPE_TOKEN_UNFREEZE,
  SCOPE_TOKEN_UNPAUSE,
} from './task-names';
import { importCliModule } from './internal/imp';
import { defaultTxOptions } from '../sdk/utils';

const tokenScope = scope(SCOPE_TOKEN, 'Manage TREX Token');

//npx hardhat --network fhevm token new --config-file ./megalodon.token.json --owner super-bank --trex-factory 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e --wallet admin --salt MegToken
tokenScope
  .task(SCOPE_TOKEN_NEW)
  .setDescription('(Advanced) Creates a new TREX token using a config file')
  .addParam('configFile', 'New Token config file', undefined, inputFile)
  .addParam('owner', 'New Token owner address (index/alias/address)', undefined, string)
  .addParam('trexFactory', 'Address of the TREX factory', undefined, string)
  .addParam('salt', 'New Token salt', undefined, string)
  .addOptionalParam('wallet', 'TREX factory owner wallet (index/alias/address/private key or "auto")', 'auto', string)
  .setAction(
    async (
      {
        configFile,
        owner,
        trexFactory,
        salt,
        wallet,
      }: { configFile: string; owner: string; trexFactory: string; salt: string; wallet: string },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('token', hre);
      const chainConfig = await loadChainConfig(hre);

      const token: EthersT.AddressLike = await cmds.cmdTokenNew(
        configFile,
        owner,
        trexFactory,
        salt,
        wallet,
        chainConfig,
        false,
      );

      return token;
    },
  );

//npx hardhat --network fhevm token balance --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice
tokenScope
  .task(SCOPE_TOKEN_BALANCE)
  .setDescription('Displays the token balance of a given user')
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The address or wallet index/alias of the user', undefined, string)
  .setAction(async ({ token, user }: { token: string; user: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('token', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(2);
    options.mute = true;

    return await cmds.cmdTokenBalance(token, user, chainConfig, options);
  });

//npx hardhat --network fhevm token mint --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice --agent "token-agent" --amount 100
tokenScope
  .task(SCOPE_TOKEN_MINT)
  .setDescription('Mints a specified amount of tokens to by a given user (agent only)')
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The address or wallet index/alias of the user', undefined, string)
  .addParam('agent', 'The address or wallet index/alias of a token agent', undefined, string)
  .addParam('amount', 'The token amount to mint', undefined, bigint)
  .setAction(
    async (
      { token, user, agent, amount }: { token: string; user: string; agent: string; amount: bigint },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('token', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      options.mute = true;

      return await cmds.cmdTokenMint(token, user, agent, amount, chainConfig, options);
    },
  );

//npx hardhat --network fhevm token burn --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice --agent "token-agent" --amount 30
tokenScope
  .task(SCOPE_TOKEN_BURN)
  .setDescription('Burns a specified amount of tokens owned by a given user (agent only)')
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The address or wallet index/alias of the user', undefined, string)
  .addParam('agent', 'The address or wallet index/alias of a token agent', undefined, string)
  .addParam('amount', 'The token amount to mint', undefined, bigint)
  .setAction(
    async (
      { token, user, agent, amount }: { token: string; user: string; agent: string; amount: bigint },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('token', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      options.mute = true;

      return await cmds.cmdTokenBurn(token, user, agent, amount, chainConfig, options);
    },
  );

//npx hardhat --network fhevm token freeze --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice --agent "token-agent" --amount 2
tokenScope
  .task(SCOPE_TOKEN_FREEZE)
  .setDescription('Freezes a specified amount of tokens owned by a given user (agent only)')
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The address or wallet index/alias of the user', undefined, string)
  .addParam('agent', 'The address or wallet index/alias of a token agent', undefined, string)
  .addParam('amount', 'The token amount to mint', undefined, bigint)
  .setAction(
    async (
      { token, user, agent, amount }: { token: string; user: string; agent: string; amount: bigint },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('token', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      options.mute = true;

      return await cmds.cmdTokenFreeze(token, user, agent, amount, chainConfig, options);
    },
  );

//npx hardhat --network fhevm token unfreeze --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice --agent "token-agent" --amount 2
tokenScope
  .task(SCOPE_TOKEN_UNFREEZE)
  .setDescription('Unfreezes a specified amount of tokens owned by a given user (agent only)')
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The address or wallet index/alias of the user', undefined, string)
  .addParam('agent', 'The address or wallet index/alias of a token agent', undefined, string)
  .addParam('amount', 'The token amount to mint', undefined, bigint)
  .setAction(
    async (
      { token, user, agent, amount }: { token: string; user: string; agent: string; amount: bigint },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('token', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      options.mute = true;

      return await cmds.cmdTokenUnfreeze(token, user, agent, amount, chainConfig, options);
    },
  );

//npx hardhat --network fhevm token frozen-tokens --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice
tokenScope
  .task(SCOPE_TOKEN_FROZEN_TOKENS)
  .setDescription('Displays the amount of frozen tokens of a specified user')
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The address or wallet index/alias of the user', undefined, string)
  .setAction(async ({ token, user }: { token: string; user: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('token', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(2);
    options.mute = true;

    return await cmds.cmdTokenFrozenTokens(token, user, chainConfig, options);
  });

// npx hardhat --network fhevm token pause --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --agent token-agent
tokenScope
  .task(SCOPE_TOKEN_PAUSE)
  .setDescription('Pause token (agent only)')
  .addParam('token', 'Token address', undefined, string)
  .addParam('agent', 'The address or wallet index/alias of a token agent', undefined, string)
  .setAction(async ({ token, agent }: { token: string; agent: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('token', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(1);
    options.mute = true;

    return await cmds.cmdTokenPause(token, agent, chainConfig, options);
  });

// npx hardhat --network fhevm token unpause --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --agent token-agent
tokenScope
  .task(SCOPE_TOKEN_UNPAUSE)
  .setDescription('Unpause token (agent only)')
  .addParam('token', 'Token address', undefined, string)
  .addParam('agent', 'The address or wallet index/alias of a token agent', undefined, string)
  .setAction(async ({ token, agent }: { token: string; agent: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('token', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(1);
    options.mute = true;

    return await cmds.cmdTokenUnpause(token, agent, chainConfig, options);
  });

// npx hardhat --network fhevm token is-paused --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4
tokenScope
  .task(SCOPE_TOKEN_IS_PAUSED)
  .setDescription('Check whether the token is paused or not')
  .addParam('token', 'Token address', undefined, string)
  .setAction(async ({ token }: { token: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('token', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(1);
    options.mute = !true;

    return await cmds.cmdTokenIsPaused(token, chainConfig, options);
  });

//npx hardhat --network fhevm token transfer --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet alice --to bob
tokenScope
  .task(SCOPE_TOKEN_TRANSFER)
  .setDescription('Transfers a specified amount of tokens from one user to another')
  .addParam('token', 'Token address', undefined, string)
  .addParam('wallet', 'The wallet index/alias of the owner of the tokens to transfer', undefined, string)
  .addParam('to', 'The address or wallet index/alias of the user who will receive the tokens', undefined, string)
  .setAction(
    async ({ token, wallet, to }: { token: string; wallet: string; to: string }, hre: HardhatRuntimeEnvironment) => {
      const cmds = await importCliModule('token', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      options.mute = true;

      return await cmds.cmdTokenTransfer(token, wallet, to, chainConfig, options);
    },
  );

tokenScope
  .task(SCOPE_TOKEN_TOTAL_SUPPLY)
  .setDescription('Displays token total supply')
  .addParam('token', 'Token address', undefined, string)
  .setAction(async ({ token }: { token: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('token', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(2);
    options.mute = true;

    return await cmds.cmdTokenTotalSupply(token, chainConfig, options);
  });

tokenScope
  .task(SCOPE_TOKEN_SUPPLY_GET_LIMIT)
  .setDescription('Displays token supply limit')
  .addParam('token', 'Token address', undefined, string)
  .setAction(async ({ token }: { token: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('supplylimit', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(2);
    options.mute = true;

    return await cmds.cmdTokenGetSupplyLimit(token, chainConfig, options);
  });

tokenScope
  .task(SCOPE_TOKEN_SUPPLY_SET_LIMIT)
  .setDescription('Set the token supply limit with the specified amount')
  .addParam('token', 'Token address', undefined, string)
  .addParam('wallet', 'wallet', undefined, string)
  .addParam('amount', 'The desired token supply limit', undefined, bigint)
  .setAction(
    async (
      { token, wallet, amount }: { token: string; wallet: string; amount: bigint },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('supplylimit', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      options.mute = true;

      return await cmds.cmdTokenSetSupplyLimit(token, amount, wallet, chainConfig, options);
    },
  );

tokenScope
  .task(SCOPE_TOKEN_TIME_EXCHANGE_IS_ID)
  .setDescription('Checks if an identity is tagged as an exchange ID')
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The wallet index/alias associated to the identity being checked', undefined, string)
  .setAction(async ({ token, user }: { token: string; user: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('timeexchange', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(1);
    options.mute = true;

    return await cmds.cmdTokenTimeExchangeIsId(token, user, chainConfig, options);
  });

tokenScope
  .task(SCOPE_TOKEN_TIME_EXCHANGE_ADD_ID)
  .setDescription('Tags an identity as being an exchange ID')
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The wallet index/alias associated to the identity to tag', undefined, string)
  .setAction(async ({ token, user }: { token: string; user: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('timeexchange', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(1);
    options.mute = true;

    return await cmds.cmdTokenTimeExchangeAddId(token, user, 'token-owner', chainConfig, options);
  });

tokenScope
  .task(SCOPE_TOKEN_TIME_EXCHANGE_REMOVE_ID)
  .setDescription('Untags an identity as being an exchange ID')
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The wallet index/alias associated to the identity to untag', undefined, string)
  .setAction(async ({ token, user }: { token: string; user: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('timeexchange', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(1);
    options.mute = true;

    return await cmds.cmdTokenTimeExchangeRemoveId(token, user, 'token-owner', chainConfig, options);
  });

// transfer
// forcedtransfer (onlyAgent)
// freeze-user (onlyAgent)
// unfreeze-user (onlyAgent)
// transfer-from
// approve --spender <addr> --amount <v>
// set eexchange limit
