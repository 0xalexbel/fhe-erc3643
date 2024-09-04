import { scope } from 'hardhat/config';
import {
  SCOPE_IDENTITY,
  SCOPE_IDENTITY_ADD_KEY,
  SCOPE_IDENTITY_LIST,
  SCOPE_IDENTITY_KEY_HAS_PURPOSE,
  SCOPE_IDENTITY_NEW,
  SCOPE_IDENTITY_NEW_FACTORY,
  SCOPE_IDENTITY_REMOVE_KEY,
  SCOPE_IDENTITY_SHOW,
} from './task-names';
import { IdentityImplementationAuthorityAPI } from '../sdk/IdentityImplementationAuthorityAPI';
import { string, int, bigint } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import { Progress } from '../sdk/utils';
import {
  getHistoryPath,
  loadAddressFromWalletIndexOrAliasOrAddress,
  loadChainConfig,
  loadKeyAddress,
  loadWalletArgs,
  loadWalletFromIndexOrAliasOrAddressOrPrivateKey,
  logError,
  logInfo,
  logOK,
} from './utils';
import { IdFactoryAPI } from '../sdk/IdFactoryAPI';
import {
  IdentityAPI,
  KEY_PURPOSE_ACTION,
  KEY_PURPOSE_CLAIM,
  KEY_PURPOSE_MANAGEMENT,
  KEY_TYPE_ECDSA,
} from '../sdk/IdentityAPI';
import { TokenAPI } from '../sdk/TokenAPI';
import { TREXFactoryAPI } from '../sdk/TREXFactory';

const identityScope = scope(SCOPE_IDENTITY, 'Manage identities');

//npx hardhat --network fhevm identity list
//npx hardhat --network fhevm identity show --identity 0x406c2b3599da0b3a35044dDb99a4cfe0FA5F6B62
identityScope
  .task(SCOPE_IDENTITY_SHOW)
  .addParam('identity', 'Identity address', undefined, string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    if (!hre.ethers.isAddress(taskArgs.identity)) {
      throw new Error(`Invalid identity address: ${taskArgs.identity}`);
    }

    const identity = IdentityAPI.from(taskArgs.identity, chainConfig.provider);

    const claimKeys = await IdentityAPI.searchPurposeKeys(identity, KEY_PURPOSE_CLAIM, chainConfig);
    const actionKeys = await IdentityAPI.searchPurposeKeys(identity, KEY_PURPOSE_ACTION, chainConfig);
    const managementKeys = await IdentityAPI.searchPurposeKeys(identity, KEY_PURPOSE_MANAGEMENT, chainConfig);

    const res = {
      identity: taskArgs.identity,
      claimKeys,
      actionKeys,
      managementKeys,
    };

    console.log(JSON.stringify(res, null, 2));
  });

//npx hardhat --network fhevm identity new-factory --wallet-index 0
identityScope
  .task(SCOPE_IDENTITY_NEW_FACTORY)
  .setDescription('Create a new Identity factory with a specified owner.')
  .addOptionalParam('wallet', 'Identity factory owner wallet (index, address or private key)', '0', string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const ownerWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    const idFactory = await IdentityImplementationAuthorityAPI.loadOrDeployIdFactory(undefined, ownerWallet, {
      progress: new Progress(3),
      confirms: 1,
      chainConfig,
    });

    return idFactory;
  });

//npx hardhat --network fhevm identity list
identityScope.task(SCOPE_IDENTITY_LIST).setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
  const p = getHistoryPath();
  console.log(`History file: ${p}`);

  const chainConfig = await loadChainConfig(hre, p);

  console.log(chainConfig.toJSON().identities);
});

//npx hardhat --network fhevm identity new --factory 0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7 --wallet alice
identityScope
  .task(SCOPE_IDENTITY_NEW)
  .addParam('wallet', 'New identity management wallet', undefined, string)
  .addOptionalParam('idFactory', 'Identity factory address', undefined, string)
  .addOptionalParam('trexFactory', "Token address (using token's identity factory)", undefined, string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const managementWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    let idFactoryAddress;
    if (taskArgs.trexFactory) {
      const f = TREXFactoryAPI.from(taskArgs.trexFactory, chainConfig.provider);
      idFactoryAddress = await f.getIdFactory();
    } else {
      idFactoryAddress = await taskArgs.idFactory;
    }

    if (!hre.ethers.isAddress(idFactoryAddress)) {
      throw new Error(`Missing factory address, please specify --id-factory or --trex-factory parameter.`);
    }

    const idFactory = IdFactoryAPI.fromSafe(idFactoryAddress, managementWallet);

    // The newly create identity is always created with it's wallet as the initial management key
    const initialManagementKey = managementWallet;

    const identity = await IdFactoryAPI.deployNewIdentity(idFactory, initialManagementKey, managementWallet, {
      progress: new Progress(1),
      confirms: 1,
      chainConfig,
    });

    // Make sure the management wallet is actually the management key
    const ok = await IdentityAPI.isManagementKey(identity, managementWallet);
    if (!ok) {
      throw new Error(`Identity deployement failed. Invalid management key.`);
    }

    logOK(
      `Identity of ${taskArgs.wallet} has been successfully deployed at ${await identity.getAddress()} with the specified managment key ${managementWallet.address}.`,
    );

    return identity;
  });

//npx hardhat --network fhevm identity add-key --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef --wallet alice --key foo-university --purpose 1
identityScope
  .task(SCOPE_IDENTITY_ADD_KEY)
  .addParam('wallet', 'Identity manager wallet', undefined, string)
  .addParam('identity', 'Identity address', undefined, string)
  .addParam('key', 'Key address or wallet index/alias', undefined, string)
  .addParam('purpose', 'Key purpose (1=Management, 2=Action, 3=Claim)', undefined, bigint)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const managerWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);
    const keyAddress = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.key);

    if (!hre.ethers.isAddress(taskArgs.identity)) {
      throw new Error(`Invalid identity address: ${taskArgs.identity}`);
    }

    const identity = IdentityAPI.from(taskArgs.identity, managerWallet);
    if (!(await IdentityAPI.isManagementKey(identity, managerWallet))) {
      logError(
        `Wallet ${managerWallet.address} does not have the right permission to add a new key to identity ${taskArgs.identity}`,
      );
      return;
    }

    if (await IdentityAPI.keyHasPurpose(identity, keyAddress, taskArgs.purpose)) {
      logInfo(`Key ${taskArgs.key} is already a key of identity ${taskArgs.identity} with purpose ${taskArgs.purpose}`);
      return;
    }

    await IdentityAPI.addKey(identity, keyAddress, taskArgs.purpose, KEY_TYPE_ECDSA, managerWallet, {
      progress: new Progress(1),
      confirms: 1,
      chainConfig,
    });

    logOK(
      `Key ${taskArgs.key} is a new management key of identity ${taskArgs.identity} with purpose ${taskArgs.purpose}`,
    );
  });

//npx hardhat --network fhevm identity remove-key --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef --wallet alice --key foo-university --purpose 1
identityScope
  .task(SCOPE_IDENTITY_REMOVE_KEY)
  .addParam('wallet', 'Identity manager wallet', undefined, string)
  .addParam('identity', 'Identity address', undefined, string)
  .addParam('key', 'Key address or wallet index to check', undefined, string)
  .addParam('purpose', 'Key purpose (1=Management, 2=Action, 3=Claim)', undefined, bigint)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const managerWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);
    const keyAddress = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.key);

    if (!hre.ethers.isAddress(taskArgs.identity)) {
      throw new Error(`Invalid identity address: ${taskArgs.identity}`);
    }

    const identity = IdentityAPI.from(taskArgs.identity, managerWallet);
    if (!(await IdentityAPI.isManagementKey(identity, managerWallet))) {
      logError(
        `Wallet ${managerWallet.address} does not have the right permission to remove a key from identity ${taskArgs.identity}`,
      );
      return;
    }

    if (!(await IdentityAPI.keyHasPurpose(identity, keyAddress, taskArgs.purpose))) {
      logInfo(`Key ${taskArgs.key} is not a key of identity ${taskArgs.identity} with purpose ${taskArgs.purpose}`);
      return;
    }

    await IdentityAPI.removeKey(identity, keyAddress, taskArgs.purpose, managerWallet, {
      progress: new Progress(1),
      confirms: 1,
      chainConfig,
    });

    logOK(`Key ${taskArgs.key} with purpose ${taskArgs.purpose} has been removed from identity ${taskArgs.identity}`);
  });

//npx hardhat --network fhevm identity key-has-purpose --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef --key foo-university --purpose 1
identityScope
  .task(SCOPE_IDENTITY_KEY_HAS_PURPOSE)
  .addParam('identity', 'Identity address', undefined, string)
  .addParam('key', 'Key address or wallet index to check', undefined, string)
  .addParam('purpose', 'Key purpose (1 = MANAGER, 2 = ACTION, 3 = CLAIM)', undefined, int)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const keyAddress = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.key);

    if (!hre.ethers.isAddress(taskArgs.identity)) {
      throw new Error(`Invalid identity address: ${taskArgs.identity}`);
    }

    const identity = IdentityAPI.from(taskArgs.identity, chainConfig.provider);

    const res = await IdentityAPI.keyHasPurpose(identity, keyAddress, taskArgs.purpose, chainConfig.provider);

    if (res) {
      logOK(
        `key ${taskArgs.key} with purpose ${taskArgs.purpose} is a registered key of identity ${taskArgs.identity}`,
      );
    } else {
      logInfo(
        `key ${taskArgs.key} with purpose ${taskArgs.purpose} is not a registered key of identity ${taskArgs.identity}`,
      );
    }
  });
