import { expect } from 'chai';
import hre from 'hardhat';
import { deployIdentityFixture } from '../fixtures';

describe('Identity', () => {
  describe('Execute', () => {
    describe('when calling execute as a MANAGEMENT key', () => {
      describe('when execution is possible (transferring value with enough funds on the identity)', () => {
        it('should execute immediately the action', async () => {
          const { aliceIdentityContract, aliceWallet, carolWallet } = await deployIdentityFixture();

          const previousBalance = await hre.ethers.provider.getBalance(carolWallet.address);
          const action = {
            to: carolWallet.address,
            value: 10,
            data: '0x',
          };

          const tx = await aliceIdentityContract
            .connect(aliceWallet)
            .execute(action.to, action.value, action.data, { value: action.value });
          const txReceipt = await tx.wait(1);

          await expect(txReceipt).to.emit(aliceIdentityContract, 'Approved');
          await expect(txReceipt).to.emit(aliceIdentityContract, 'Executed');
          const newBalance = await hre.ethers.provider.getBalance(carolWallet.address);

          expect(newBalance).to.equal(previousBalance + BigInt(action.value));
        });
      });

      describe('when execution is possible (successfull call)', () => {
        it('should emit Executed', async () => {
          const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const aliceIdentityContractAddress = await aliceIdentityContract.getAddress();

          const aliceKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address]));

          const action = {
            to: aliceIdentityContractAddress,
            value: 0,
            data: new hre.ethers.Interface([
              'function addKey(bytes32 key, uint256 purpose, uint256 keyType) returns (bool success)',
            ]).encodeFunctionData('addKey', [aliceKeyHash, 3, 1]),
          };

          const tx = await aliceIdentityContract.connect(aliceWallet).execute(action.to, action.value, action.data);
          const txReceipt = await tx.wait(1);

          await expect(txReceipt).to.emit(aliceIdentityContract, 'Approved');
          await expect(txReceipt).to.emit(aliceIdentityContract, 'Executed');

          const purposes = await aliceIdentityContract.getKeyPurposes(aliceKeyHash);
          expect(purposes).to.deep.equal([1, 3]);
        });
      });

      describe('when execution is not possible (failing call)', () => {
        it('should emit an ExecutionFailed event', async () => {
          const { aliceIdentityContract, aliceWallet, carolWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const aliceIdentityContractAddress = await aliceIdentityContract.getAddress();

          const previousBalance = await hre.ethers.provider.getBalance(carolWallet.address);
          const action = {
            to: aliceIdentityContractAddress,
            value: 0,
            data: new hre.ethers.Interface([
              'function addKey(bytes32 key, uint256 purpose, uint256 keyType) returns (bool success)',
            ]).encodeFunctionData('addKey', [
              hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address])),
              1,
              1,
            ]),
          };

          const tx = await aliceIdentityContract.connect(aliceWallet).execute(action.to, action.value, action.data);
          const txReceipt = await tx.wait(1);

          await expect(txReceipt).to.emit(aliceIdentityContract, 'Approved');
          await expect(txReceipt).to.emit(aliceIdentityContract, 'ExecutionFailed');
          const newBalance = await hre.ethers.provider.getBalance(carolWallet.address);

          expect(newBalance).to.equal(previousBalance + BigInt(action.value));
        });
      });
    });

    describe('when calling execute as an ACTION key', () => {
      describe('when target is the identity contract', () => {
        it('should create an execution request', async () => {
          const { aliceIdentityContract, aliceWallet, bobWallet, carolWallet } = await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const aliceIdentityContractAddress = await aliceIdentityContract.getAddress();

          const aliceKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address]));
          const carolKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [carolWallet.address]));

          let tx = await aliceIdentityContract.connect(aliceWallet).addKey(carolKeyHash, 2, 1);
          await tx.wait(1);

          const action = {
            to: aliceIdentityContractAddress,
            value: 0,
            data: new hre.ethers.Interface([
              'function addKey(bytes32 key, uint256 purpose, uint256 keyType) returns (bool success)',
            ]).encodeFunctionData('addKey', [aliceKeyHash, 2, 1]),
          };

          tx = await aliceIdentityContract
            .connect(carolWallet)
            .execute(action.to, action.value, action.data, { value: action.value });
          const txReceipt = tx.wait(1);

          await expect(txReceipt).to.emit(aliceIdentityContract, 'ExecutionRequested');
        });
      });

      describe('when target is another address', () => {
        it('should emit ExecutionFailed for a failed execution', async () => {
          const { aliceIdentityContract, aliceWallet, carolWallet, bobIdentityContract } =
            await deployIdentityFixture();
          const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

          const bobIdentityContractAddress = await bobIdentityContract.getAddress();

          const carolKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [carolWallet.address]));
          await aliceIdentityContract.connect(aliceWallet).addKey(carolKeyHash, 2, 1);

          const aliceKeyHash = hre.ethers.keccak256(abiCoder.encode(['address'], [aliceWallet.address]));

          const action = {
            to: bobIdentityContractAddress,
            value: 10,
            data: new hre.ethers.Interface([
              'function addKey(bytes32 key, uint256 purpose, uint256 keyType) returns (bool success)',
            ]).encodeFunctionData('addKey', [aliceKeyHash, 3, 1]),
          };

          const previousBalance = await hre.ethers.provider.getBalance(bobIdentityContractAddress);

          const tx = await aliceIdentityContract
            .connect(carolWallet)
            .execute(action.to, action.value, action.data, { value: action.value });
          await expect(tx).to.emit(aliceIdentityContract, 'Approved');
          await expect(tx).to.emit(aliceIdentityContract, 'ExecutionFailed');
          const newBalance = await hre.ethers.provider.getBalance(bobIdentityContractAddress);

          expect(newBalance).to.equal(previousBalance);
        });

        it('should execute immediately the action', async () => {
          const { aliceIdentityContract, aliceWallet, carolWallet, davidWallet } = await deployIdentityFixture();

          const carolKeyHash = hre.ethers.keccak256(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [carolWallet.address]),
          );
          await aliceIdentityContract.connect(aliceWallet).addKey(carolKeyHash, 2, 1);

          const previousBalance = await hre.ethers.provider.getBalance(davidWallet.address);
          const action = {
            to: davidWallet.address,
            value: 10,
            data: '0x',
          };

          const tx = await aliceIdentityContract
            .connect(carolWallet)
            .execute(action.to, action.value, action.data, { value: action.value });
          await expect(tx).to.emit(aliceIdentityContract, 'Approved');
          await expect(tx).to.emit(aliceIdentityContract, 'Executed');
          const newBalance = await hre.ethers.provider.getBalance(davidWallet.address);

          expect(newBalance).to.equal(previousBalance + BigInt(action.value));
        });
      });
    });

    describe('when calling execute as a non-action key', () => {
      it('should create a pending execution request', async () => {
        const { aliceIdentityContract, bobWallet, carolWallet } = await deployIdentityFixture();

        const previousBalance = await hre.ethers.provider.getBalance(carolWallet.address);
        const action = {
          to: carolWallet.address,
          value: 10,
          data: '0x',
        };

        const tx = await aliceIdentityContract
          .connect(bobWallet)
          .execute(action.to, action.value, action.data, { value: action.value });
        await expect(tx).to.emit(aliceIdentityContract, 'ExecutionRequested');
        const newBalance = await hre.ethers.provider.getBalance(carolWallet.address);

        expect(newBalance).to.equal(previousBalance);
      });
    });
  });

  describe('Approve', () => {
    describe('when calling a non-existing execution request', () => {
      it('should revert for execution request not found', async () => {
        const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();

        await expect(aliceIdentityContract.connect(aliceWallet).approve(2, true)).to.be.revertedWith(
          'Cannot approve a non-existing execution',
        );
      });
    });

    describe('when calling an already executed request', () => {
      it('should revert for execution request already executed', async () => {
        const { aliceIdentityContract, aliceWallet, bobWallet } = await deployIdentityFixture();

        await aliceIdentityContract.connect(aliceWallet).execute(bobWallet.address, 10, '0x', { value: 10 });

        await expect(aliceIdentityContract.connect(aliceWallet).approve(0, true)).to.be.revertedWith(
          'Request already executed',
        );
      });
    });

    describe('when calling approve for an execution targeting another address as a non-action key', () => {
      it('should revert for not authorized', async () => {
        const { aliceIdentityContract, bobWallet, carolWallet } = await deployIdentityFixture();

        await aliceIdentityContract.connect(bobWallet).execute(carolWallet.address, 10, '0x', { value: 10 });

        await expect(aliceIdentityContract.connect(bobWallet).approve(0, true)).to.be.revertedWith(
          'Sender does not have action key',
        );
      });
    });

    describe('when calling approve for an execution targeting another address as a non-management key', () => {
      it('should revert for not authorized', async () => {
        const { aliceIdentityContract, davidWallet, bobWallet } = await deployIdentityFixture();
        const aliceIdentityContractAddress = await aliceIdentityContract.getAddress();

        await aliceIdentityContract.connect(bobWallet).execute(aliceIdentityContractAddress, 10, '0x', { value: 10 });

        await expect(aliceIdentityContract.connect(davidWallet).approve(0, true)).to.be.revertedWith(
          'Sender does not have management key',
        );
      });
    });

    describe('when calling approve as a MANAGEMENT key', () => {
      it('should approve the execution request', async () => {
        const { aliceIdentityContract, aliceWallet, bobWallet, carolWallet } = await deployIdentityFixture();

        const previousBalance = await hre.ethers.provider.getBalance(carolWallet.address);
        await aliceIdentityContract.connect(bobWallet).execute(carolWallet.address, 10, '0x', { value: 10 });

        const tx = await aliceIdentityContract.connect(aliceWallet).approve(0, true);
        await expect(tx).to.emit(aliceIdentityContract, 'Approved');
        await expect(tx).to.emit(aliceIdentityContract, 'Executed');
        const newBalance = await hre.ethers.provider.getBalance(carolWallet.address);

        expect(newBalance).to.equal(previousBalance + 10n);
      });

      it('should leave approve to false', async () => {
        const { aliceIdentityContract, aliceWallet, bobWallet, carolWallet } = await deployIdentityFixture();

        const previousBalance = await hre.ethers.provider.getBalance(carolWallet.address);
        await aliceIdentityContract.connect(bobWallet).execute(carolWallet.address, 10, '0x', { value: 10 });

        const tx = await aliceIdentityContract.connect(aliceWallet).approve(0, false);
        await expect(tx).to.emit(aliceIdentityContract, 'Approved');
        const newBalance = await hre.ethers.provider.getBalance(carolWallet.address);

        expect(newBalance).to.equal(previousBalance);
      });
    });
  });
});
