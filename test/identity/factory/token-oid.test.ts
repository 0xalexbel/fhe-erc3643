import { expect } from 'chai';
import hre from 'hardhat';

import { deployFactoryFixture } from '../fixtures';

describe('IdFactory', () => {
  describe('add/remove Token factory', () => {
    it('should manipulate Token factory list', async () => {
      const { idFactoryContract, deployerWallet, aliceWallet, bobWallet } = await deployFactoryFixture();

      await expect(
        idFactoryContract.connect(aliceWallet).addTokenFactory(aliceWallet.address),
      ).to.be.revertedWithCustomError(idFactoryContract, 'OwnableUnauthorizedAccount');

      await expect(
        idFactoryContract.connect(deployerWallet).addTokenFactory(hre.ethers.ZeroAddress),
      ).to.be.revertedWith('invalid argument - zero address');

      const addTx = await idFactoryContract.connect(deployerWallet).addTokenFactory(aliceWallet.address);
      await expect(addTx).to.emit(idFactoryContract, 'TokenFactoryAdded').withArgs(aliceWallet.address);

      await expect(idFactoryContract.connect(deployerWallet).addTokenFactory(aliceWallet.address)).to.be.revertedWith(
        'already a factory',
      );

      await expect(
        idFactoryContract.connect(aliceWallet).removeTokenFactory(bobWallet.address),
      ).to.be.revertedWithCustomError(idFactoryContract, 'OwnableUnauthorizedAccount');

      await expect(
        idFactoryContract.connect(deployerWallet).removeTokenFactory(hre.ethers.ZeroAddress),
      ).to.be.revertedWith('invalid argument - zero address');

      await expect(idFactoryContract.connect(deployerWallet).removeTokenFactory(bobWallet.address)).to.be.revertedWith(
        'not a factory',
      );

      const removeTx = await idFactoryContract.connect(deployerWallet).removeTokenFactory(aliceWallet.address);
      await expect(removeTx).to.emit(idFactoryContract, 'TokenFactoryRemoved').withArgs(aliceWallet.address);
    });
  });

  describe('createTokenIdentity', () => {
    it('should revert for being not authorized to deploy token', async () => {
      const { idFactoryContract, aliceWallet } = await deployFactoryFixture();

      await expect(
        idFactoryContract.connect(aliceWallet).createTokenIdentity(aliceWallet.address, aliceWallet.address, 'TST'),
      ).to.be.revertedWith('only Factory or owner can call');
    });

    it('should revert for token address being zero address', async () => {
      const { idFactoryContract, deployerWallet, aliceWallet } = await deployFactoryFixture();

      await expect(
        idFactoryContract
          .connect(deployerWallet)
          .createTokenIdentity(hre.ethers.ZeroAddress, aliceWallet.address, 'TST'),
      ).to.be.revertedWith('invalid argument - zero address');
    });

    it('should revert for owner being zero address', async () => {
      const { idFactoryContract, deployerWallet, aliceWallet } = await deployFactoryFixture();

      await expect(
        idFactoryContract
          .connect(deployerWallet)
          .createTokenIdentity(aliceWallet.address, hre.ethers.ZeroAddress, 'TST'),
      ).to.be.revertedWith('invalid argument - zero address');
    });

    it('should revert for salt being empty', async () => {
      const { idFactoryContract, deployerWallet, aliceWallet } = await deployFactoryFixture();

      await expect(
        idFactoryContract.connect(deployerWallet).createTokenIdentity(aliceWallet.address, aliceWallet.address, ''),
      ).to.be.revertedWith('invalid argument - empty string');
    });

    it('should create one identity and then revert for salt/address being already used', async () => {
      const { idFactoryContract, deployerWallet, aliceWallet, bobWallet } = await deployFactoryFixture();

      expect(await idFactoryContract.isSaltTaken('Tokensalt1')).to.be.false;

      const tx = await idFactoryContract
        .connect(deployerWallet)
        .createTokenIdentity(aliceWallet.address, bobWallet.address, 'salt1');
      const tokenIdentityAddress = await idFactoryContract.getIdentity(aliceWallet.address);
      await expect(tx).to.emit(idFactoryContract, 'TokenLinked').withArgs(aliceWallet.address, tokenIdentityAddress);
      await expect(tx).to.emit(idFactoryContract, 'Deployed').withArgs(tokenIdentityAddress);

      expect(await idFactoryContract.isSaltTaken('Tokensalt1')).to.be.true;
      expect(await idFactoryContract.isSaltTaken('Tokensalt2')).to.be.false;
      expect(await idFactoryContract.getToken(tokenIdentityAddress)).to.deep.equal(aliceWallet.address);

      await expect(
        idFactoryContract
          .connect(deployerWallet)
          .createTokenIdentity(aliceWallet.address, aliceWallet.address, 'salt1'),
      ).to.be.revertedWith('salt already taken');
      await expect(
        idFactoryContract
          .connect(deployerWallet)
          .createTokenIdentity(aliceWallet.address, aliceWallet.address, 'salt2'),
      ).to.be.revertedWith('token already linked to an identity');
    });
  });
});
