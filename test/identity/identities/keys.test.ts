import { expect } from 'chai';
import hre from 'hardhat';

import { deployIdentityFixture } from '../fixtures';
import { expectRevert } from '../../tx_error';

describe('Identity', () => {
  describe('Key Management', () => {
    describe('Read key methods', () => {
      it('should retrieve an existing key', async () => {
        const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();

        const aliceKeyHash = hre.ethers.keccak256(
          hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [aliceWallet.address]),
        );
        const aliceKey = await aliceIdentityContract.getKey(aliceKeyHash);
        expect(aliceKey.key).to.equal(aliceKeyHash);
        expect(aliceKey.purposes).to.deep.equal([1]);
        expect(aliceKey.keyType).to.equal(1);
      });

      it('should retrieve existing key purposes', async () => {
        const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();

        const aliceKeyHash = hre.ethers.keccak256(
          hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [aliceWallet.address]),
        );
        const purposes = await aliceIdentityContract.getKeyPurposes(aliceKeyHash);
        expect(purposes).to.deep.equal([1]);
      });

      it('should retrieve existing keys with given purpose', async () => {
        const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();

        const aliceKeyHash = hre.ethers.keccak256(
          hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [aliceWallet.address]),
        );
        const keys = await aliceIdentityContract.getKeysByPurpose(1);
        expect(keys).to.deep.equal([aliceKeyHash]);
      });

      it('should return true if a key has a given purpose', async () => {
        const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();

        const aliceKeyHash = hre.ethers.keccak256(
          hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [aliceWallet.address]),
        );
        const hasPurpose = await aliceIdentityContract.keyHasPurpose(aliceKeyHash, 1);
        expect(hasPurpose).to.equal(true);
      });

      it('should return false if a key has not a given purpose but is a MANAGEMENT key', async () => {
        const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();

        const aliceKeyHash = hre.ethers.keccak256(
          hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [aliceWallet.address]),
        );
        const hasPurpose = await aliceIdentityContract.keyHasPurpose(aliceKeyHash, 2);
        expect(hasPurpose).to.equal(true);
      });

      it('should return false if a key has not a given purpose', async () => {
        const { aliceIdentityContract, bobWallet } = await deployIdentityFixture();

        const bobKeyHash = hre.ethers.keccak256(
          hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [bobWallet.address]),
        );
        const hasPurpose = await aliceIdentityContract.keyHasPurpose(bobKeyHash, 2);
        expect(hasPurpose).to.equal(false);
      });
    });

    describe('Add key methods', () => {
      describe('when calling as a non-MANAGEMENT key', () => {
        it('should revert because the signer is not a MANAGEMENT key', async () => {
          const { aliceIdentityContract, bobWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const bobKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [bobWallet.address]));
          await expectRevert(aliceIdentityContract.connect(bobWallet).addKey(bobKeyHash, 1, 1)).to.be.revertedWith(
            'Permissions: Sender does not have management key',
          );
        });
      });

      describe('when calling as a MANAGEMENT key', () => {
        it('should add the purpose to the existing key', async () => {
          const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const aliceKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address]));

          const tx = await aliceIdentityContract.connect(aliceWallet).addKey(aliceKeyHash, 2, 1);
          await tx.wait(1);

          const aliceKey = await aliceIdentityContract.getKey(aliceKeyHash);
          expect(aliceKey.key).to.equal(aliceKeyHash);
          expect(aliceKey.keyType).to.equal(1n);
          expect(aliceKey.purposes).to.deep.equal([1n, 2n]);
        });

        it('should add a new key with a purpose', async () => {
          const { aliceIdentityContract, aliceWallet, bobWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const bobKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [bobWallet.address]));

          const tx = await aliceIdentityContract.connect(aliceWallet).addKey(bobKeyHash, 1, 1);
          await tx.wait(1);

          const bobKey = await aliceIdentityContract.getKey(bobKeyHash);
          expect(bobKey.key).to.equal(bobKeyHash);
          expect(bobKey.purposes).to.deep.equal([1]);
          expect(bobKey.keyType).to.equal(1);
        });

        it('should revert because key already has the purpose', async () => {
          const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const aliceKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address]));
          await expectRevert(aliceIdentityContract.connect(aliceWallet).addKey(aliceKeyHash, 1, 1)).to.be.revertedWith(
            'Conflict: Key already has purpose',
          );
        });
      });
    });

    describe('Remove key methods', () => {
      describe('when calling as a non-MANAGEMENT key', () => {
        it('should revert because the signer is not a MANAGEMENT key', async () => {
          const { aliceIdentityContract, aliceWallet, bobWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const aliceKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address]));
          await expectRevert(aliceIdentityContract.connect(bobWallet).removeKey(aliceKeyHash, 1)).to.be.revertedWith(
            'Permissions: Sender does not have management key',
          );
        });
      });

      describe('when calling as a MANAGEMENT key', () => {
        it('should remove the purpose from the existing key', async () => {
          const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const aliceKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address]));

          const tx = await aliceIdentityContract.connect(aliceWallet).removeKey(aliceKeyHash, 1);
          await tx.wait(1);

          const aliceKey = await aliceIdentityContract.getKey(aliceKeyHash);
          expect(aliceKey.key).to.equal('0x0000000000000000000000000000000000000000000000000000000000000000');
          expect(aliceKey.purposes).to.deep.equal([]);
          expect(aliceKey.keyType).to.equal(0);
        });

        it('should revert because key does not exists', async () => {
          const { aliceIdentityContract, aliceWallet, bobWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const bobKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [bobWallet.address]));
          await expectRevert(aliceIdentityContract.connect(aliceWallet).removeKey(bobKeyHash, 2)).to.be.revertedWith(
            "NonExisting: Key isn't registered",
          );
        });

        it('should revert because key does not have the purpose', async () => {
          const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const aliceKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address]));
          await expectRevert(aliceIdentityContract.connect(aliceWallet).removeKey(aliceKeyHash, 2)).to.be.revertedWith(
            "NonExisting: Key doesn't have such purpose",
          );
        });
      });
    });
  });
});
