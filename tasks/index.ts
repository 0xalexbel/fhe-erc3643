import { scope, task } from 'hardhat/config';
import {
  SCOPE_CLAIM,
  SCOPE_CLAIM_ADD,
  SCOPE_CLAIM_ISSUER,
  SCOPE_CLAIM_ISSUER_LIST,
  SCOPE_CLAIM_ISSUER_NEW,
  SCOPE_TREX,
  SCOPE_TREX_INFO,
  SCOPE_TREX_NEW_FACTORY,
  SCOPE_CLAIM_GET,
  SCOPE_CLAIM_REMOVE,
  SCOPE_TOKEN,
  SCOPE_TOKEN_SHOW,
  SCOPE_TOKEN_ADD_IDENTITY,
} from './task-names';
import { string, int, bigint, inputFile } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import { Progress } from '../sdk/utils';
import {
  getHistoryPath,
  loadAddressFromWalletIndexOrAliasOrAddress,
  loadChainConfig,
  loadWalletArgs,
  loadWalletFromIndexOrAliasOrAddressOrPrivateKey,
  logError,
  logOK,
  throwIfInvalidAddress,
} from './utils';
import { TREXImplementationAuthorityAPI } from '../sdk/TRexImplementationAuthorityAPI';
import { ClaimIssuerAPI } from '../sdk/ClaimIssuerAPI';
import { IdentityAPI } from '../sdk/IdentityAPI';
import { toUtf8Bytes } from 'ethers';
import { TokenConfig } from '../sdk/TokenConfig';
import { TokenAPI } from '../sdk/TokenAPI';
import { TREXFactoryAPI } from '../sdk/TREXFactory';
import { ModularComplianceAPI } from '../sdk/ModuleComplianceAPI';
import { ClaimTopicsRegistryAPI } from '../sdk/ClaimTopicsRegistryAPI';
import { TrustedIssuersRegistryAPI } from '../sdk/TrustedIssuersRegistryAPI';

import './identity';
import './modules';
import './roles';
import './token';
import { AgentRoleAPI } from '../sdk/AgentRoleAPI';

const issuerScope = scope(SCOPE_CLAIM_ISSUER, 'Manage claim issuers');
const trexScope = scope(SCOPE_TREX, 'Manage TREX factories');
const claimScope = scope(SCOPE_CLAIM, 'Manage claims');
const tokenScope = scope(SCOPE_TOKEN, 'Manage TREX tokens');

////////////////////////////////////////////////////////////////////////////////
// TREX
////////////////////////////////////////////////////////////////////////////////

//npx hardhat --network fhevm trex new-factory --wallet-index 0
trexScope
  .task(SCOPE_TREX_NEW_FACTORY)
  .addOptionalParam('wallet', 'TREX factory owner wallet (index, address or private key)', '0', string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const ownerWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    const trexFactory = await TREXImplementationAuthorityAPI.loadOrDeployTREXConfig({}, ownerWallet, {
      progress: new Progress(12),
      confirms: 1,
      chainConfig,
    });

    return trexFactory;
  });

//npx hardhat --network fhevm trex info
trexScope.task(SCOPE_TREX_INFO).setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
  const p = getHistoryPath();
  console.log(`History file: ${p}`);

  const chainConfig = await loadChainConfig(hre, p);

  console.log(chainConfig.toJSON());
});

////////////////////////////////////////////////////////////////////////////////
// Claim Issuers
////////////////////////////////////////////////////////////////////////////////

//npx hardhat --network fhevm issuer new --wallet foo-bank
issuerScope
  .task(SCOPE_CLAIM_ISSUER_NEW)
  .addOptionalParam('wallet', 'Claim issuer owner wallet (index, alias, address or private key)', '1', string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const ownerWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    const claimIssuer = await ClaimIssuerAPI.deployNewClaimIssuer(ownerWallet, ownerWallet, {
      progress: new Progress(1),
      confirms: 1,
      chainConfig,
    });

    return claimIssuer;
  });

//npx hardhat --network fhevm issuer info
issuerScope.task(SCOPE_CLAIM_ISSUER_LIST).setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
  const p = getHistoryPath();
  console.log(`History file: ${p}`);

  const chainConfig = await loadChainConfig(hre, p);

  console.log('List of all claim issuers:');
  chainConfig.toJSON().claimIssuers.forEach(v => console.log('  ' + v));
});

//npx hardhat --network fhevm claim add --issuer 0x8464135c8F25Da09e49BC8782676a84730C318bC --wallet foo-university --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef --data "Alice is graduated from Foo University" --topic 10101010000042
claimScope
  .task(SCOPE_CLAIM_ADD)
  .addParam('issuer', 'Claim issuer address', undefined, string)
  .addParam('identity', 'Identity address', undefined, string)
  .addParam('data', 'Claim data', undefined, string)
  .addParam('topic', 'Topic code', undefined, bigint)
  .addParam('wallet', 'Claim issuer wallet', undefined, string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    // issuerWallet is also the issuer's management key
    const issuerWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    if (!hre.ethers.isAddress(taskArgs.issuer)) {
      throw new Error(`Invalid claim issuer address: ${taskArgs.issuer}`);
    }

    if (!hre.ethers.isAddress(taskArgs.identity)) {
      throw new Error(`Invalid identity address: ${taskArgs.identity}`);
    }

    const issuer = await ClaimIssuerAPI.fromManager(taskArgs.issuer, issuerWallet);
    const identity = IdentityAPI.from(taskArgs.identity, chainConfig.provider);

    if (!(await IdentityAPI.isManagementKey(identity, issuerWallet))) {
      logError(`Issuer wallet ${issuerWallet.address} is not a management key of identity ${taskArgs.identity}`);
      return;
    }

    const signedClaim = await ClaimIssuerAPI.createSignedClaim(
      issuer,
      issuerWallet,
      identity,
      toUtf8Bytes(taskArgs.data),
      taskArgs.topic,
    );

    const claimId = await IdentityAPI.addClaim(
      identity,
      signedClaim.topic,
      signedClaim.scheme,
      signedClaim.issuer,
      signedClaim.signature,
      signedClaim.data,
      '',
      issuerWallet,
      {
        progress: new Progress(1),
        confirms: 1,
        chainConfig,
      },
    );

    console.log({ claimId });

    return claimId;
  });

//npx hardhat --network fhevm claim get --identity 0x406c2b3599da0b3a35044dDb99a4cfe0FA5F6B62 --issuer 0x5C7c905B505f0Cf40Ab6600d05e677F717916F6B --topic 1234
claimScope
  .task(SCOPE_CLAIM_GET)
  .addParam('identity', 'Identity address', undefined, string)
  .addParam('issuer', 'Claim issuer address', undefined, string)
  .addParam('topic', 'Topic code', undefined, bigint)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    if (!hre.ethers.isAddress(taskArgs.issuer)) {
      throw new Error(`Invalid claim issuer address: ${taskArgs.issuer}`);
    }

    if (!hre.ethers.isAddress(taskArgs.identity)) {
      throw new Error(`Invalid identity address: ${taskArgs.identity}`);
    }

    const issuer = ClaimIssuerAPI.from(taskArgs.issuer, chainConfig.provider);
    const identity = IdentityAPI.from(taskArgs.identity, chainConfig.provider);

    const signedClaim = await IdentityAPI.getClaim(identity, taskArgs.topic, issuer, chainConfig.provider);

    const output = {
      ...signedClaim,
      issuer: await signedClaim.issuer.getAddress(),
    };

    console.log(output);
  });

//npx hardhat --network fhevm claim add --issuer 0x5C7c905B505f0Cf40Ab6600d05e677F717916F6B --wallet-index 1 --identity 0x406c2b3599da0b3a35044dDb99a4cfe0FA5F6B62 --data "Hello\!" --topic 1234
//npx hardhat --network fhevm claim get --identity 0x406c2b3599da0b3a35044dDb99a4cfe0FA5F6B62 --issuer 0x5C7c905B505f0Cf40Ab6600d05e677F717916F6B --topic 1234
//npx hardhat --network fhevm claim remove --identity 0x406c2b3599da0b3a35044dDb99a4cfe0FA5F6B62 --wallet-index 1 --issuer 0x5C7c905B505f0Cf40Ab6600d05e677F717916F6B --topic 1234
claimScope
  .task(SCOPE_CLAIM_REMOVE)
  .addParam('identity', 'Identity address', undefined, string)
  .addParam('issuer', 'Claim issuer address', undefined, string)
  .addParam('topic', 'Topic code', undefined, bigint)
  .addOptionalParam('privateKey', 'Identity manager private key', undefined, string)
  .addOptionalParam('walletIndex', 'Identity manager wallet index', 0, int)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const managerWallet = loadWalletArgs(chainConfig, taskArgs.walletIndex, taskArgs.privateKey);

    if (!hre.ethers.isAddress(taskArgs.issuer)) {
      throw new Error(`Invalid claim issuer address: ${taskArgs.issuer}`);
    }

    if (!hre.ethers.isAddress(taskArgs.identity)) {
      throw new Error(`Invalid identity address: ${taskArgs.identity}`);
    }

    const issuer = ClaimIssuerAPI.from(taskArgs.issuer, chainConfig.provider);
    const identity = IdentityAPI.from(taskArgs.identity, chainConfig.provider);

    const claimId = await IdentityAPI.removeClaim(identity, taskArgs.topic, issuer, managerWallet, {
      progress: new Progress(1),
      confirms: 1,
      chainConfig,
    });

    logOK(`Claim id ${claimId} has been successfully removed from identity ${taskArgs.identity}`);
  });

/*
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
0x70997970C51812dc3A010C7d01b50e0d17dc79C8
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
0x90F79bf6EB2c4f870365E785982E1f101E93b906
0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
0x976EA74026E726554dB657fA54763abd0C3a0aa9
0x14dC79964da2C08b23698B3D3cc7Ca32193d9955
0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f
0xa0Ee7A142d267C1f36714E4a8F75612F20a79720
  */
