import { ethers as EthersT } from 'ethers';
import { scope } from 'hardhat/config';
import { bigint, inputFile, int, string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadChainConfig } from './utils';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_ALLOWANCE,
  SCOPE_TOKEN_APPROVE,
  SCOPE_TOKEN_BALANCE,
  SCOPE_TOKEN_BURN,
  SCOPE_TOKEN_DEC_ALLOWANCE,
  SCOPE_TOKEN_DECRYPT,
  SCOPE_TOKEN_EXCHANGE_MONTHLY_ADD_ID,
  SCOPE_TOKEN_EXCHANGE_MONTHLY_GET_MONTHLY_COUNTER,
  SCOPE_TOKEN_EXCHANGE_MONTHLY_IS_ID,
  SCOPE_TOKEN_EXCHANGE_MONTHLY_REMOVE_ID,
  SCOPE_TOKEN_EXCHANGE_MONTHLY_SET_EXCHANGE_LIMIT,
  SCOPE_TOKEN_FREEZE,
  SCOPE_TOKEN_FROZEN_TOKENS,
  SCOPE_TOKEN_INC_ALLOWANCE,
  SCOPE_TOKEN_IS_PAUSED,
  SCOPE_TOKEN_MINT,
  SCOPE_TOKEN_NEW,
  SCOPE_TOKEN_PAUSE,
  SCOPE_TOKEN_SHOW,
  SCOPE_TOKEN_SUPPLY_GET_LIMIT,
  SCOPE_TOKEN_SUPPLY_SET_LIMIT,
  SCOPE_TOKEN_TIME_EXCHANGE_ADD_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_GET_LIMITS,
  SCOPE_TOKEN_TIME_EXCHANGE_IS_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_REMOVE_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_SET_LIMITS,
  SCOPE_TOKEN_TOTAL_SUPPLY,
  SCOPE_TOKEN_TRANSFER,
  SCOPE_TOKEN_UNFREEZE,
  SCOPE_TOKEN_UNPAUSE,
} from './task-names';
import { importCliModule, importTypes } from './internal/imp';
import { defaultTxOptions, logJSONResult, logOK, LogOptions } from '../sdk/log';

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

//npx hardhat --network fhevm token show
tokenScope
  .task(SCOPE_TOKEN_SHOW)
  .setDescription('Displays the token address')
  .addOptionalPositionalParam(
    'addressOrSaltOrNameOrSymbol',
    'Token name/symbol/salt/address or last deployed',
    undefined,
    string,
  )
  .setAction(
    async (
      { addressOrSaltOrNameOrSymbol }: { addressOrSaltOrNameOrSymbol?: string },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/token');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      const lo: LogOptions = { quiet: options.noProgress };

      const token = await cmds.cmdTokenShow(addressOrSaltOrNameOrSymbol, chainConfig, options);

      logOK(`address          : ${token.address}`, lo);
      logOK(`name             : ${token.name}`, lo);
      logOK(`symbol           : ${token.symbol}`, lo);
      logOK(`owner alias      : ${token.ownerAlias.join(',')}`, lo);
      logOK(`owner            : ${token.owner}`, lo);
      logOK(`identity         : ${token.identity}`, lo);
      logOK(`identityRegistry : ${token.identityRegistry}`, lo);
      logOK(`agents alias     : ${token.agents.map(v => v.alias.names).join(',')}`, lo);
      logOK(`agents           : ${token.agents.map(v => v.address).join(',')}`, lo);
      logOK(`paused           : ${token.paused}`, lo);
      logOK(`TREXFactory      : ${token.factory}`, lo);

      return token;
    },
  );

//npx hardhat --network fhevm token balance --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice
//npx hardhat --network fhevm token balance --token MEGALODON --user alice
tokenScope
  .task(SCOPE_TOKEN_BALANCE)
  .setDescription('Displays the token balance of a given user')
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .addParam('user', 'The address or wallet index/alias of the user', undefined, string)
  .addFlag('json', 'Output in json format')
  .setAction(
    async ({ token, user, json }: { token: string; user: string; json: boolean }, hre: HardhatRuntimeEnvironment) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/token');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      options.noProgress = true;
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTokenBalance(token, user, chainConfig, options);

      if (json) {
        logJSONResult(res);
      } else {
        logOK(`user              : ${res.userWalletAlias}`, lo);
        logOK(`user address      : ${res.userAddress}`, lo);
        logOK(`decrypted balance : ${res.value}`, lo);
        logOK(`fhevm handle      : ${res.fhevmHandle}`, lo);
        logOK(`token             : ${res.tokenAddress}`, lo);
        logOK(`token name        : ${res.tokenName}`, lo);
      }

      return res;
    },
  );

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

      return cmds.cmdTokenMint(token, user, agent, amount, chainConfig, options);
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

    return await cmds.cmdTokenIsPaused(token, chainConfig, options);
  });

//npx hardhat --network fhevm token transfer --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet alice --to bob --amount 10n
tokenScope
  .task(SCOPE_TOKEN_TRANSFER)
  .setDescription('Transfers a specified amount of tokens from one user to another')
  .addParam('token', 'Token address', undefined, string)
  .addParam('wallet', 'The wallet index/alias of the owner of the tokens to transfer', undefined, string)
  .addParam('to', 'The address or wallet index/alias of the user who will receive the tokens', undefined, string)
  .addParam('amount', 'The amount of tokens to transfer', undefined, bigint)
  .setAction(
    async (
      { token, wallet, to, amount }: { token: string; wallet: string; to: string; amount: bigint },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('token', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);

      return await cmds.cmdTokenTransfer(token, wallet, to, amount, chainConfig, options);
    },
  );

tokenScope
  .task(SCOPE_TOKEN_TOTAL_SUPPLY)
  .setDescription('Displays token total supply')
  .addOptionalPositionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .setAction(async ({ token }: { token: string }, hre: HardhatRuntimeEnvironment) => {
    await importTypes(hre);
    const cmds = await import('../sdk/cli/token');
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(2);
    const lo: LogOptions = { quiet: options.noProgress };

    const res = await cmds.cmdTokenTotalSupply(token, chainConfig, options);

    logOK(`decrypted total supply : ${res.value}`, lo);
    logOK(`fhevm handle           : ${res.fhevmHandle}`, lo);
    logOK(`token                  : ${await res.token.getAddress()}`, lo);
    logOK(`token name             : ${await res.token.name()}`, lo);

    return res;
  });

tokenScope
  .task(SCOPE_TOKEN_SUPPLY_GET_LIMIT)
  .setDescription('Displays token supply limit')
  .addParam('token', 'Token address', undefined, string)
  .setAction(async ({ token }: { token: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('supplylimit', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(2);

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

    return await cmds.cmdTokenTimeExchangeIsId(token, user, chainConfig, options);
  });

tokenScope
  .task(SCOPE_TOKEN_TIME_EXCHANGE_ADD_ID)
  .setDescription('Tags an identity as being an exchange ID (token owner only)')
  .addParam('token', 'Token address', undefined, string)
  .addParam('owner', 'The address or wallet index/alias of the token owner', undefined, string)
  .addParam('user', 'The wallet index/alias associated to the identity to tag', undefined, string)
  .setAction(
    async ({ token, owner, user }: { token: string; owner: string; user: string }, hre: HardhatRuntimeEnvironment) => {
      const cmds = await importCliModule('timeexchange', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);

      return await cmds.cmdTokenTimeExchangeAddId(token, user, owner, chainConfig, options);
    },
  );

tokenScope
  .task(SCOPE_TOKEN_TIME_EXCHANGE_REMOVE_ID)
  .setDescription('Untags an identity as being an exchange ID (token owner only)')
  .addParam('token', 'Token address', undefined, string)
  .addParam('owner', 'The address or wallet index/alias of the token owner', undefined, string)
  .addParam('user', 'The wallet index/alias associated to the identity to untag', undefined, string)
  .setAction(
    async ({ token, owner, user }: { token: string; owner: string; user: string }, hre: HardhatRuntimeEnvironment) => {
      const cmds = await importCliModule('timeexchange', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);

      return await cmds.cmdTokenTimeExchangeRemoveId(token, user, owner, chainConfig, options);
    },
  );

tokenScope
  .task(SCOPE_TOKEN_TIME_EXCHANGE_SET_LIMITS)
  .setDescription(
    'Sets the limit of tokens allowed to be transferred to the given exchangeID in a given period of time (agent only)',
  )
  .addParam('token', 'Token address', undefined, string)
  .addParam('agent', 'The address or wallet index/alias of a token agent', undefined, string)
  .addParam('user', 'The wallet index/alias associated to the identity', undefined, string)
  .addParam('time', 'The time limit', undefined, int)
  .addParam('value', 'The value limit', undefined, bigint)
  .setAction(
    async (
      { token, agent, user, time, value }: { token: string; agent: string; user: string; time: number; value: number },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('timeexchange', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);

      return await cmds.cmdTokenTimeExchangeSetLimits(token, user, time, value, agent, chainConfig, options);
    },
  );

tokenScope
  .task(SCOPE_TOKEN_TIME_EXCHANGE_GET_LIMITS)
  .setDescription(
    'Gets the limit of tokens allowed to be transferred to the given exchangeID in a given period of time',
  )
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The wallet index/alias associated to the identity', undefined, string)
  .setAction(async ({ token, user }: { token: string; user: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('timeexchange', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(2);

    return await cmds.cmdTokenTimeExchangeGetLimits(token, user, chainConfig, options);
  });

////////////////////////////////////////////////////////////////////////////////

tokenScope
  .task(SCOPE_TOKEN_EXCHANGE_MONTHLY_IS_ID)
  .setDescription('Checks if an identity is tagged as an exchange ID')
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'The wallet index/alias associated to the identity being checked', undefined, string)
  .setAction(async ({ token, user }: { token: string; user: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('exchangemonthly', hre);
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(1);

    return await cmds.cmdTokenExchangeMonthlyIsId(token, user, chainConfig, options);
  });

tokenScope
  .task(SCOPE_TOKEN_EXCHANGE_MONTHLY_ADD_ID)
  .setDescription('Tags an identity as being an exchange ID (token owner only)')
  .addParam('token', 'Token address', undefined, string)
  .addParam('owner', 'The address or wallet index/alias of the token owner', undefined, string)
  .addParam('user', 'The wallet index/alias associated to the identity to tag', undefined, string)
  .setAction(
    async ({ token, owner, user }: { token: string; owner: string; user: string }, hre: HardhatRuntimeEnvironment) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/exchangemonthly');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);

      return await cmds.cmdTokenExchangeMonthlyAddId(token, user, owner, chainConfig, options);
    },
  );

tokenScope
  .task(SCOPE_TOKEN_EXCHANGE_MONTHLY_REMOVE_ID)
  .setDescription('Untags an identity as being an exchange ID (token owner only)')
  .addParam('token', 'Token address', undefined, string)
  .addParam('owner', 'The address or wallet index/alias of the token owner', undefined, string)
  .addParam('user', 'The wallet index/alias associated to the identity to untag', undefined, string)
  .setAction(
    async ({ token, owner, user }: { token: string; owner: string; user: string }, hre: HardhatRuntimeEnvironment) => {
      const cmds = await importCliModule('exchangemonthly', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);

      return await cmds.cmdTokenExchangeMonthlyRemoveId(token, user, owner, chainConfig, options);
    },
  );

tokenScope
  .task(SCOPE_TOKEN_EXCHANGE_MONTHLY_GET_MONTHLY_COUNTER)
  .setDescription('Gets the current monthly counter of investorID on exchangeID exchange')
  .addParam('token', 'Token address', undefined, string)
  .addParam('investorId', 'The address or wallet index/alias of the investor identity', undefined, string)
  .addParam('exchangeId', 'The address or wallet index/alias of the exchange identity', undefined, string)
  .addFlag('decrypt', 'Displays the decrypted value')
  .setAction(
    async (
      {
        token,
        investorId,
        exchangeId,
        decrypt,
      }: { token: string; investorId: string; exchangeId: string; decrypt: boolean },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('exchangemonthly', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);

      const res = await cmds.cmdTokenExchangeMonthlyGetMonthlyCounter(
        token,
        investorId,
        exchangeId,
        chainConfig,
        options,
      );

      if (decrypt) {
        console.log(res.value);
      } else {
        console.log(res.handle);
      }

      return res;
    },
  );

tokenScope
  .task(SCOPE_TOKEN_EXCHANGE_MONTHLY_SET_EXCHANGE_LIMIT)
  .setDescription('Sets the current monthly limit on exchangeID exchange')
  .addParam('token', 'Token address', undefined, string)
  .addParam('exchangeId', 'The address or wallet index/alias of the exchange identity', undefined, string)
  .addParam('limit', 'The limit', undefined, bigint)
  .addParam('owner', 'The address or wallet index/alias of a token owner', undefined, string)
  .setAction(
    async (
      { token, exchangeId, limit, owner }: { token: string; exchangeId: string; limit: bigint; owner: string },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const cmds = await importCliModule('exchangemonthly', hre);
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);

      const res = await cmds.cmdTokenSetExchangeMonthlyLimit(token, exchangeId, limit, owner, chainConfig, options);

      console.log(res);

      return res;
    },
  );

//Decrease the calling contract’s allowance toward spender by requestedDecrease. If token returns no value, non-reverting calls are assumed to be successful.
//Increase the calling contract’s allowance toward spender by value. If token returns no value, non-reverting calls are assumed to be successful.
//npx hardhat --network fhevm token mint --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice --agent "token-agent" --amount 100
tokenScope
  .task(SCOPE_TOKEN_ALLOWANCE)
  .setDescription(
    'Returns the remaining number of tokens that spender will be allowed to spend on behalf of owner through transferFrom. This is zero by default.',
  )
  .addOptionalParam('token', 'Token address/salt/name/symbol or latest deployed if not specified', undefined, string)
  .addParam('owner', 'The address or wallet index/alias of the owner', undefined, string)
  .addParam('spender', 'The address or wallet index/alias of the spender', undefined, string)
  .setAction(
    async (
      { token, owner, spender }: { token: string | undefined; owner: string; spender: string },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/token');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTokenAllowance(token, owner, spender, chainConfig, options);

      logOK(`allowance          : ${res.value}`, lo);
      logOK(`fhevm handle       : ${res.fhevmHandle}`, lo);
      logOK(`owner              : ${res.ownerAlias}`, lo);
      logOK(`owner address      : ${res.ownerAddress}`, lo);
      logOK(`spender            : ${res.spenderAddressAlias}`, lo);
      logOK(`spender address    : ${res.spenderAddress}`, lo);
      logOK(`token              : ${await res.token.getAddress()}`, lo);
      logOK(`token name         : ${await res.token.name()}`, lo);

      return res;
    },
  );

tokenScope
  .task(SCOPE_TOKEN_APPROVE)
  .setDescription("Sets a value amount of tokens as the allowance of spender over the caller's tokens.")
  .addOptionalParam('token', 'Token address/salt/name/symbol or latest deployed if not specified', undefined, string)
  .addParam('caller', 'The address or wallet index/alias of the caller', undefined, string)
  .addParam('spender', 'The address or wallet index/alias of the spender', undefined, string)
  .addParam('amount', 'The amount of approved tokens', undefined, bigint)
  .setAction(
    async (
      {
        token,
        caller,
        spender,
        amount,
      }: { token: string | undefined; caller: string; spender: string; amount: bigint },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/token');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTokenApprove(token, caller, spender, amount, chainConfig, options);

      logOK(`amount             : ${res.value}`, lo);
      logOK(`fhevm handle       : ${res.fhevmHandle}`, lo);
      logOK(`owner              : ${res.ownerAlias}`, lo);
      logOK(`owner address      : ${res.ownerAddress}`, lo);
      logOK(`spender            : ${res.spenderAddressAlias}`, lo);
      logOK(`spender address    : ${res.spenderAddress}`, lo);
      logOK(`token              : ${await res.token.getAddress()}`, lo);
      logOK(`token name         : ${await res.token.name()}`, lo);

      return res;
    },
  );

tokenScope
  .task(SCOPE_TOKEN_INC_ALLOWANCE)
  .setDescription(
    "Increase the calling contract's allowance toward spender by value. If token returns no value, non-reverting calls are assumed to be successful.",
  )
  .addOptionalParam('token', 'Token address/salt/name/symbol or latest deployed if not specified', undefined, string)
  .addParam('caller', 'The address or wallet index/alias of the caller', undefined, string)
  .addParam('spender', 'The address or wallet index/alias of the spender', undefined, string)
  .addParam('amount', 'The amount of added approved tokens', undefined, bigint)
  .setAction(
    async (
      {
        token,
        caller,
        spender,
        amount,
      }: { token: string | undefined; caller: string; spender: string; amount: bigint },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/token');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTokenIncreaseAllowance(token, caller, spender, amount, chainConfig, options);

      logOK(`added amount       : ${res.value}`, lo);
      logOK(`fhevm handle       : ${res.fhevmHandle}`, lo);
      logOK(`owner              : ${res.ownerAlias}`, lo);
      logOK(`owner address      : ${res.ownerAddress}`, lo);
      logOK(`spender            : ${res.spenderAddressAlias}`, lo);
      logOK(`spender address    : ${res.spenderAddress}`, lo);
      logOK(`token              : ${await res.token.getAddress()}`, lo);
      logOK(`token name         : ${await res.token.name()}`, lo);

      return res;
    },
  );

tokenScope
  .task(SCOPE_TOKEN_DEC_ALLOWANCE)
  .setDescription(
    "Decrease the calling contract's allowance toward spender by requestedDecrease. If token returns no value, non-reverting calls are assumed to be successful.",
  )
  .addOptionalParam('token', 'Token address/salt/name/symbol or latest deployed if not specified', undefined, string)
  .addParam('caller', 'The address or wallet index/alias of the caller', undefined, string)
  .addParam('spender', 'The address or wallet index/alias of the spender', undefined, string)
  .addParam('amount', 'The amount of added approved tokens', undefined, bigint)
  .setAction(
    async (
      {
        token,
        caller,
        spender,
        amount,
      }: { token: string | undefined; caller: string; spender: string; amount: bigint },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/token');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTokenDecreaseAllowance(token, caller, spender, amount, chainConfig, options);

      logOK(`substracted amount : ${res.value}`, lo);
      logOK(`fhevm handle       : ${res.fhevmHandle}`, lo);
      logOK(`owner              : ${res.ownerAlias}`, lo);
      logOK(`owner address      : ${res.ownerAddress}`, lo);
      logOK(`spender            : ${res.spenderAddressAlias}`, lo);
      logOK(`spender address    : ${res.spenderAddress}`, lo);
      logOK(`token              : ${await res.token.getAddress()}`, lo);
      logOK(`token name         : ${await res.token.name()}`, lo);

      return res;
    },
  );

tokenScope
  .task(SCOPE_TOKEN_DECRYPT)
  .setDescription('Decrypt an FHEVM handle (Debug).')
  .addPositionalParam('handle', 'The FHEVM handle', undefined, string)
  .setAction(async ({ handle }: { handle: string }, hre: HardhatRuntimeEnvironment) => {
    await importTypes(hre);
    const cmds = await import('../sdk/cli/token');
    const chainConfig = await loadChainConfig(hre);

    const options = defaultTxOptions(1);
    const lo: LogOptions = { quiet: options.noProgress };

    const clear = await chainConfig.decrypt64(handle);

    logOK(`clear              : ${clear}`, lo);
    logOK(`fhevm handle       : ${handle}`, lo);

    return clear;
  });

// forcedtransfer (onlyAgent)
// freeze-user (onlyAgent)
// unfreeze-user (onlyAgent)
// transfer-from
// approve --spender <addr> --amount <v>
