import { expect } from 'chai';
import hre from 'hardhat';

import { deployIdentityFixture } from '../fixtures';
import { expectRevert } from '../../tx_error';

describe('Identity', () => {
  it('should revert when attempting to initialize an already deployed identity', async () => {
    const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();

    await expectRevert(aliceIdentityContract.connect(aliceWallet).initialize(aliceWallet.address)).to.be.revertedWith(
      'Initial key was already setup.',
    );
  });

  it('should revert because interaction with library is forbidden', async () => {
    const { identityImplementationContract, aliceWallet, deployerWallet } = await deployIdentityFixture();
    const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

    await expectRevert(
      identityImplementationContract
        .connect(deployerWallet)
        .addKey(hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address])), 3, 1, {
          gasLimit: 5_000_000,
        }),
    ).to.be.revertedWith('Interacting with the library contract is forbidden.');

    await expectRevert(
      identityImplementationContract.connect(aliceWallet).initialize(deployerWallet.address, { gasLimit: 5_000_000 }),
    ).to.be.revertedWith('Initial key was already setup.');
  });

  it('should prevent creating an identity with an invalid initial key', async () => {
    const [identityOwnerWallet] = await hre.ethers.getSigners();

    const Identity = await hre.ethers.getContractFactory('Identity');
    await expectRevert(
      Identity.connect(identityOwnerWallet).deploy(hre.ethers.ZeroAddress, false, { gasLimit: 5_000_000 }),
    ).to.be.revertedWith('invalid argument - zero address');
  });

  it('should return the version of the implementation', async () => {
    const { identityImplementationContract } = await deployIdentityFixture();

    expect(await identityImplementationContract.version()).to.equal('2.2.1');
  });
});
