import tethers from 'ethers';
import hre from 'hardhat';
import {
  ClaimTopicsRegistry,
  IdentityRegistry,
  IdentityRegistryStorage,
  IdFactory,
  IERC734,
  ImplementationAuthority,
  ModularCompliance,
  Token,
  TREXImplementationAuthority,
  TrustedIssuersRegistry,
} from '../../../types';

async function txWait(promise: Promise<tethers.ContractTransactionResponse>) {
  const tx = await promise;
  await tx.wait(1);
}

class Progress {
  public step: number;
  public stepCount: number;
  public columnWidth: number;

  constructor(n: number) {
    this.stepCount = n;
    this.step = 0;
    this.columnWidth = 40;
  }

  logImplStep(contractName: string, address: string) {
    const str = `${contractName} (impl):`.padEnd(this.columnWidth);
    this.logStep(`${str}${address}`);
  }

  logContractStep(contractName: string, address: string) {
    const str = `${contractName}:`.padEnd(this.columnWidth);
    this.logStep(`${str}${address}`);
  }

  logStep(msg: string) {
    if (hre.network.name === 'fhevm') {
      console.log(`\x1b[33m${this.step}/\x1b[0m\x1b[32m${this.stepCount}\x1b[0m \x1b[2m${msg}\x1b[0m`);
    }
    this.step += 1;
  }
}

export async function deployIdentity(
  implementationAuthorityAddress: tethers.AddressLike,
  managementKey: string,
  signer: tethers.Signer,
  name: string | undefined,
  progress: Progress,
) {
  const identityProxyFactory = await hre.ethers.getContractFactory('IdentityProxy', signer);
  const identityProxy = await identityProxyFactory.deploy(implementationAuthorityAddress, managementKey);
  await identityProxy.waitForDeployment();

  const identityAddress = await identityProxy.getAddress();
  const identity = await hre.ethers.getContractAt('Identity', identityAddress, signer);
  if (name) {
    progress.logContractStep(`Identity (${name})`, await identity.getAddress());
  } else {
    progress.logContractStep('Identity', await identity.getAddress());
  }
  return identity;
}

async function deployIdentityFactory(deployer: tethers.Signer, progress: Progress) {
  const identityImplementation = await hre.ethers.deployContract('Identity', [deployer, true], deployer);
  await identityImplementation.waitForDeployment();
  progress.logImplStep('Identity', await identityImplementation.getAddress());

  //Deploy ImplementationAuthority
  const identityImplementationAuthority = await hre.ethers.deployContract(
    'ImplementationAuthority',
    [identityImplementation],
    deployer,
  );
  await identityImplementationAuthority.waitForDeployment();
  progress.logContractStep('ImplementationAuthority', await identityImplementationAuthority.getAddress());

  //Deploy IdFactory
  const identityFactory = await hre.ethers.deployContract('IdFactory', [identityImplementationAuthority], deployer);
  await identityFactory.waitForDeployment();
  progress.logContractStep('IdFactory', await identityFactory.getAddress());

  return { identityFactory, identityImplementation, identityImplementationAuthority };
}

////////////////////////////////////////////////////////////////////////////////

async function deployTRexFactory(
  identityFactory: IdFactory,
  impls: {
    tokenImplementation: Token;
    claimTopicsRegistryImplementation: ClaimTopicsRegistry;
    identityRegistryImplementation: IdentityRegistry;
    identityRegistryStorageImplementation: IdentityRegistryStorage;
    trustedIssuersRegistryImplementation: TrustedIssuersRegistry;
    modularComplianceImplementation: ModularCompliance;
  },
  deployer: tethers.Signer,
  progress: Progress,
) {
  const trexImplementationAuthority = await hre.ethers.deployContract(
    'TREXImplementationAuthority',
    [true, hre.ethers.ZeroAddress, hre.ethers.ZeroAddress],
    deployer,
  );
  await trexImplementationAuthority.waitForDeployment();
  progress.logContractStep('TREXImplementationAuthority', await trexImplementationAuthority.getAddress());

  // Call TREXImplementationAuthority.addAndUseTREXVersion(...)
  const versionStruct = {
    major: 4,
    minor: 0,
    patch: 0,
  };
  const contractsStruct = {
    tokenImplementation: impls.tokenImplementation,
    ctrImplementation: impls.claimTopicsRegistryImplementation,
    irImplementation: impls.identityRegistryImplementation,
    irsImplementation: impls.identityRegistryStorageImplementation,
    tirImplementation: impls.trustedIssuersRegistryImplementation,
    mcImplementation: impls.modularComplianceImplementation,
  };
  await txWait(trexImplementationAuthority.connect(deployer).addAndUseTREXVersion(versionStruct, contractsStruct));

  //Deploy TREXFactory
  const trexFactory = await hre.ethers.deployContract(
    'TREXFactory',
    [trexImplementationAuthority, identityFactory],
    deployer,
  );
  await txWait(identityFactory.connect(deployer).addTokenFactory(trexFactory));

  return {
    trexFactory,
    trexImplementationAuthority,
  };
}

////////////////////////////////////////////////////////////////////////////////

async function deployeIdentityRegistry(
  trexImplementationAuthority: TREXImplementationAuthority,
  deployer: tethers.Signer,
  progress: Progress,
) {
  let proxy;

  // ClaimTopicsRegistryProxy
  proxy = await hre.ethers.deployContract('ClaimTopicsRegistryProxy', [trexImplementationAuthority], deployer);
  await proxy.waitForDeployment();
  const claimTopicsRegistry = await hre.ethers.getContractAt('ClaimTopicsRegistry', proxy);
  progress.logContractStep('ClaimTopicsRegistry', await claimTopicsRegistry.getAddress());

  // TrustedIssuersRegistryProxy
  proxy = await hre.ethers.deployContract('TrustedIssuersRegistryProxy', [trexImplementationAuthority], deployer);
  await proxy.waitForDeployment();
  const trustedIssuersRegistry = await hre.ethers.getContractAt('TrustedIssuersRegistry', proxy);
  progress.logContractStep('TrustedIssuersRegistry', await trustedIssuersRegistry.getAddress());

  // IdentityRegistryStorageProxy
  proxy = await hre.ethers.deployContract('IdentityRegistryStorageProxy', [trexImplementationAuthority], deployer);
  await proxy.waitForDeployment();
  const identityRegistryStorage = await hre.ethers.getContractAt('IdentityRegistryStorage', proxy);
  progress.logContractStep('IdentityRegistryStorage', await identityRegistryStorage.getAddress());

  // IdentityRegistryProxy
  proxy = await hre.ethers.deployContract(
    'IdentityRegistryProxy',
    [trexImplementationAuthority, trustedIssuersRegistry, claimTopicsRegistry, identityRegistryStorage],
    deployer,
  );
  await proxy.waitForDeployment();
  const identityRegistry = await hre.ethers.getContractAt('IdentityRegistry', proxy);
  progress.logContractStep('IdentityRegistry', await identityRegistry.getAddress());

  // Binding
  await txWait(identityRegistryStorage.connect(deployer).bindIdentityRegistry(identityRegistry));

  return {
    claimTopicsRegistry,
    trustedIssuersRegistry,
    identityRegistryStorage,
    identityRegistry,
  };
}

async function deployTRexToken(
  tokenName: string,
  tokenSymbol: string,
  tokenDecimals: bigint,
  identityImplementationAuthority: ImplementationAuthority,
  trexImplementationAuthority: TREXImplementationAuthority,
  managementKey: string,
  identityRegistry: IdentityRegistry,
  compliance: tethers.AddressLike,
  tokenAgent: tethers.Signer,
  deployer: tethers.Signer,
  progress: Progress,
) {
  const tokenOID = await deployIdentity(
    identityImplementationAuthority,
    managementKey,
    deployer,
    `token: ${tokenName}`,
    progress,
  );

  // TokenProxy
  const tokenProxy = await hre.ethers.deployContract(
    'TokenProxy',
    [trexImplementationAuthority, identityRegistry, compliance, tokenName, tokenSymbol, tokenDecimals, tokenOID],
    deployer,
  );
  await tokenProxy.waitForDeployment();
  progress.logContractStep('TokenProxy', await tokenProxy.getAddress());

  const token = await hre.ethers.getContractAt('Token', tokenProxy);

  //Deploy the Token's AgentManager
  const agentManager = await hre.ethers.deployContract('AgentManager', [token], tokenAgent);
  await agentManager.waitForDeployment();
  progress.logContractStep('AgentManager', await agentManager.getAddress());

  //Set the Token's agent
  await txWait(token.connect(deployer).addAgent(tokenAgent));

  return {
    token,
    tokenOID,
    agentManager,
  };
}

async function deployRandomClaimIssuer(claimIssuer: tethers.Signer, progress: Progress) {
  //Deploy ClaimIssuer
  const claimIssuerContract = await hre.ethers.deployContract('ClaimIssuer', [claimIssuer], claimIssuer);
  await claimIssuerContract.waitForDeployment();
  progress.logContractStep('ClaimIssuer', await claimIssuerContract.getAddress());

  const claimIssuerSigningKey = hre.ethers.Wallet.createRandom();
  await addClaimKey(claimIssuerContract, claimIssuer, claimIssuerSigningKey.address);

  return {
    claimIssuerContract,
    claimIssuerSigningKey,
  };
}

async function addClaimTopics(
  namedTopics: string[],
  claimTopicsRegistry: ClaimTopicsRegistry,
  deployer: tethers.Signer,
) {
  const topicsAsBytes32 = [];
  for (let i = 0; i < namedTopics.length; ++i) {
    const topicAsBytes32 = hre.ethers.id(namedTopics[i]);
    topicsAsBytes32.push(topicAsBytes32);
    await txWait(claimTopicsRegistry.connect(deployer).addClaimTopic(topicAsBytes32));
  }

  return topicsAsBytes32;
}

async function addClaimKey(erc734: IERC734, manager: tethers.ContractRunner, keyAddress: string) {
  let tx = await erc734.connect(manager).addKey(
    hre.ethers.keccak256(hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [keyAddress])),
    3, //CLAIM
    1, //ECDSA
  );
  await tx.wait(1);
}

async function addActionKey(erc734: IERC734, manager: tethers.ContractRunner, keyAddress: string) {
  let tx = await erc734.connect(manager).addKey(
    hre.ethers.keccak256(hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [keyAddress])),
    2, //ACTION
    1, //ECDSA
  );
  await tx.wait(1);
}

export async function deployFullSuiteFixture() {
  const [
    deployer,
    tokenIssuer,
    tokenAgent,
    tokenAdmin,
    claimIssuer,
    aliceWallet,
    bobWallet,
    charlieWallet,
    davidWallet,
    anotherWallet,
  ] = await hre.ethers.getSigners();

  const n = 30;
  let step = 1;
  const progress = new Progress(30);

  //Deploy implementations
  const claimTopicsRegistryImplementation = await hre.ethers.deployContract('ClaimTopicsRegistry', deployer);
  await claimTopicsRegistryImplementation.waitForDeployment();
  progress.logImplStep('ClaimTopicsRegistry', await claimTopicsRegistryImplementation.getAddress());

  const trustedIssuersRegistryImplementation = await hre.ethers.deployContract('TrustedIssuersRegistry', deployer);
  await trustedIssuersRegistryImplementation.waitForDeployment();
  progress.logImplStep('TrustedIssuersRegistry', await trustedIssuersRegistryImplementation.getAddress());

  const identityRegistryStorageImplementation = await hre.ethers.deployContract('IdentityRegistryStorage', deployer);
  await identityRegistryStorageImplementation.waitForDeployment();
  progress.logImplStep('IdentityRegistryStorage', await identityRegistryStorageImplementation.getAddress());

  const identityRegistryImplementation = await hre.ethers.deployContract('IdentityRegistry', deployer);
  await identityRegistryImplementation.waitForDeployment();
  progress.logImplStep('IdentityRegistry', await identityRegistryImplementation.getAddress());

  const modularComplianceImplementation = await hre.ethers.deployContract('ModularCompliance', deployer);
  await modularComplianceImplementation.waitForDeployment();
  progress.logImplStep('ModularCompliance', await modularComplianceImplementation.getAddress());

  const tokenImplementation = await hre.ethers.deployContract('Token', deployer);
  await tokenImplementation.waitForDeployment();
  progress.logImplStep('Token', await tokenImplementation.getAddress());

  //Deploy IdFactory
  const { identityFactory, identityImplementation, identityImplementationAuthority } = await deployIdentityFactory(
    deployer,
    progress,
  );

  //Deploy TREXFactory
  const { trexFactory, trexImplementationAuthority } = await deployTRexFactory(
    identityFactory,
    {
      tokenImplementation,
      claimTopicsRegistryImplementation,
      identityRegistryImplementation,
      identityRegistryStorageImplementation,
      trustedIssuersRegistryImplementation,
      modularComplianceImplementation,
    },
    deployer,
    progress,
  );

  //Deploy IdentityRegistry
  const { identityRegistry, identityRegistryStorage, trustedIssuersRegistry, claimTopicsRegistry } =
    await deployeIdentityRegistry(trexImplementationAuthority, deployer, progress);

  //Deploy Compliance
  const defaultCompliance = await hre.ethers.deployContract('DefaultCompliance', deployer);
  await defaultCompliance.waitForDeployment();
  progress.logContractStep('DefaultCompliance', await defaultCompliance.getAddress());

  const { token, tokenOID, agentManager } = await deployTRexToken(
    'TREXDINO',
    'TREX',
    0n,
    identityImplementationAuthority,
    trexImplementationAuthority,
    tokenIssuer.address,
    identityRegistry,
    defaultCompliance,
    tokenAgent,
    deployer,
    progress,
  );

  //Deploy a random ClaimIssuer
  const { claimIssuerContract, claimIssuerSigningKey } = await deployRandomClaimIssuer(claimIssuer, progress);

  //We will use the following test topics:
  const claimTopics = await addClaimTopics(['CLAIM_TOPIC'], claimTopicsRegistry, deployer);

  //Make sure the claimIssuer contract will be trusted to emit claims with the predefined topics
  await txWait(trustedIssuersRegistry.connect(deployer).addTrustedIssuer(claimIssuerContract, claimTopics));

  //Deploy alice, bob, charlie identities
  const aliceIdentity = await deployIdentity(
    identityImplementationAuthority,
    aliceWallet.address,
    deployer,
    'alice',
    progress,
  );
  const bobIdentity = await deployIdentity(
    identityImplementationAuthority,
    bobWallet.address,
    deployer,
    'bob',
    progress,
  );
  const charlieIdentity = await deployIdentity(
    identityImplementationAuthority,
    charlieWallet.address,
    deployer,
    'charlie',
    progress,
  );

  const aliceActionKey = hre.ethers.Wallet.createRandom();
  // add ACTION key to alice
  await addActionKey(aliceIdentity, aliceWallet, aliceActionKey.address);

  // set tokenAgent as identityRegistry agent
  let tx = await identityRegistry.connect(deployer).addAgent(tokenAgent);
  await tx.wait(1);

  // set token as identityRegistry agent
  tx = await identityRegistry.connect(deployer).addAgent(token);
  await tx.wait(1);

  // register alice, bob identities with their respective country codes
  const aliceCountryCode = 42;
  const bobCountryCode = 666;

  tx = await identityRegistry
    .connect(tokenAgent)
    .batchRegisterIdentity([aliceWallet, bobWallet], [aliceIdentity, bobIdentity], [aliceCountryCode, bobCountryCode]);
  await tx.wait(1);

  // Now, the claim issuer certifies that alice is a cool girl
  const claimForAlice = {
    data: hre.ethers.hexlify(hre.ethers.toUtf8Bytes('Alice is a cool girl.')),
    issuer: claimIssuerContract,
    topic: claimTopics[0], //id('CLAIM_TOPIC')
    scheme: 1,
    identity: await aliceIdentity.getAddress(),
    signature: '',
  };

  // The certification is signed by the claim issuer
  claimForAlice.signature = await claimIssuerSigningKey.signMessage(
    hre.ethers.getBytes(
      hre.ethers.keccak256(
        hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'bytes'],
          [claimForAlice.identity, claimForAlice.topic, claimForAlice.data],
        ),
      ),
    ),
  );

  // Store this claim in alice's identity contract
  tx = await aliceIdentity
    .connect(aliceWallet)
    .addClaim(
      claimForAlice.topic,
      claimForAlice.scheme,
      claimForAlice.issuer,
      claimForAlice.signature,
      claimForAlice.data,
      '',
    );
  await tx.wait(1);
  progress.logStep('Add alice claim');

  // Now, the claim issuer certifies that bob is a cool guy
  const claimForBob = {
    data: hre.ethers.hexlify(hre.ethers.toUtf8Bytes('Bob is a cool guy.')),
    issuer: claimIssuerContract,
    topic: claimTopics[0],
    scheme: 1,
    identity: await bobIdentity.getAddress(),
    signature: '',
  };

  claimForBob.signature = await claimIssuerSigningKey.signMessage(
    hre.ethers.getBytes(
      hre.ethers.keccak256(
        hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'bytes'],
          [claimForBob.identity, claimForBob.topic, claimForBob.data],
        ),
      ),
    ),
  );

  tx = await bobIdentity
    .connect(bobWallet)
    .addClaim(claimForBob.topic, claimForBob.scheme, claimForBob.issuer, claimForBob.signature, claimForBob.data, '');
  await tx.wait(1);
  progress.logStep('Add bob claim');

  // Give 1000 tokens to alice ('tokenAgent' has permission)
  await txWait(token.connect(tokenAgent).mint(aliceWallet, 1000));
  progress.logStep("Mint 1000 tokens on alice's wallet");

  // Give 500 tokens to bob ('tokenAgent' has permission)
  await txWait(token.connect(tokenAgent).mint(bobWallet, 500));
  progress.logStep("Mint 500 tokens on bob's wallet");

  // Let's give 'tokenAdmin' the admin role
  await txWait(agentManager.connect(tokenAgent).addAgentAdmin(tokenAdmin));
  progress.logStep(`Set ${tokenAdmin.address} as a token admin`);

  await txWait(token.connect(deployer).addAgent(agentManager));
  progress.logStep(`Give agentManager the token's agent role`);

  await txWait(identityRegistry.connect(deployer).addAgent(agentManager));
  progress.logStep(`Give agentManager the identity registry's agent role`);

  // FINISHED!
  await txWait(token.connect(tokenAgent).unpause());
  progress.logStep('Unpause token');
  progress.logStep('FINISHED');

  return {
    accounts: {
      deployer,
      tokenIssuer,
      tokenAgent,
      tokenAdmin,
      claimIssuer,
      claimIssuerSigningKey,
      aliceActionKey,
      aliceWallet,
      bobWallet,
      charlieWallet,
      davidWallet,
      anotherWallet,
    },
    identities: {
      aliceIdentity,
      bobIdentity,
      charlieIdentity,
    },
    suite: {
      claimIssuerContract,
      claimTopicsRegistry,
      trustedIssuersRegistry,
      identityRegistryStorage,
      defaultCompliance,
      identityRegistry,
      tokenOID,
      token,
      agentManager,
    },
    authorities: {
      trexImplementationAuthority,
      identityImplementationAuthority,
    },
    factories: {
      trexFactory,
      identityFactory,
    },
    implementations: {
      identityImplementation,
      claimTopicsRegistryImplementation,
      trustedIssuersRegistryImplementation,
      identityRegistryStorageImplementation,
      identityRegistryImplementation,
      modularComplianceImplementation,
      tokenImplementation,
    },
  };
}

export async function deploySuiteWithModularCompliancesFixture() {
  const context = await deployFullSuiteFixture();

  const complianceProxy = await hre.ethers.deployContract('ModularComplianceProxy', [
    context.authorities.trexImplementationAuthority,
  ]);
  await complianceProxy.waitForDeployment();

  const compliance = await hre.ethers.getContractAt('ModularCompliance', complianceProxy);

  const complianceBeta = await hre.ethers.deployContract('ModularCompliance');
  await complianceBeta.waitForDeployment();

  await complianceBeta.init();

  return {
    ...context,
    suite: {
      ...context.suite,
      compliance,
      complianceBeta,
    },
  };
}

export async function deploySuiteWithModuleComplianceBoundToWallet() {
  const context = await deployFullSuiteFixture();

  const compliance = await hre.ethers.deployContract('ModularCompliance');
  await compliance.init();

  const complianceModuleA = await hre.ethers.deployContract('CountryAllowModule');
  await compliance.addModule(complianceModuleA);
  const complianceModuleB = await hre.ethers.deployContract('CountryAllowModule');
  await compliance.addModule(complianceModuleB);

  await compliance.bindToken(context.accounts.charlieWallet.address);

  return {
    ...context,
    suite: {
      ...context.suite,
      compliance,
      complianceModuleA,
      complianceModuleB,
    },
  };
}
