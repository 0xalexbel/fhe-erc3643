import { ethers as EthersT } from 'ethers';
import { ClaimIssuer, IdFactory, Token, TREXFactory, TREXImplementationAuthority } from '../artifacts';
import { ChainConfig } from '../ChainConfig';
import { ClaimIssuerAPI } from '../ClaimIssuerAPI';
import { TREXImplementationAuthorityAPI } from '../TRexImplementationAuthorityAPI';
import { defaultTxOptions } from '../log';
import fs from 'fs';
import { cmdTokenAddIdentity, cmdTokenNew, NewTokenResult } from './token';
import { cmdAddAgent } from './roles';
import { TxOptions } from '../types';
import { cmdIdentityNew } from './identity';
import { IdentityAPI } from '../IdentityAPI';
import { logStepOK } from '../log';
import { TokenAPI } from '../TokenAPI';
import { SupplyLimitModuleAPI } from '../SupplyLimitModuleAPI';
import { TransferRestrictModuleAPI } from '../TransferRestrictModuleAPI';
import { TimeExchangeLimitsModuleAPI } from '../TimeExchangeLimitsModuleAPI';
import { ExchangeMonthlyLimitsModuleAPI } from '../ExchangeMonthlyLimitsModuleAPI';

////////////////////////////////////////////////////////////////////////////////

export async function cmdTREXNewFactory(
  wallet: string,
  chainConfig: ChainConfig,
  options: TxOptions,
): Promise<{
  idFactory: IdFactory;
  authority: TREXImplementationAuthority;
  factory: TREXFactory;
}> {
  const ownerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(wallet);

  const trexFactory = await TREXImplementationAuthorityAPI.loadOrDeployTREXConfig(
    {},
    ownerWallet,
    chainConfig,
    options,
  );

  return trexFactory;
}

////////////////////////////////////////////////////////////////////////////////

export function cmdTREXSetupTxOptions() {
  return defaultTxOptions(44);
}

export type CmdTREXSetupOutput = {
  tokenAddress: string;
  trexFactoryAddress: string;
  tokenOwner: {
    walletName: string;
    address: string;
  };
  tokenAgent: {
    walletName: string;
    address: string;
  };
  accounts: Record<
    string,
    {
      walletName: string;
      address: string;
      identityAddress: string;
    }
  >;
};

export async function cmdTREXSetup(
  chainConfig: ChainConfig,
  mint: bigint,
  unpause: boolean,
  options: TxOptions,
): Promise<CmdTREXSetupOutput> {
  if (options.progress) {
    if (mint > 0n) {
      options.progress.stepCount += 5;
    }
    if (unpause) {
      options.progress.stepCount += 1;
    }
  }

  const trexFactoryOwnerWalletAlias = 'admin';
  const fooUniversityWalletAlias = 'foo-university';
  const barGovernmentWalletAlias = 'bar-government';
  const tokenOwnerWalletAlias = 'super-bank'; // = 'token-owner'
  const tokenIRAgentWalletAlias = 'super-bank'; // = 'token-owner' could be 'token-agent'
  const tokenIROwnerWalletAlias = 'super-bank'; // = 'token-owner' could be 'token-agent'
  const tokenAgentWalletAlias = 'token-agent';
  const diplomaTopic = 10101010000042n;
  const nameTopic = 10101000100006n;

  const tokenOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenOwnerWalletAlias);
  const fooUniversityWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(fooUniversityWalletAlias);
  const barGovernmentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(barGovernmentWalletAlias);

  const trexFactoryOwnerWallet =
    chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(trexFactoryOwnerWalletAlias);

  // create the TREX factory
  const trexFactory = await TREXImplementationAuthorityAPI.loadOrDeployTREXConfig(
    {},
    trexFactoryOwnerWallet,
    chainConfig,
    options,
  );

  const trexFactoryAddress = await trexFactory.factory.getAddress();

  // add claim issuers
  const fooUniversityClaimIssuer: ClaimIssuer = await ClaimIssuerAPI.deployNewClaimIssuer(
    fooUniversityWallet,
    fooUniversityWallet,
    chainConfig,
    options,
  );
  const barGovernmentClaimIssuer: ClaimIssuer = await ClaimIssuerAPI.deployNewClaimIssuer(
    barGovernmentWallet,
    barGovernmentWallet,
    chainConfig,
    options,
  );

  const fooUniversityClaimIssuerAddress = await fooUniversityClaimIssuer.getAddress();
  const barGovernmentClaimIssuerAddress = await barGovernmentClaimIssuer.getAddress();

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
      /*
        '<foo-university claim issuer address>': {
            topics: ['10101010000042n'],
        },
        '<bar-government claim issuer address>': {
            topics: ['10101000100006n'],
        },
      */
      issuers: {} as Record<string, { topics: Array<string> }>,
    },
  };

  tokenConfigJson.claims.issuers[fooUniversityClaimIssuerAddress] = { topics: [diplomaTopicStr] };
  tokenConfigJson.claims.issuers[barGovernmentClaimIssuerAddress] = { topics: [nameTopicStr] };

  fs.writeFileSync('./megalodon.token.json', JSON.stringify(tokenConfigJson, null, 2), { encoding: 'utf8' });

  // create token
  const tokenResult: NewTokenResult = await cmdTokenNew(
    './megalodon.token.json',
    tokenOwnerWalletAlias,
    trexFactoryAddress,
    'TheMegToken',
    trexFactoryOwnerWalletAlias,
    chainConfig,
    options,
  );

  // Add 'token-owner' = 'super-bank' as token.identityRegistry agent
  await cmdAddAgent(tokenIRAgentWalletAlias, tokenResult.ir, tokenIROwnerWalletAlias, chainConfig, options);

  // Add 'token-agent' as token agent
  await cmdAddAgent(tokenAgentWalletAlias, tokenResult.token, tokenOwnerWalletAlias, chainConfig, options);

  const users = [
    { wallet: 'alice', country: 1n },
    { wallet: 'bob', country: 1n },
    { wallet: 'charlie', country: 2n },
    { wallet: 'david', country: 2n },
    { wallet: 'eve', country: 3n },
  ];

  const accounts: Record<string, { walletName: string; address: string; identityAddress: string }> = {};

  for (let i = 0; i < users.length; ++i) {
    const userWallet = chainConfig.getWalletFromName(users[i].wallet, chainConfig.provider);

    // Create new identity
    const identity = await cmdIdentityNew(users[i].wallet, trexFactoryAddress, 'trex', chainConfig, options);
    const identityAddress = await identity.getAddress();

    accounts[users[i].wallet] = {
      walletName: users[i].wallet,
      address: userWallet.address,
      identityAddress: identityAddress,
    };

    // register identity to token
    await cmdTokenAddIdentity(
      tokenResult.token,
      users[i].wallet,
      identityAddress,
      users[i].country,
      tokenIRAgentWalletAlias,
      chainConfig,
      options,
    );

    // create Foo university diploma claim
    const diplomaClaim = await ClaimIssuerAPI.createSignedClaim(
      fooUniversityClaimIssuer,
      chainConfig.getWalletFromName(fooUniversityWalletAlias, chainConfig.provider),
      identity,
      EthersT.toUtf8Bytes(`${users[i].wallet} is graduated from Foo University`),
      diplomaTopic,
      1n,
    );

    // add Foo university diploma to user identity
    const diplomaClaimId = await IdentityAPI.addClaim(identity, diplomaClaim, '', userWallet, options);

    logStepOK(
      `Foo university diploma claim was successfully added to ${users[i].wallet} with id ${diplomaClaimId}`,
      options,
    );

    // create Bar government name claim
    const nameClaim = await ClaimIssuerAPI.createSignedClaim(
      barGovernmentClaimIssuer,
      chainConfig.getWalletFromName('bar-government', chainConfig.provider),
      identity,
      EthersT.toUtf8Bytes(`${users[i].wallet}`), //use wallet name as name
      nameTopic,
      1n,
    );

    // add Bar government name claim to user identity
    const nameClaimId = await IdentityAPI.addClaim(identity, nameClaim, '', userWallet, options);

    logStepOK(`Bar government name claim was successfully added to ${users[i].wallet} with id ${nameClaimId}`, options);
  }

  const token = await TokenAPI.fromSafe(tokenResult.token, chainConfig.provider);

  await deployModuleImplementations(
    token,
    tokenOwnerWallet,
    tokenOwnerWallet,
    tokenOwnerWalletAlias,
    chainConfig,
    options,
  );

  const tokenAgentWallet = chainConfig.getWalletFromName(tokenAgentWalletAlias, chainConfig.provider);

  if (mint !== 0n) {
    for (let i = 0; i < users.length; ++i) {
      const userWallet = chainConfig.getWalletFromName(users[i].wallet, chainConfig.provider);
      const enc = await chainConfig.encrypt64(token, userWallet, mint);
      await TokenAPI.mint(token, userWallet, enc.handles[0], enc.inputProof, tokenAgentWallet, options);

      logStepOK(`Minted ${mint} tokens to '${users[i].wallet}'`, options);
    }
  }

  if (unpause) {
    await TokenAPI.unpause(token, tokenAgentWallet, options);

    logStepOK(`Token ${tokenResult.token} is unpaused`, options);
  }

  return {
    tokenAddress: tokenResult.token,
    trexFactoryAddress,
    accounts,
    tokenAgent: {
      walletName: tokenAgentWalletAlias,
      address: tokenAgentWallet.address,
    },
    tokenOwner: {
      walletName: tokenOwnerWalletAlias,
      address: tokenOwnerWallet.address,
    },
  };
}

async function deployModuleImplementations(
  token: Token,
  tokenOwnerWallet: EthersT.Signer,
  complianceOwnerWallet: EthersT.Signer,
  moduleImplOwnerWalletAlias: string,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const compliance = await TokenAPI.complianceWithOwner(token, tokenOwnerWallet);

  const moduleImplOwnerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(moduleImplOwnerWalletAlias);

  // Setup a large limit
  /* const supplyLimitModule = */ await SupplyLimitModuleAPI.deployNew(
    moduleImplOwnerWallet,
    compliance,
    complianceOwnerWallet,
    1_000_000_000n,
    chainConfig,
    chainConfig.provider,
    options,
  );

  // Must allow everybody
  /* const transferRestrictModule = */ await TransferRestrictModuleAPI.deployNew(
    moduleImplOwnerWallet,
    compliance,
    complianceOwnerWallet,
    chainConfig.getAllWalletsAddress(),
    chainConfig,
    options,
  );

  // No restriction
  /* const timeExchangeLimitsModule = */ await TimeExchangeLimitsModuleAPI.deployNew(
    moduleImplOwnerWallet,
    compliance,
    complianceOwnerWallet,
    chainConfig,
    options,
  );

  // No restriction
  /* const exchangeMonthlyLimitsModule = */ await ExchangeMonthlyLimitsModuleAPI.deployNew(
    moduleImplOwnerWallet,
    compliance,
    complianceOwnerWallet,
    chainConfig,
    options,
  );
}
