import { scope } from 'hardhat/config';
import {
  SCOPE_CLAIM,
  SCOPE_CLAIM_ADD,
  SCOPE_CLAIM_GET,
  SCOPE_CLAIM_ISSUER,
  SCOPE_CLAIM_ISSUER_LIST,
  SCOPE_CLAIM_ISSUER_NEW,
  SCOPE_IDENTITY,
  SCOPE_IDENTITY_ADD_KEY,
  SCOPE_IDENTITY_NEW,
  SCOPE_ROLES,
  SCOPE_ROLES_ADD_AGENT,
  SCOPE_TOKEN,
  SCOPE_TOKEN_ADD_IDENTITY,
  SCOPE_TOKEN_NEW,
  SCOPE_TREX,
  SCOPE_TREX_INFO,
  SCOPE_TREX_NEW_FACTORY,
  SCOPE_TREX_SETUP,
} from './task-names';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import { Progress } from '../sdk/utils';
import { getHistoryPath, loadChainConfig, loadWalletFromIndexOrAliasOrAddressOrPrivateKey, logOK } from './utils';
import { TREXImplementationAuthorityAPI } from '../sdk/TRexImplementationAuthorityAPI';
import { ClaimIssuerAPI } from '../sdk/ClaimIssuerAPI';

import './aa';
import './identity';
import './modules';
import './roles';
import './token';
import './claim';
import { ClaimIssuer, Identity, IdFactory, TREXFactory, TREXImplementationAuthority } from '../types';
import { NewTokenResult } from './token';
import fs from 'fs';
import { ethers as EthersT } from 'ethers';
import { IdentityAPI } from '../sdk/IdentityAPI';

const issuerScope = scope(SCOPE_CLAIM_ISSUER, 'Manage claim issuers');
const trexScope = scope(SCOPE_TREX, 'Manage TREX factories');

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

//npx hardhat --network fhevm trex new-factory --wallet-index 0
trexScope.task(SCOPE_TREX_SETUP).setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
  const trexFactoryOwnerWalletAlias = 'admin';
  const tokenOwnerWalletAlias = 'super-bank'; // = 'token-owner'
  const tokenIRAgentWalletAlias = 'super-bank'; // = 'token-owner' could be 'token-agent'
  const tokenIROwnerWalletAlias = 'super-bank'; // = 'token-owner' could be 'token-agent'

  const chainConfig = await loadChainConfig(hre, getHistoryPath());

  // create the TREX factory
  const trexFactory: {
    idFactory: IdFactory;
    authority: TREXImplementationAuthority;
    factory: TREXFactory;
  } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_NEW_FACTORY }, { wallet: trexFactoryOwnerWalletAlias });

  const trexFactoryAddress = await trexFactory.factory.getAddress();

  // add claim issuers
  const fooUniversityClaimIssuer: ClaimIssuer = await hre.run(
    { scope: SCOPE_CLAIM_ISSUER, task: SCOPE_CLAIM_ISSUER_NEW },
    { wallet: 'foo-university' },
  );
  const barGovernmentClaimIssuer: ClaimIssuer = await hre.run(
    { scope: SCOPE_CLAIM_ISSUER, task: SCOPE_CLAIM_ISSUER_NEW },
    { wallet: 'bar-government' },
  );

  const fooUniversityClaimIssuerAddress = await fooUniversityClaimIssuer.getAddress();
  const barGovernmentClaimIssuerAddress = await barGovernmentClaimIssuer.getAddress();

  const diplomaTopic = 10101010000042n;
  const nameTopic = 10101000100006n;

  const diplomaTopicStr = diplomaTopic.toString() + 'n';
  const nameTopicStr = nameTopic.toString() + 'n';

  const tokenConfigJson = {
    salt: 'TheMegToken',
    token: {
      name: 'MEGALODON',
      symbol: 'MEG',
      decimals: 0,
      identityRegistryStorage: EthersT.ZeroAddress,
      identity: EthersT.ZeroAddress,
      identityRegistryAgents: [],
      tokenAgents: [],
      complianceModules: [],
      complianceSettings: [],
    },
    claims: {
      topics: [diplomaTopicStr, nameTopicStr],
      issuers: {} as Record<string, { topics: Array<string> }>,
      // 'foo-university': {
      //   topics: ['10101010000042n'],
      // },
      // 'bar-government': {
      //   topics: ['10101000100006n'],
      // },
      // },
    },
  };

  tokenConfigJson.claims.issuers[fooUniversityClaimIssuerAddress] = { topics: [diplomaTopicStr] };
  tokenConfigJson.claims.issuers[barGovernmentClaimIssuerAddress] = { topics: [nameTopicStr] };

  fs.writeFileSync('./megalodon.token.json', JSON.stringify(tokenConfigJson, null, 2), { encoding: 'utf8' });

  // create token
  const tokenResult: NewTokenResult = await hre.run(
    { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_NEW },
    {
      configFile: './megalodon.token.json',
      owner: tokenOwnerWalletAlias,
      trexFactory: trexFactoryAddress,
      wallet: trexFactoryOwnerWalletAlias, //must be the TREXFactory owner!
      salt: 'TheMegToken',
    },
  );

  // Add 'token-owner' = 'super-bank' as token.identityRegistry agent
  await hre.run(
    { scope: SCOPE_ROLES, task: SCOPE_ROLES_ADD_AGENT },
    {
      address: tokenIRAgentWalletAlias,
      target: tokenResult.ir,
      wallet: tokenIROwnerWalletAlias,
    },
  );

  // Add 'token-agent' as token agent
  await hre.run(
    { scope: SCOPE_ROLES, task: SCOPE_ROLES_ADD_AGENT },
    {
      address: 'token-agent',
      target: tokenResult.token,
      wallet: tokenOwnerWalletAlias,
    },
  );

  const users = [
    { wallet: 'alice', country: 1n },
    { wallet: 'bob', country: 1n },
    { wallet: 'charlie', country: 2n },
    { wallet: 'david', country: 2n },
    { wallet: 'eve', country: 3n },
  ];

  for (let i = 0; i < users.length; ++i) {
    const userWallet = chainConfig.getWalletFromName(users[i].wallet, chainConfig.provider);

    // create identity
    const identity: Identity = await hre.run(
      { scope: SCOPE_IDENTITY, task: SCOPE_IDENTITY_NEW },
      {
        trexFactory: trexFactoryAddress,
        wallet: users[i].wallet,
      },
    );

    const identityAddress = await identity.getAddress();

    // register identity to token
    await hre.run(
      { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_ADD_IDENTITY },
      {
        token: tokenResult.token,
        wallet: tokenIRAgentWalletAlias,
        country: users[i].country,
        identity: identityAddress,
        user: users[i].wallet,
      },
    );

    // create Foo university diploma claim
    const diplomaClaim = await ClaimIssuerAPI.createSignedClaim(
      fooUniversityClaimIssuer,
      chainConfig.getWalletFromName('foo-university', chainConfig.provider),
      identity,
      EthersT.toUtf8Bytes(`${users[i]} is graduated from Foo University`),
      diplomaTopic,
    );

    // add Foo university diploma to user identity
    const diplomaClaimId = await IdentityAPI.addClaim(
      identity,
      diplomaClaim.topic,
      1n,
      diplomaClaim.issuer,
      diplomaClaim.signature,
      diplomaClaim.data,
      '',
      userWallet,
    );

    logOK(`Foo university diploma claim was successfully added to ${users[i].wallet} with id ${diplomaClaimId}`);

    // create Bar government name claim
    const nameClaim = await ClaimIssuerAPI.createSignedClaim(
      barGovernmentClaimIssuer,
      chainConfig.getWalletFromName('bar-government', chainConfig.provider),
      identity,
      EthersT.toUtf8Bytes(`${users[i]}`),
      nameTopic,
    );

    // add Bar government name claim to user identity
    const nameClaimId = await IdentityAPI.addClaim(
      identity,
      nameClaim.topic,
      1n,
      nameClaim.issuer,
      nameClaim.signature,
      nameClaim.data,
      '',
      userWallet,
    );

    logOK(`Bar government name claim was successfully added to ${users[i].wallet} with id ${nameClaimId}`);
  }

  return {
    token: tokenResult.token,
  };
});

////////////////////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////////////////////

//npx hardhat --network fhevm issuer info
issuerScope.task(SCOPE_CLAIM_ISSUER_LIST).setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
  const p = getHistoryPath();
  console.log(`History file: ${p}`);

  const chainConfig = await loadChainConfig(hre, p);

  console.log('List of all claim issuers:');
  chainConfig.toJSON().claimIssuers.forEach(v => console.log('  ' + v));
});

////////////////////////////////////////////////////////////////////////////////
