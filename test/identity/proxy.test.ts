import { expect } from 'chai';
import hre from 'hardhat';
import { deployIdentityFixture } from './fixtures';

describe('Proxy', () => {
  it('should revert because implementation is Zero address', async () => {
    const [deployerWallet, identityOwnerWallet] = await hre.ethers.getSigners();

    const IdentityProxy = await hre.ethers.getContractFactory('IdentityProxy');
    await expect(
      IdentityProxy.connect(deployerWallet).deploy(hre.ethers.ZeroAddress, identityOwnerWallet.address),
    ).to.be.revertedWith('invalid argument - zero address');
  });

  it('should revert because implementation is not an identity', async () => {
    const [deployerWallet, identityOwnerWallet] = await hre.ethers.getSigners();

    const claimIssuer = await hre.ethers.deployContract('Test');
    const claimIssuerAddress = await claimIssuer.getAddress();

    const authority = await hre.ethers.deployContract('ImplementationAuthority', [claimIssuerAddress]);
    const authorityAddress = await authority.getAddress();

    const IdentityProxy = await hre.ethers.getContractFactory('IdentityProxy');
    await expect(
      IdentityProxy.connect(deployerWallet).deploy(authorityAddress, identityOwnerWallet.address),
    ).to.be.revertedWith('Initialization failed.');
  });

  it('should revert because initial key is Zero address', async () => {
    const [deployerWallet] = await hre.ethers.getSigners();

    const implementation = await hre.ethers.deployContract('Identity', [deployerWallet.address, true]);
    const implementationAddress = await implementation.getAddress();

    const implementationAuthority = await hre.ethers.deployContract('ImplementationAuthority', [implementationAddress]);
    const implementationAuthorityAddress = await implementationAuthority.getAddress();

    const IdentityProxy = await hre.ethers.getContractFactory('IdentityProxy');
    await expect(
      IdentityProxy.connect(deployerWallet).deploy(implementationAuthorityAddress, hre.ethers.ZeroAddress),
    ).to.be.revertedWith('invalid argument - zero address');
  });

  it('should prevent creating an implementation authority with a zero address implementation', async () => {
    const [deployerWallet] = await hre.ethers.getSigners();

    const ImplementationAuthority = await hre.ethers.getContractFactory('ImplementationAuthority');
    await expect(ImplementationAuthority.connect(deployerWallet).deploy(hre.ethers.ZeroAddress)).to.be.revertedWith(
      'invalid argument - zero address',
    );
  });

  it('should prevent updating to a Zero address implementation', async () => {
    const { implementationAuthorityContract, deployerWallet } = await deployIdentityFixture();

    await expect(
      implementationAuthorityContract.connect(deployerWallet).updateImplementation(hre.ethers.ZeroAddress),
    ).to.be.revertedWith('invalid argument - zero address');
  });

  it('should prevent updating when not owner', async () => {
    const { implementationAuthorityContract, aliceWallet } = await deployIdentityFixture();

    await expect(
      implementationAuthorityContract.connect(aliceWallet).updateImplementation(hre.ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(implementationAuthorityContract, 'OwnableUnauthorizedAccount');
  });

  it('should update the implementation address', async () => {
    const [deployerWallet] = await hre.ethers.getSigners();

    const implementation = await hre.ethers.deployContract('Identity', [deployerWallet.address, true]);
    const implementationAddress = await implementation.getAddress();
    const implementationAuthority = await hre.ethers.deployContract('ImplementationAuthority', [implementationAddress]);

    const newImplementation = await hre.ethers.deployContract('Identity', [deployerWallet.address, true]);
    const newImplementationAddress = await newImplementation.getAddress();

    const tx = await implementationAuthority.connect(deployerWallet).updateImplementation(newImplementationAddress);
    await expect(tx).to.emit(implementationAuthority, 'UpdatedImplementation').withArgs(newImplementationAddress);
  });
});
