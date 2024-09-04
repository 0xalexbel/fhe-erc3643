import { bigint, inputFile, int, string } from 'hardhat/internal/core/params/argumentTypes';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_ADD_IDENTITY,
  SCOPE_TOKEN_ADD_IDENTITY_AGENT,
  SCOPE_TOKEN_NEW,
  SCOPE_TOKEN_SHOW,
} from './task-names';
import { scope } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import {
  getHistoryPath,
  loadAddressFromWalletIndexOrAliasOrAddress,
  loadChainConfig,
  loadWalletFromIndexOrAliasOrAddressOrPrivateKey,
  logError,
  logInfo,
  logOK,
  throwIfInvalidAddress,
} from './utils';
import { isDeployed, Progress } from '../sdk/utils';
import { TokenConfig } from '../sdk/TokenConfig';
import { TREXFactoryAPI } from '../sdk/TREXFactory';
import { TokenAPI } from '../sdk/TokenAPI';
import { ModularComplianceAPI } from '../sdk/ModuleComplianceAPI';
import { ClaimTopicsRegistryAPI } from '../sdk/ClaimTopicsRegistryAPI';
import { TrustedIssuersRegistryAPI } from '../sdk/TrustedIssuersRegistryAPI';
import { AgentRoleAPI } from '../sdk/AgentRoleAPI';
import { IdentityAPI } from '../sdk/IdentityAPI';

const tokenScope = scope(SCOPE_TOKEN, 'Manage TREX tokens');

//npx hardhat --network fhevm token new --config-file ./megalodon.token.json --owner super-bank --trex-factory 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e --wallet admin --salt MegToken
tokenScope
  .task(SCOPE_TOKEN_NEW)
  .addParam('configFile', 'New Token config file', undefined, inputFile)
  .addParam('owner', 'New Token owner address', undefined, string)
  .addParam('trexFactory', 'Address of the TREX factory', undefined, string)
  .addOptionalParam('salt', 'New Token salt', undefined, string)
  .addOptionalParam('wallet', 'TREX factory owner wallet', 'auto', string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const trexFactoryOwnerWallet =
      taskArgs.wallet === 'auto'
        ? await chainConfig.getOwnerWallet(taskArgs.trexFactory)
        : loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    const trexFactoryAddress = taskArgs.trexFactory;
    if (!hre.ethers.isAddress(trexFactoryAddress)) {
      throw new Error(`Invalid TREX factory address: ${taskArgs.trexFactory}`);
    }
    if (!(await isDeployed(chainConfig.provider, trexFactoryAddress))) {
      throw new Error(`Invalid TREX factory address: ${taskArgs.trexFactory}, the factory is not deployed.`);
    }

    const ownerAddress = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.owner);

    const c = await TokenConfig.load(taskArgs.configFile, chainConfig);
    c.token.owner = ownerAddress;

    if (taskArgs.salt) {
      c.salt = taskArgs.salt;
    }

    const params = TokenConfig.toCallParams(c);

    const trexFactory = await TREXFactoryAPI.fromWithOwner(trexFactoryAddress, trexFactoryOwnerWallet);

    const res = await TREXFactoryAPI.deployTREXSuite(
      trexFactory,
      params.salt,
      params.tokenDetails,
      params.claimDetails,
      trexFactoryOwnerWallet,
      {
        progress: new Progress(12),
        confirms: 1,
        chainConfig,
      },
    );

    console.log(
      JSON.stringify(
        { ...res, config: c },
        (key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2, // return everything else unchanged
      ),
    );

    return res;
  });

//npx hardhat --network fhevm token add-identity --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet token-agent --country 1 --user alice --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef
tokenScope
  .task(SCOPE_TOKEN_ADD_IDENTITY)
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'Identity user wallet address or wallet index to register', undefined, string)
  .addParam('identity', 'Identity address to register', undefined, string)
  .addParam('country', 'Identity country code', undefined, bigint)
  .addParam('wallet', 'Token identity registry agent wallet (index, address or private key)', undefined, string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    throwIfInvalidAddress(taskArgs.token, hre);
    throwIfInvalidAddress(taskArgs.identity, hre);

    const userAddress = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.user);
    const agentWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    const token = TokenAPI.from(taskArgs.token, chainConfig.provider);
    const identity = IdentityAPI.from(taskArgs.identity, chainConfig.provider);

    const alreadyStored = await TokenAPI.hasIdentity(
      token,
      userAddress,
      identity,
      taskArgs.country,
      chainConfig.provider,
    );

    if (alreadyStored) {
      logInfo(
        `Identity ${taskArgs.identity} with user ${taskArgs.user} and country ${taskArgs.country} is already registered by token ${taskArgs.token}`,
      );
      return;
    }

    await TokenAPI.registerIdentity(token, userAddress, identity, taskArgs.country, agentWallet, {
      progress: new Progress(1),
      confirms: 1,
      chainConfig,
    });

    logOK(
      `Identity ${taskArgs.identity} with user ${taskArgs.user} and country ${taskArgs.country} has been successfully added to token ${taskArgs.token}`,
    );
  });

//npx hardhat --network fhevm token show --salt MyAA2 --factory 0x0E801D84Fa97b50751Dbf25036d067dCf18858bF
//npx hardhat --network fhevm token show --salt "My Salt" --factory 0x0E801D84Fa97b50751Dbf25036d067dCf18858bF
tokenScope
  .task(SCOPE_TOKEN_SHOW)
  .addParam('salt', 'Salt of the token to display', undefined, string)
  .addParam('factory', 'TREX factory address where the token is registered', undefined, string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const trexFactory = TREXFactoryAPI.from(taskArgs.factory, chainConfig.provider);
    const tokenSalt = taskArgs.salt;

    const token = await TREXFactoryAPI.tokenFromSalt(trexFactory, tokenSalt, chainConfig.provider);

    if (!token) {
      logError(`Unable to retreive token salt ${tokenSalt}`);
      return;
    }

    const o = {
      address: hre.ethers.ZeroAddress,
      owner: hre.ethers.ZeroAddress,
      name: '',
      symbol: '',
      decimals: 0n,
      identityRegistry: hre.ethers.ZeroAddress,
      identityRegistryStorage: hre.ethers.ZeroAddress,
      identity: hre.ethers.ZeroAddress,
      modularCompliance: hre.ethers.ZeroAddress,
      complianceModules: [] as Array<string>,
      topicsRegistry: hre.ethers.ZeroAddress,
      topics: [] as Array<bigint>,
      trustedIssuersRegistry: hre.ethers.ZeroAddress,
      issuers: {} as Record<string, { topics: Array<bigint> }>,
    };

    o.address = await token.getAddress();
    o.owner = await token.owner();
    o.name = await token.name();
    o.symbol = await token.symbol();
    o.decimals = await token.decimals();
    const ir = await TokenAPI.identityRegistry(token, chainConfig.provider);
    o.identityRegistry = await ir.getAddress();
    o.identityRegistryStorage = await (
      await TokenAPI.identityRegistryStorage(token, chainConfig.provider)
    ).getAddress();
    o.identity = await token.onchainID();
    o.modularCompliance = await token.compliance();
    const mc = ModularComplianceAPI.from(o.modularCompliance, chainConfig.provider);
    o.complianceModules = await mc.getModules();
    o.topicsRegistry = await ir.topicsRegistry();
    const ctr = ClaimTopicsRegistryAPI.from(o.topicsRegistry, chainConfig.provider);
    const topics = await ctr.getClaimTopics();
    o.topics = topics;

    o.trustedIssuersRegistry = await ir.issuersRegistry();
    const tir = TrustedIssuersRegistryAPI.from(o.trustedIssuersRegistry, chainConfig.provider);
    const issuers = await tir.getTrustedIssuers();

    const issuersObj: Record<string, { topics: Array<bigint> }> = {};
    for (let i = 0; i < issuers.length; ++i) {
      const ti = issuers[i];
      const topics = await tir.getTrustedIssuerClaimTopics(ti);
      issuersObj[ti] = { topics: [...topics] };
    }
    o.issuers = issuersObj;

    console.log(
      JSON.stringify(
        o,
        (key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2, // return everything else unchanged
      ),
    );
  });

//npx hardhat --network fhevm token add-identity-agent --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet super-bank super-bank
tokenScope
  .task(SCOPE_TOKEN_ADD_IDENTITY_AGENT)
  .addParam('token', 'Token address', undefined, string)
  .addPositionalParam('address', 'The address or wallet index of the future agent', undefined, string)
  .addOptionalParam('wallet', 'The token identity registry owner wallet', 'auto', string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    throwIfInvalidAddress(taskArgs.token, hre);

    const address = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.address);

    const token = TokenAPI.from(taskArgs.token, chainConfig.provider);

    const ir = await TokenAPI.identityRegistry(token, chainConfig.provider);
    const irAddress = await ir.getAddress();

    const agentRoleOwner =
      taskArgs.wallet === 'auto'
        ? await chainConfig.getOwnerWallet(irAddress)
        : loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    // Will fail if the wallet is not the owner of the token's identity registry
    const agentRole = await AgentRoleAPI.fromWithOwner(irAddress, agentRoleOwner);

    if (await agentRole.isAgent(address)) {
      logInfo(`Address '${taskArgs.address}' is already an agent of the token's identity registry: '${irAddress}'`);
      return;
    }

    await AgentRoleAPI.addAgent(agentRole, address, agentRoleOwner);

    logOK(`Address '${taskArgs.address}' is an agent of the token's identity registry: '${irAddress}'`);
  });
