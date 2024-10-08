import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { assert, expect } from 'chai';
import { ethers } from 'hardhat';

import { deployFullSuiteFixture } from './fixtures/deploy-full-suite.fixture';
import { EventLog, Log } from 'ethers';

describe('DVDTransferManager', () => {
  async function deployFullSuiteWithTransferManager() {
    const context = await deployFullSuiteFixture();

    const transferManager = await ethers.deployContract('DVDTransferManager');

    const erc20A = await ethers.deployContract('TestERC20', ['ERC20A', 'ERC20A']);
    await erc20A.mint(context.accounts.deployer.address, 1000);

    const erc20B = await ethers.deployContract('TestERC20', ['ERC20A', 'ERC20A']);
    await erc20B.mint(context.accounts.deployer.address, 1000);

    return {
      ...context,
      suite: {
        ...context.suite,
        transferManager,
        erc20A,
        erc20B,
        erc20C: await ethers.deployContract('TestERC20', ['ERC20C', 'ERC20C']),
      },
    };
  }

  async function deployFullSuiteWithTransferManagerAndInitiatedTransfer() {
    const context = await deployFullSuiteWithTransferManager();

    await context.suite.erc20A.mint(context.accounts.aliceWallet.address, 1000);
    await context.suite.erc20A.connect(context.accounts.aliceWallet).approve(context.suite.transferManager, 1000);
    await context.suite.erc20B.mint(context.accounts.bobWallet.address, 500);
    await context.suite.erc20B.connect(context.accounts.bobWallet).approve(context.suite.transferManager, 500);
    const tx = await context.suite.transferManager
      .connect(context.accounts.aliceWallet)
      .initiateDVDTransfer(context.suite.erc20A, 1000, context.accounts.bobWallet.address, context.suite.erc20B, 500);

    const txReceipt = await tx.wait();
    assert(txReceipt);

    //const event = receipt!.logs.find((e: { event?: string }) => e.event === 'DVDTransferInitiated');
    const log = txReceipt.logs.find(
      (log: Log | EventLog) => 'eventName' in log && log.eventName === 'DVDTransferInitiated',
    );
    assert(log);
    assert('args' in log);

    const transferId = log.args.transferID;

    return {
      ...context,
      values: {
        transferId,
      },
    };
  }

  describe('.modifyFee()', () => {
    describe('when sender is neither the DVD contract owner neither a TREX token owner', () => {
      it('should revert', async () => {
        const {
          suite: { transferManager, erc20A, erc20B },
          accounts: { anotherWallet, charlieWallet, davidWallet },
        } = await deployFullSuiteWithTransferManager();

        await expect(
          transferManager
            .connect(anotherWallet)
            .modifyFee(erc20A, erc20B, 1, 1, 1, charlieWallet.address, davidWallet.address),
        ).to.be.revertedWith('Ownable: only owner can call');
      });
    });

    describe('when sender is a TREX token owner', () => {
      it('should revert for invalid fee settings', async () => {
        const {
          suite: { transferManager, token, erc20A },
          accounts: { deployer, charlieWallet, davidWallet },
        } = await deployFullSuiteWithTransferManager();

        await expect(
          transferManager
            .connect(deployer)
            .modifyFee(token, erc20A, 1, 1, 1, charlieWallet.address, davidWallet.address),
        ).to.be.revertedWith('invalid fee settings');
      });

      it('should revert for invalid fee settings', async () => {
        const {
          suite: { transferManager, token, erc20A },
          accounts: { deployer, charlieWallet, davidWallet },
        } = await deployFullSuiteWithTransferManager();

        await expect(
          transferManager
            .connect(deployer)
            .modifyFee(erc20A, token, 1, 1, 1, charlieWallet.address, davidWallet.address),
        ).to.be.revertedWith('invalid fee settings');
      });
    });

    describe('when sender is the DVD contract owner', () => {
      describe('when fee settings are not valid', () => {
        describe('when fee1 is above max for feeBase', () => {
          it('should revert', async () => {
            const {
              suite: { transferManager, erc20A, erc20B },
              accounts: { deployer, charlieWallet, davidWallet },
            } = await deployFullSuiteWithTransferManager();

            await expect(
              transferManager
                .connect(deployer)
                .modifyFee(erc20A, erc20B, 1000, 1, 2, charlieWallet.address, davidWallet.address),
            ).to.be.revertedWith('invalid fee settings');
          });
        });

        describe('when fee2 is above max for feeBase', () => {
          it('should revert', async () => {
            const {
              suite: { transferManager, erc20A, erc20B },
              accounts: { deployer, charlieWallet, davidWallet },
            } = await deployFullSuiteWithTransferManager();

            await expect(
              transferManager
                .connect(deployer)
                .modifyFee(erc20A, erc20B, 1, 1000, 2, charlieWallet.address, davidWallet.address),
            ).to.be.revertedWith('invalid fee settings');
          });
        });

        describe('when feeBase is less than 2', () => {
          it('should revert', async () => {
            const {
              suite: { transferManager, erc20A, erc20B },
              accounts: { deployer, charlieWallet, davidWallet },
            } = await deployFullSuiteWithTransferManager();

            await expect(
              transferManager
                .connect(deployer)
                .modifyFee(erc20A, erc20B, 0, 0, 1, charlieWallet.address, davidWallet.address),
            ).to.be.revertedWith('invalid fee settings');
          });
        });

        describe('when feeBase is more than 5', () => {
          it('should revert', async () => {
            const {
              suite: { transferManager, erc20A, erc20B },
              accounts: { deployer, charlieWallet, davidWallet },
            } = await deployFullSuiteWithTransferManager();

            await expect(
              transferManager
                .connect(deployer)
                .modifyFee(erc20A, erc20B, 1000, 1, 10, charlieWallet.address, davidWallet.address),
            ).to.be.revertedWith('invalid fee settings');
          });
        });

        describe('when fee1 is set, then fee1Wallet cannot be zero address', () => {
          it('should revert', async () => {
            const {
              suite: { transferManager, erc20A, erc20B },
              accounts: { deployer, davidWallet },
            } = await deployFullSuiteWithTransferManager();

            await expect(
              transferManager
                .connect(deployer)
                .modifyFee(erc20A, erc20B, 2, 0, 2, ethers.ZeroAddress, davidWallet.address),
            ).to.be.revertedWith('fee wallet 1 cannot be zero address');
          });
        });

        describe('when fee2 is set, then fee2Wallet cannot be zero address', () => {
          it('should revert', async () => {
            const {
              suite: { transferManager, erc20A, erc20B },
              accounts: { deployer },
            } = await deployFullSuiteWithTransferManager();

            await expect(
              transferManager
                .connect(deployer)
                .modifyFee(erc20A, erc20B, 0, 1, 2, ethers.ZeroAddress, ethers.ZeroAddress),
            ).to.be.revertedWith('fee wallet 2 cannot be zero address');
          });
        });
      });

      describe('when fee settings are valid', () => {
        it('should set fee settings', async () => {
          const {
            suite: { transferManager, erc20A, erc20B },
            accounts: { deployer, charlieWallet, davidWallet },
          } = await deployFullSuiteWithTransferManager();

          const erc20AAddress = await erc20A.getAddress();
          const erc20BAddress = await erc20B.getAddress();

          const tx = await transferManager
            .connect(deployer)
            .modifyFee(erc20A, erc20B, 2, 1, 2, charlieWallet.address, davidWallet.address);
          await expect(tx)
            .to.emit(transferManager, 'FeeModified')
            .withArgs(
              ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address'], [erc20AAddress, erc20BAddress]),
              ),
              erc20A,
              erc20B,
              2,
              1,
              2,
              charlieWallet.address,
              davidWallet.address,
            );
          await expect(tx)
            .to.emit(transferManager, 'FeeModified')
            .withArgs(
              ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address'], [erc20BAddress, erc20AAddress]),
              ),
              erc20B,
              erc20A,
              1,
              2,
              2,
              davidWallet.address,
              charlieWallet.address,
            );
        });

        it('should set fee settings', async () => {
          const {
            suite: { transferManager, erc20A, erc20B },
            accounts: { deployer, charlieWallet },
          } = await deployFullSuiteWithTransferManager();

          const erc20AAddress = await erc20A.getAddress();
          const erc20BAddress = await erc20B.getAddress();

          const tx = await transferManager
            .connect(deployer)
            .modifyFee(erc20A, erc20B, 2, 0, 2, charlieWallet.address, ethers.ZeroAddress);
          await expect(tx)
            .to.emit(transferManager, 'FeeModified')
            .withArgs(
              ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address'], [erc20AAddress, erc20BAddress]),
              ),
              erc20A,
              erc20B,
              2,
              0,
              2,
              charlieWallet.address,
              ethers.ZeroAddress,
            );
          await expect(tx)
            .to.emit(transferManager, 'FeeModified')
            .withArgs(
              ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address'], [erc20BAddress, erc20AAddress]),
              ),
              erc20B,
              erc20A,
              0,
              2,
              2,
              ethers.ZeroAddress,
              charlieWallet.address,
            );
        });
      });
    });
  });

  describe('.initiateDVDTransfer()', () => {
    describe('when sender has not enough balance to initiate the transfer', () => {
      it('should revert', async () => {
        const {
          suite: { transferManager, erc20A, erc20B },
          accounts: { charlieWallet },
        } = await deployFullSuiteWithTransferManager();

        await expect(
          transferManager.connect(charlieWallet).initiateDVDTransfer(erc20A, 1000, charlieWallet.address, erc20B, 1000),
        ).to.be.revertedWith('Not enough tokens in balance');
      });
    });

    describe('when sender has not setup a sufficient allowance', () => {
      it('should revert', async () => {
        const {
          suite: { transferManager, erc20A, erc20B },
          accounts: { deployer, charlieWallet, davidWallet },
        } = await deployFullSuiteWithTransferManager();

        await erc20A.connect(deployer).mint(charlieWallet.address, 1000);
        await expect(
          transferManager.connect(charlieWallet).initiateDVDTransfer(erc20A, 1000, davidWallet.address, erc20B, 1000),
        ).to.be.revertedWith('not enough allowance to initiate transfer');
      });
    });

    describe('when counterpart is zero address', () => {
      it('should revert', async () => {
        const {
          suite: { transferManager, erc20A, erc20B },
          accounts: { deployer, charlieWallet },
        } = await deployFullSuiteWithTransferManager();

        await erc20A.connect(deployer).mint(charlieWallet.address, 1000);
        await erc20A.connect(charlieWallet).approve(transferManager, 1000);
        await expect(
          transferManager.connect(charlieWallet).initiateDVDTransfer(erc20A, 1000, ethers.ZeroAddress, erc20B, 1000),
        ).to.be.revertedWith('counterpart cannot be null');
      });
    });

    describe('when token2 has no supply', () => {
      it('should revert', async () => {
        const {
          suite: { transferManager, erc20A, erc20C },
          accounts: { deployer, charlieWallet, davidWallet },
        } = await deployFullSuiteWithTransferManager();

        await erc20A.connect(deployer).mint(charlieWallet.address, 1000);
        await erc20A.connect(charlieWallet).approve(transferManager, 1000);
        await expect(
          transferManager.connect(charlieWallet).initiateDVDTransfer(erc20A, 1000, davidWallet.address, erc20C, 1000),
        ).to.be.revertedWith('invalid address : address is not an ERC20');
      });
    });

    describe('when transfer condition are met', () => {
      it('should store an initiated transfer', async () => {
        const {
          suite: { transferManager, erc20A, erc20B },
          accounts: { deployer, charlieWallet, davidWallet },
        } = await deployFullSuiteWithTransferManager();

        await erc20A.connect(deployer).mint(charlieWallet.address, 1000);
        await erc20A.connect(charlieWallet).approve(transferManager, 1000);
        const tx = await transferManager
          .connect(charlieWallet)
          .initiateDVDTransfer(erc20A, 1000, davidWallet.address, erc20B, 500);
        await expect(tx)
          .to.emit(transferManager, 'DVDTransferInitiated')
          .withArgs(anyValue, charlieWallet.address, erc20A, 1000, davidWallet.address, erc20B, 500);
      });
    });
  });

  describe('.cancelDVDTransfer()', () => {
    describe('when transfer was not initiated', () => {
      it('should revert', async () => {
        const {
          suite: { transferManager },
          accounts: { charlieWallet },
        } = await deployFullSuiteWithTransferManager();

        await expect(transferManager.connect(charlieWallet).cancelDVDTransfer(ethers.ZeroHash)).to.be.revertedWith(
          'transfer ID does not exist',
        );
      });
    });

    describe('when sender is a wallet not related to the transfer', () => {
      it('should revert', async () => {
        const {
          suite: { transferManager },
          accounts: { anotherWallet },
          values: { transferId },
        } = await deployFullSuiteWithTransferManagerAndInitiatedTransfer();

        await expect(transferManager.connect(anotherWallet).cancelDVDTransfer(transferId)).to.be.revertedWith(
          'you are not allowed to cancel this transfer',
        );
      });
    });

    describe('when sender is the original initiator of the transfer', () => {
      it('should cancel the transfer', async () => {
        const {
          suite: { transferManager },
          accounts: { aliceWallet },
          values: { transferId },
        } = await deployFullSuiteWithTransferManagerAndInitiatedTransfer();

        const tx = await transferManager.connect(aliceWallet).cancelDVDTransfer(transferId);
        await expect(tx).to.emit(transferManager, 'DVDTransferCancelled').withArgs(transferId);
        await expect(transferManager.connect(aliceWallet).cancelDVDTransfer(transferId)).to.be.revertedWith(
          'transfer ID does not exist',
        );
      });
    });

    describe('when sender is the original counterpart of the transfer', () => {
      it('should cancel the transfer', async () => {
        const {
          suite: { transferManager },
          accounts: { bobWallet },
          values: { transferId },
        } = await deployFullSuiteWithTransferManagerAndInitiatedTransfer();

        const tx = await transferManager.connect(bobWallet).cancelDVDTransfer(transferId);
        await expect(tx).to.emit(transferManager, 'DVDTransferCancelled').withArgs(transferId);
        await expect(transferManager.connect(bobWallet).cancelDVDTransfer(transferId)).to.be.revertedWith(
          'transfer ID does not exist',
        );
      });
    });

    describe('when sender is the owner of the transfer manager contract', () => {
      it('should cancel the transfer', async () => {
        const {
          suite: { transferManager },
          accounts: { deployer },
          values: { transferId },
        } = await deployFullSuiteWithTransferManagerAndInitiatedTransfer();

        const tx = await transferManager.connect(deployer).cancelDVDTransfer(transferId);
        await expect(tx).to.emit(transferManager, 'DVDTransferCancelled').withArgs(transferId);
        await expect(transferManager.connect(deployer).cancelDVDTransfer(transferId)).to.be.revertedWith(
          'transfer ID does not exist',
        );
      });
    });

    describe('when sender is the owner of the TREX token 1 manager contract', () => {
      it('should cancel the transfer', async () => {
        const {
          suite: { transferManager },
          accounts: { deployer },
          values: { transferId },
        } = await deployFullSuiteWithTransferManagerAndInitiatedTransfer();

        const tx = await transferManager.connect(deployer).cancelDVDTransfer(transferId);
        await expect(tx).to.emit(transferManager, 'DVDTransferCancelled').withArgs(transferId);
        await expect(transferManager.connect(deployer).cancelDVDTransfer(transferId)).to.be.revertedWith(
          'transfer ID does not exist',
        );
      });
    });
  });

  describe('.takeDVDTransfer()', () => {
    describe('when transfer was not initiated', () => {
      it('should revert', async () => {
        const {
          suite: { transferManager },
          accounts: { charlieWallet },
        } = await deployFullSuiteWithTransferManager();

        await expect(transferManager.connect(charlieWallet).takeDVDTransfer(ethers.ZeroHash)).to.be.revertedWith(
          'transfer ID does not exist',
        );
      });
    });

    describe('when transfer was initiated', () => {
      describe('when sender is neither the counterpart neither a contract owner', () => {
        it('should revert', async () => {
          const {
            suite: { transferManager },
            accounts: { anotherWallet },
            values: { transferId },
          } = await deployFullSuiteWithTransferManagerAndInitiatedTransfer();

          await expect(transferManager.connect(anotherWallet).takeDVDTransfer(transferId)).to.be.revertedWith(
            'transfer has to be done by the counterpart or by owner',
          );
        });
      });

      describe('when sender is the counterpart and transfer has fees', () => {
        it('should execute the transfer with fees', async () => {
          const {
            suite: { transferManager, erc20A, erc20B },
            accounts: { aliceWallet, bobWallet, charlieWallet, davidWallet },
            values: { transferId },
          } = await deployFullSuiteWithTransferManagerAndInitiatedTransfer();

          await transferManager.modifyFee(erc20A, erc20B, 1, 2, 2, charlieWallet.address, davidWallet.address);

          const tx = await transferManager.connect(bobWallet).takeDVDTransfer(transferId);
          await expect(tx).to.emit(transferManager, 'DVDTransferExecuted').withArgs(transferId);
          await expect(tx).to.emit(erc20A, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 990);
          await expect(tx).to.emit(erc20A, 'Transfer').withArgs(aliceWallet.address, charlieWallet.address, 10);
          await expect(tx).to.emit(erc20B, 'Transfer').withArgs(bobWallet.address, aliceWallet.address, 490);
          await expect(tx).to.emit(erc20B, 'Transfer').withArgs(bobWallet.address, davidWallet.address, 10);
          await expect(transferManager.connect(bobWallet).takeDVDTransfer(transferId)).to.be.revertedWith(
            'transfer ID does not exist',
          );
        });
      });

      describe('when sender is the counterpart and transfer has no fees', () => {
        it('should execute the transfer without fees', async () => {
          const {
            suite: { transferManager, erc20A, erc20B },
            accounts: { aliceWallet, bobWallet },
            values: { transferId },
          } = await deployFullSuiteWithTransferManagerAndInitiatedTransfer();

          const tx = await transferManager.connect(bobWallet).takeDVDTransfer(transferId);
          await expect(tx).to.emit(transferManager, 'DVDTransferExecuted').withArgs(transferId);
          await expect(tx).to.emit(erc20A, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 1000);
          await expect(tx).to.emit(erc20B, 'Transfer').withArgs(bobWallet.address, aliceWallet.address, 500);
          await expect(transferManager.connect(bobWallet).takeDVDTransfer(transferId)).to.be.revertedWith(
            'transfer ID does not exist',
          );
        });
      });
    });
  });

  describe('.isTREXAgent()', () => {
    describe('when address is not a TREX agent', () => {
      it('should return false', async () => {
        const {
          suite: { transferManager, token },
          accounts: { anotherWallet },
        } = await deployFullSuiteWithTransferManager();

        expect(await transferManager.isTREXAgent(token, anotherWallet.address)).to.be.false;
      });
    });

    describe('when address is a TREX agent', () => {
      it('should return true', async () => {
        const {
          suite: { transferManager, token },
          accounts: { tokenAgent },
        } = await deployFullSuiteWithTransferManager();

        expect(await transferManager.isTREXAgent(token, tokenAgent.address)).to.be.true;
      });
    });
  });

  describe('.isTREXOwner()', () => {
    describe('when address is not a TREX owner', () => {
      it('should return false', async () => {
        const {
          suite: { transferManager, token },
          accounts: { anotherWallet },
        } = await deployFullSuiteWithTransferManager();

        expect(await transferManager.isTREXOwner(token, anotherWallet.address)).to.be.false;
      });
    });

    describe('when address is a TREX agent', () => {
      it('should return true', async () => {
        const {
          suite: { transferManager, token },
          accounts: { deployer },
        } = await deployFullSuiteWithTransferManager();

        expect(await transferManager.isTREXOwner(token, deployer.address)).to.be.true;
      });
    });
  });

  describe('.isTREXToken()', () => {
    describe('When token does not have an Identity Registry (probably not a ERC3643 token', () => {
      it('should return false', async () => {
        const {
          suite: { transferManager, token },
        } = await deployFullSuiteWithTransferManager();

        await token.setIdentityRegistry(ethers.ZeroAddress);

        expect(await transferManager.isTREX(token)).to.be.false;
      });
    });
  });
});
