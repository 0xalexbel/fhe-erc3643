import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import assert from 'assert';
import { ContractTransactionReceipt, ContractTransactionResponse } from 'ethers';
import hre from 'hardhat';

export async function deployFactoryFixture() {
  const [deployerWallet, claimIssuerWallet, aliceWallet, bobWallet, carolWallet, davidWallet, tokenOwnerWallet] =
    await hre.ethers.getSigners();

  const IdentityContractFactory = await hre.ethers.getContractFactory('Identity');
  const identityImplementationContract = await IdentityContractFactory.connect(deployerWallet).deploy(
    deployerWallet.address,
    true, // Must be created in library mode
  );
  await identityImplementationContract.waitForDeployment();
  const identityImplementationContractAddress = await identityImplementationContract.getAddress();

  //console.log(`identityImplementationContractAddress: ${identityImplementationContractAddress}`);

  const ImplementationAuthorityContractFactory = await hre.ethers.getContractFactory('ImplementationAuthority');
  const implementationAuthorityContract = await ImplementationAuthorityContractFactory.connect(deployerWallet).deploy(
    identityImplementationContractAddress,
  );
  await implementationAuthorityContract.waitForDeployment();
  const implementationAuthorityContractAddress = await implementationAuthorityContract.getAddress();

  //console.log(`implementationAuthorityContract: ${implementationAuthorityContractAddress}`);

  const IdFactoryFactory = await hre.ethers.getContractFactory('IdFactory');
  const idFactoryContract = await IdFactoryFactory.connect(deployerWallet).deploy(
    implementationAuthorityContractAddress,
  );
  await idFactoryContract.waitForDeployment();
  const idFactoryContractOwnerAddress = await idFactoryContract.owner();
  const idFactoryContractAddress = await idFactoryContract.getAddress();

  //console.log(`idFactoryContractAddress: ${idFactoryContractAddress}`);

  // The idFactory owns the implementation authority.
  // The implementation authority owns the identity "reference implementation" (used by all future identity proxies)
  assert((await implementationAuthorityContract.getImplementation()) === identityImplementationContractAddress);

  return {
    idFactoryContract,
    idFactoryContractOwnerAddress,
    identityImplementationContract,
    implementationAuthorityContract,
    aliceWallet,
    bobWallet,
    carolWallet,
    davidWallet,
    deployerWallet,
    claimIssuerWallet,
    tokenOwnerWallet,
  };
}

export async function deployIdentityFixture() {
  let tx: ContractTransactionResponse;
  let receipt: ContractTransactionReceipt;

  const {
    idFactoryContract,
    idFactoryContractOwnerAddress,
    identityImplementationContract,
    implementationAuthorityContract,
    deployerWallet,
    claimIssuerWallet,
    aliceWallet,
    bobWallet,
    carolWallet,
    davidWallet,
    tokenOwnerWallet,
  } = await deployFactoryFixture();

  // deployerWallet is the owner of the idFactory contract
  // only deployWallet can create new identities
  assert(deployerWallet.address === idFactoryContractOwnerAddress);

  const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

  const ClaimIssuerFactory = await hre.ethers.getContractFactory('ClaimIssuer');
  const claimIssuerContract = await ClaimIssuerFactory.connect(claimIssuerWallet).deploy(claimIssuerWallet.address);
  await claimIssuerContract.waitForDeployment();
  const claimIssuerContractAddress = await claimIssuerContract.getAddress();

  //console.log(`claimIssuerContractAddress: ${claimIssuerContractAddress}`);

  assert(claimIssuerContract.runner === claimIssuerWallet);

  tx = await claimIssuerContract
    .connect(claimIssuerWallet)
    .addKey(hre.ethers.keccak256(abiCoder.encode(['address'], [claimIssuerWallet.address])), 3, 1);
  await tx.wait();

  // deployerWallet is the idFactory owner
  const aliceSalt = 'alice-salt';
  tx = await idFactoryContract.connect(deployerWallet).createIdentity(aliceWallet.address, aliceSalt);
  receipt = (await tx.wait())!;

  const aliceIdentityContractAddress = await idFactoryContract.getIdentity(aliceWallet.address);
  const aliceIdentityContract = await hre.ethers.getContractAt('Identity', aliceIdentityContractAddress, aliceWallet);

  //console.log(`aliceIdentityContractAddress: ${aliceIdentityContractAddress}`);

  assert(aliceIdentityContract.runner === aliceWallet);
  assert(aliceIdentityContractAddress === (await aliceIdentityContract.getAddress()));

  // aliceWallet is Manager of aliceIdentityContract
  const isAliceManagerOfAliceIdentity = await aliceIdentityContract.keyHasPurpose(
    hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address])),
    1,
  );
  assert(isAliceManagerOfAliceIdentity);

  tx = await aliceIdentityContract.addKey(
    hre.ethers.keccak256(abiCoder.encode(['address'], [carolWallet.address])),
    3, // purpose: Claim
    1, // type: ECDSA
  );
  await tx.wait();

  //console.log(`aliceIdentityContract.addKey(carol:${carolWallet.address}, 3, 1)`);

  tx = await aliceIdentityContract.addKey(
    hre.ethers.keccak256(abiCoder.encode(['address'], [davidWallet.address])),
    2, // purpose: Action
    1, // type: ECDSA
  );
  await tx.wait();

  //console.log(`aliceIdentityContract.addKey(david:${davidWallet.address}, 2, 1)`);

  const aliceClaim666 = {
    id: '',
    identity: aliceIdentityContractAddress,
    issuer: claimIssuerContractAddress,
    topic: 666,
    scheme: 1,
    data: '0x0042',
    signature: '',
    uri: 'https://example.com',
  };

  aliceClaim666.id = hre.ethers.keccak256(
    abiCoder.encode(['address', 'uint256'], [aliceClaim666.issuer, aliceClaim666.topic]),
  );
  aliceClaim666.signature = await claimIssuerWallet.signMessage(
    hre.ethers.getBytes(
      hre.ethers.keccak256(
        abiCoder.encode(
          ['address', 'uint256', 'bytes'],
          [aliceClaim666.identity, aliceClaim666.topic, aliceClaim666.data],
        ),
      ),
    ),
  );

  tx = await aliceIdentityContract
    .connect(aliceWallet)
    .addClaim(
      aliceClaim666.topic,
      aliceClaim666.scheme,
      aliceClaim666.issuer,
      aliceClaim666.signature,
      aliceClaim666.data,
      aliceClaim666.uri,
    );
  await tx.wait();

  //console.log(`aliceIdentityContract.addClaim(aliceClaim666)`);

  // deployerWallet is the idFactory owner
  const bobSalt = 'bob-salt';
  tx = await idFactoryContract.connect(deployerWallet).createIdentity(bobWallet.address, bobSalt);
  await tx.wait();

  const bobIdentityContractAddress = await idFactoryContract.getIdentity(bobWallet.address);

  //console.log(`bobIdentityContractAddress: ${bobIdentityContractAddress}`);

  const bobIdentityContract = await hre.ethers.getContractAt('Identity', bobIdentityContractAddress);

  const tokenAddress = '0xdEE019486810C7C620f6098EEcacA0244b0fa3fB';
  tx = await idFactoryContract
    .connect(deployerWallet)
    .createTokenIdentity(tokenAddress, tokenOwnerWallet.address, 'tokenOwner');
  await tx.wait();

  //console.log(`idFactoryContract.createTokenIdentity(tokenAddress: ${tokenAddress})`);

  return {
    idFactoryContract,
    idFactoryContractOwnerAddress,
    identityImplementationContract,
    implementationAuthorityContract,
    claimIssuerContract,
    aliceWallet,
    bobWallet,
    carolWallet,
    davidWallet,
    deployerWallet,
    claimIssuerWallet,
    tokenOwnerWallet,
    aliceIdentityContract,
    bobIdentityContract,
    aliceClaim666,
    tokenAddress,
  };
}
