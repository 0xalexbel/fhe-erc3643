import { expect } from 'chai';
import hre from 'hardhat';

import { deployIdentityFixture } from '../fixtures';

describe('IdFactory', () => {
  it('should revert because authority is Zero address', async () => {
    const [deployerWallet] = await hre.ethers.getSigners();

    const IdFactory = await hre.ethers.getContractFactory('IdFactory');
    await expect(IdFactory.connect(deployerWallet).deploy(hre.ethers.ZeroAddress)).to.be.revertedWith(
      'invalid argument - zero address',
    );
  });

  it('should revert because sender is not allowed to create identities', async () => {
    const { idFactoryContract, aliceWallet } = await deployIdentityFixture();

    await expect(
      idFactoryContract.connect(aliceWallet).createIdentity(hre.ethers.ZeroAddress, 'salt1'),
    ).to.be.revertedWithCustomError(idFactoryContract, 'OwnableUnauthorizedAccount');
  });

  it('should revert because wallet of identity cannot be Zero address', async () => {
    const { idFactoryContract, deployerWallet } = await deployIdentityFixture();

    await expect(
      idFactoryContract.connect(deployerWallet).createIdentity(hre.ethers.ZeroAddress, 'salt1'),
    ).to.be.revertedWith('invalid argument - zero address');
  });

  it('should revert because salt cannot be empty', async () => {
    const { idFactoryContract, deployerWallet, davidWallet } = await deployIdentityFixture();

    await expect(idFactoryContract.connect(deployerWallet).createIdentity(davidWallet.address, '')).to.be.revertedWith(
      'invalid argument - empty string',
    );
  });

  it('should revert because salt cannot be already used', async () => {
    const { idFactoryContract, deployerWallet, davidWallet, carolWallet } = await deployIdentityFixture();

    await idFactoryContract.connect(deployerWallet).createIdentity(carolWallet.address, 'saltUsed');

    await expect(
      idFactoryContract.connect(deployerWallet).createIdentity(davidWallet.address, 'saltUsed'),
    ).to.be.revertedWith('salt already taken');
  });

  it('should revert because wallet is already linked to an identity', async () => {
    const { idFactoryContract, deployerWallet, aliceWallet } = await deployIdentityFixture();

    await expect(
      idFactoryContract.connect(deployerWallet).createIdentity(aliceWallet.address, 'newSalt'),
    ).to.be.revertedWith('wallet already linked to an identity');
  });

  describe('link/unlink wallet', () => {
    describe('linkWallet', () => {
      it('should revert for new wallet being zero address', async () => {
        const { idFactoryContract, aliceWallet } = await deployIdentityFixture();

        await expect(idFactoryContract.connect(aliceWallet).linkWallet(hre.ethers.ZeroAddress)).to.be.revertedWith(
          'invalid argument - zero address',
        );
      });

      it('should revert for sender wallet being not linked', async () => {
        const { idFactoryContract, davidWallet } = await deployIdentityFixture();

        await expect(idFactoryContract.connect(davidWallet).linkWallet(davidWallet.address)).to.be.revertedWith(
          'wallet not linked to an identity contract',
        );
      });
    });

    it('should revert for new wallet being already linked', async () => {
      const { idFactoryContract, bobWallet, aliceWallet } = await deployIdentityFixture();

      await expect(idFactoryContract.connect(bobWallet).linkWallet(aliceWallet.address)).to.be.revertedWith(
        'new wallet already linked',
      );
    });

    it('should revert for new wallet being already to a token identity', async () => {
      const { idFactoryContract, bobWallet, tokenAddress } = await deployIdentityFixture();

      await expect(idFactoryContract.connect(bobWallet).linkWallet(tokenAddress)).to.be.revertedWith(
        'invalid argument - token address',
      );
    });

    it('should link the new wallet to the existing identity', async () => {
      const { idFactoryContract, aliceIdentityContract, aliceWallet, davidWallet } = await deployIdentityFixture();
      const aliceIdentityContractAddress = await aliceIdentityContract.getAddress();

      const tx = await idFactoryContract.connect(aliceWallet).linkWallet(davidWallet.address);
      await expect(tx)
        .to.emit(idFactoryContract, 'WalletLinked')
        .withArgs(davidWallet.address, aliceIdentityContractAddress);

      expect(await idFactoryContract.getWallets(aliceIdentityContractAddress)).to.deep.equal([
        aliceWallet.address,
        davidWallet.address,
      ]);
    });
  });

  describe('unlinkWallet', () => {
    it('should revert for wallet to unlink being zero address', async () => {
      const { idFactoryContract, aliceWallet } = await deployIdentityFixture();

      await expect(idFactoryContract.connect(aliceWallet).unlinkWallet(hre.ethers.ZeroAddress)).to.be.revertedWith(
        'invalid argument - zero address',
      );
    });

    it('should revert for sender wallet attempting to unlink itself', async () => {
      const { idFactoryContract, aliceWallet } = await deployIdentityFixture();

      await expect(idFactoryContract.connect(aliceWallet).unlinkWallet(aliceWallet.address)).to.be.revertedWith(
        'cannot be called on sender address',
      );
    });

    it('should revert for sender wallet being not linked', async () => {
      const { idFactoryContract, aliceWallet, davidWallet } = await deployIdentityFixture();

      await expect(idFactoryContract.connect(davidWallet).unlinkWallet(aliceWallet.address)).to.be.revertedWith(
        'only a linked wallet can unlink',
      );
    });

    it('should unlink the wallet', async () => {
      const { idFactoryContract, aliceIdentityContract, aliceWallet, davidWallet } = await deployIdentityFixture();
      const aliceIdentityContractAddress = await aliceIdentityContract.getAddress();

      await idFactoryContract.connect(aliceWallet).linkWallet(davidWallet.address);
      const tx = await idFactoryContract.connect(aliceWallet).unlinkWallet(davidWallet.address);
      await expect(tx)
        .to.emit(idFactoryContract, 'WalletUnlinked')
        .withArgs(davidWallet.address, aliceIdentityContractAddress);

      expect(await idFactoryContract.getWallets(aliceIdentityContractAddress)).to.deep.equal([aliceWallet.address]);
    });
  });
});

describe('createIdentityWithManagementKeys()', () => {
  describe('when no management keys are provided', () => {
    it('should revert', async () => {
      const { idFactoryContract, deployerWallet, davidWallet } = await deployIdentityFixture();

      await expect(
        idFactoryContract.connect(deployerWallet).createIdentityWithManagementKeys(davidWallet.address, 'salt1', []),
      ).to.be.revertedWith('invalid argument - empty list of keys');
    });
  });

  describe('when the wallet is included in the management keys listed', () => {
    it('should revert', async () => {
      const { idFactoryContract, deployerWallet, aliceWallet, davidWallet } = await deployIdentityFixture();

      const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

      await expect(
        idFactoryContract
          .connect(deployerWallet)
          .createIdentityWithManagementKeys(davidWallet.address, 'salt1', [
            hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address])),
            hre.ethers.keccak256(abiCoder.encode(['address'], [davidWallet.address])),
          ]),
      ).to.be.revertedWith('invalid argument - wallet is also listed in management keys');
    });
  });

  describe('when other management keys are specified', () => {
    it('should deploy the identity proxy, set keys and wallet as management, and link wallet to identity', async () => {
      const { idFactoryContract, deployerWallet, aliceWallet, davidWallet } = await deployIdentityFixture();
      const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

      const idFactoryContractAddress = await idFactoryContract.getAddress();
      const tx = await idFactoryContract
        .connect(deployerWallet)
        .createIdentityWithManagementKeys(davidWallet.address, 'salt1', [
          hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address])),
        ]);

      await expect(tx).to.emit(idFactoryContract, 'WalletLinked');
      await expect(tx).to.emit(idFactoryContract, 'Deployed');

      const identity = await hre.ethers.getContractAt(
        'Identity',
        await idFactoryContract.getIdentity(davidWallet.address),
      );

      await expect(tx)
        .to.emit(identity, 'KeyAdded')
        .withArgs(hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address])), 1, 1);
      await expect(identity.keyHasPurpose(abiCoder.encode(['address'], [idFactoryContractAddress]), 1)).to.eventually.be
        .false;
      await expect(identity.keyHasPurpose(abiCoder.encode(['address'], [davidWallet.address]), 1)).to.eventually.be
        .false;
      await expect(identity.keyHasPurpose(abiCoder.encode(['address'], [aliceWallet.address]), 1)).to.eventually.be
        .false;
    });
  });
});
