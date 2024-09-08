import { expect } from 'chai';
import hre, { ethers } from 'hardhat';

import { deployFullSuiteFixture } from './fixtures/deploy-full-suite.fixture';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { DVATransferManager, Identity, IdentityRegistry, Token } from '../../types';
import { encrypt64, getLogEventArgs } from '../utils';

describe('DVATransferManager', () => {
  async function deployFullSuiteWithTransferManager() {
    const context = await deployFullSuiteFixture();

    const transferManager = (await ethers.deployContract('DVATransferManager')) as any as DVATransferManager;

    return {
      ...context,
      suite: {
        ...context.suite,
        transferManager,
      },
    };
  }

  async function deployFullSuiteWithVerifiedTransferManager() {
    const context = await deployFullSuiteWithTransferManager();
    const identity = await context.suite.identityRegistry.identity(context.accounts.aliceWallet.address);
    const identityRegistry = context.suite.identityRegistry as any as IdentityRegistry;
    await identityRegistry
      .connect(context.accounts.tokenAgent)
      .registerIdentity(context.suite.transferManager, identity, 0);
    return context;
  }

  async function signTransfer(
    transferID: string,
    signer: SignerWithAddress,
  ): Promise<{
    v: number;
    r: string;
    s: string;
  }> {
    const rawSignature = await signer.signMessage(ethers.getBytes(transferID));
    const { v, r, s } = ethers.Signature.from(rawSignature);
    return { v, r, s };
  }

  async function deployFullSuiteWithNonSequentialTransfer() {
    const context = await deployFullSuiteWithVerifiedTransferManager();
    await context.suite.transferManager
      .connect(context.accounts.tokenAgent)
      .setApprovalCriteria(context.suite.token, true, true, false, [context.accounts.charlieWallet.address]);

    const token = context.suite.token;

    const encValue = await encrypt64(token, context.accounts.aliceWallet, 100000);
    await token
      .connect(context.accounts.aliceWallet)
      ['approve(address,bytes32,bytes)'](context.suite.transferManager, encValue.handles[0], encValue.inputProof);

    const encHundred = await encrypt64(context.suite.transferManager, context.accounts.aliceWallet, 100);
    const encHundredHandle = encHundred.handles[0];
    const transferID = await context.suite.transferManager.calculateTransferID(
      0,
      context.accounts.aliceWallet.address,
      context.accounts.bobWallet.address,
      ethers.toBigInt(encHundredHandle),
    );

    await context.suite.transferManager
      .connect(context.accounts.aliceWallet)
      .initiateTransfer(
        context.suite.token,
        context.accounts.bobWallet.address,
        encHundredHandle,
        encHundred.inputProof,
      );

    return {
      ...context,
      transferID,
    };
  }

  async function deployFullSuiteWithSequentialTransfer() {
    const context = await deployFullSuiteWithVerifiedTransferManager();
    await context.suite.transferManager
      .connect(context.accounts.tokenAgent)
      .setApprovalCriteria(context.suite.token, true, true, true, [context.accounts.charlieWallet.address]);

    const token = context.suite.token;

    const encValue = await encrypt64(token, context.accounts.aliceWallet, 100000);
    await token
      .connect(context.accounts.aliceWallet)
      ['approve(address,bytes32,bytes)'](context.suite.transferManager, encValue.handles[0], encValue.inputProof);

    const encHundred = await encrypt64(context.suite.transferManager, context.accounts.aliceWallet, 100);
    const encHundredHandle = encHundred.handles[0];
    const transferID = await context.suite.transferManager.calculateTransferID(
      0,
      context.accounts.aliceWallet.address,
      context.accounts.bobWallet.address,
      ethers.toBigInt(encHundredHandle),
    );

    await context.suite.transferManager
      .connect(context.accounts.aliceWallet)
      .initiateTransfer(
        context.suite.token,
        context.accounts.bobWallet.address,
        encHundredHandle,
        encHundred.inputProof,
      );

    return {
      ...context,
      transferID,
    };
  }

  describe('.setApprovalCriteria', () => {
    describe('when sender is not a token agent', () => {
      it('should revert', async () => {
        const context = await deployFullSuiteWithTransferManager();

        await expect(
          context.suite.transferManager
            .connect(context.accounts.anotherWallet)
            .setApprovalCriteria(context.suite.token, false, true, true, []),
        ).to.be.revertedWithCustomError(context.suite.transferManager, `OnlyTokenAgentCanCall`);
      });
    });

    describe('when sender is a token agent', () => {
      describe('when DVA Manager is not verified for the token', () => {
        it('should revert', async () => {
          const context = await deployFullSuiteWithTransferManager();

          await expect(
            context.suite.transferManager
              .connect(context.accounts.tokenAgent)
              .setApprovalCriteria(context.suite.token, false, true, true, []),
          ).to.be.revertedWithCustomError(context.suite.transferManager, `DVAManagerIsNotVerifiedForTheToken`);
        });
      });

      describe('when DVA Manager is verified for the token', () => {
        describe('when token is not already registered', () => {
          it('should modify approval criteria', async () => {
            const context = await deployFullSuiteWithTransferManager();
            const identity = await context.suite.identityRegistry.identity(context.accounts.aliceWallet.address);
            await context.suite.identityRegistry
              .connect(context.accounts.tokenAgent)
              .registerIdentity(context.suite.transferManager, identity, 0);

            const tx = await context.suite.transferManager
              .connect(context.accounts.tokenAgent)
              .setApprovalCriteria(context.suite.token, true, true, true, [
                context.accounts.anotherWallet.address,
                context.accounts.bobWallet.address,
              ]);
            tx.wait(1);

            const approvalCriteria = await context.suite.transferManager.getApprovalCriteria(context.suite.token);

            expect(approvalCriteria.includeRecipientApprover).to.be.true;
            expect(approvalCriteria.includeAgentApprover).to.be.true;
            expect(approvalCriteria.sequentialApproval).to.be.true;
            expect(approvalCriteria.additionalApprovers).to.be.eql([
              context.accounts.anotherWallet.address,
              context.accounts.bobWallet.address,
            ]);

            await expect(tx)
              .to.emit(context.suite.transferManager, 'ApprovalCriteriaSet')
              .withArgs(
                context.suite.token,
                true,
                true,
                true,
                [context.accounts.anotherWallet.address, context.accounts.bobWallet.address],
                approvalCriteria.hash,
              );
          });
        });

        describe('when token is already registered', () => {
          it('should modify approval criteria', async () => {
            const context = await deployFullSuiteWithTransferManager();
            const identity = await context.suite.identityRegistry.identity(context.accounts.aliceWallet.address);
            await context.suite.identityRegistry
              .connect(context.accounts.tokenAgent)
              .registerIdentity(context.suite.transferManager, identity, 0);

            await context.suite.transferManager
              .connect(context.accounts.tokenAgent)
              .setApprovalCriteria(context.suite.token, true, true, true, [
                context.accounts.anotherWallet.address,
                context.accounts.bobWallet.address,
              ]);

            const previousApprovalCriteria = await context.suite.transferManager.getApprovalCriteria(
              context.suite.token,
            );

            const tx = await context.suite.transferManager
              .connect(context.accounts.tokenAgent)
              .setApprovalCriteria(context.suite.token, false, false, false, [context.accounts.davidWallet.address]);

            await tx.wait();
            const approvalCriteria = await context.suite.transferManager.getApprovalCriteria(context.suite.token);
            expect(approvalCriteria.includeRecipientApprover).to.be.false;
            expect(approvalCriteria.includeAgentApprover).to.be.false;
            expect(approvalCriteria.sequentialApproval).to.be.false;
            expect(approvalCriteria.additionalApprovers).to.be.eql([context.accounts.davidWallet.address]);
            expect(approvalCriteria.hash.toString()).not.to.be.eq(previousApprovalCriteria.hash.toString());

            await expect(tx)
              .to.emit(context.suite.transferManager, 'ApprovalCriteriaSet')
              .withArgs(
                context.suite.token,
                false,
                false,
                false,
                [context.accounts.davidWallet.address],
                approvalCriteria.hash,
              );
          });
        });
      });
    });
  });

  describe('.initiateTransfer', () => {
    describe('when token is not registered to the DVA manager', () => {
      it('should revert', async () => {
        const context = await deployFullSuiteWithTransferManager();

        const encValue = await encrypt64(context.suite.transferManager, context.accounts.aliceWallet, 10);

        await expect(
          context.suite.transferManager
            .connect(context.accounts.aliceWallet)
            .initiateTransfer(
              context.suite.token,
              context.accounts.bobWallet.address,
              encValue.handles[0],
              encValue.inputProof,
            ),
        ).to.be.revertedWithCustomError(context.suite.transferManager, `TokenIsNotRegistered`);
      });
    });

    describe('when token is registered to the DVA manager', () => {
      describe('when recipient is not verified for the token', () => {
        it('should revert', async () => {
          const context = await deployFullSuiteWithVerifiedTransferManager();
          await context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .setApprovalCriteria(context.suite.token, true, true, true, [
              context.accounts.charlieWallet.address,
              context.accounts.anotherWallet.address,
            ]);

          const encValue = await encrypt64(context.suite.transferManager, context.accounts.aliceWallet, 10);

          await expect(
            context.suite.transferManager
              .connect(context.accounts.aliceWallet)
              .initiateTransfer(
                context.suite.token,
                context.accounts.anotherWallet.address,
                encValue.handles[0],
                encValue.inputProof,
              ),
          ).to.be.revertedWithCustomError(context.suite.transferManager, `RecipientIsNotVerified`);
        });
      });
    });
  });

  describe('.approveTransfer', () => {
    describe('when transfer does not exist', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithVerifiedTransferManager();
        const transferID = await context.suite.transferManager.calculateTransferID(
          0,
          context.accounts.aliceWallet.address,
          context.accounts.bobWallet.address,
          100,
        );

        await expect(context.suite.transferManager.approveTransfer(transferID)).to.be.revertedWithCustomError(
          context.suite.transferManager,
          `InvalidTransferID`,
        );
      });
    });

    describe('when transfer status is not pending', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithNonSequentialTransfer();
        await context.suite.transferManager.connect(context.accounts.aliceWallet).cancelTransfer(context.transferID);

        await expect(context.suite.transferManager.approveTransfer(context.transferID)).to.be.revertedWithCustomError(
          context.suite.transferManager,
          `TransferIsNotInPendingStatus`,
        );
      });
    });

    describe('when approval criteria are changed after the transfer has been initiated', () => {
      describe('when trying to approve before approval state reset', () => {
        // OK
        it('should reset approvers', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          const modifyTx = await context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .setApprovalCriteria(context.suite.token, false, false, false, [context.accounts.davidWallet.address]);

          await modifyTx.wait();
          const tx = context.suite.transferManager
            .connect(context.accounts.charlieWallet)
            .approveTransfer(context.transferID);
          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApprovalStateReset')
            .withArgs(
              context.transferID,
              (await context.suite.transferManager.getApprovalCriteria(context.suite.token)).hash,
            );

          await (await tx).wait();
          const transfer = await context.suite.transferManager.getTransfer(context.transferID);
          expect(transfer.approvers.length).to.be.eq(1);
          expect(transfer.approvers[0]['wallet']).to.be.eq(context.accounts.davidWallet.address);
          expect(transfer.approvers[0]['approved']).to.be.false;
        });
      });

      describe('when trying to approve after approval state reset', () => {
        // OK
        it('should approve', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          const modifyTx = await context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .setApprovalCriteria(context.suite.token, false, false, false, [context.accounts.davidWallet.address]);

          await modifyTx.wait();
          const resetTx = await context.suite.transferManager
            .connect(context.accounts.charlieWallet)
            .approveTransfer(context.transferID);
          await resetTx.wait();

          const tx = context.suite.transferManager
            .connect(context.accounts.davidWallet)
            .approveTransfer(context.transferID);
          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApproved')
            .withArgs(context.transferID, context.accounts.davidWallet.address);
        });
      });
    });

    describe('when sequential approval is disabled', () => {
      describe('when caller is not an approver', () => {
        // OK
        it('should revert', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          await expect(context.suite.transferManager.approveTransfer(context.transferID)).to.be.revertedWithCustomError(
            context.suite.transferManager,
            `ApproverNotFound`,
          );
        });
      });

      describe('when caller is the last approver', () => {
        // OK
        it('should approve', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          const tx = context.suite.transferManager
            .connect(context.accounts.charlieWallet)
            .approveTransfer(context.transferID);
          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApproved')
            .withArgs(context.transferID, context.accounts.charlieWallet.address);
        });
      });
    });

    describe('when sequential approval is enabled', () => {
      describe('when caller is not the next approver', () => {
        // OK
        it('should revert', async () => {
          const context = await deployFullSuiteWithSequentialTransfer();
          await expect(
            context.suite.transferManager.connect(context.accounts.charlieWallet).approveTransfer(context.transferID),
          ).to.be.revertedWithCustomError(context.suite.transferManager, `ApprovalsMustBeSequential`);
        });
      });

      describe('when caller is the next approver and it is a token agent', () => {
        // OK
        it('should approve', async () => {
          const context = await deployFullSuiteWithSequentialTransfer();
          await context.suite.transferManager.connect(context.accounts.bobWallet).approveTransfer(context.transferID);
          const tx = context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .approveTransfer(context.transferID);

          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApproved')
            .withArgs(context.transferID, context.accounts.tokenAgent.address);
        });
      });
    });
  });

  describe('.delegateApproveTransfer', () => {
    describe('when signatures array is empty', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithVerifiedTransferManager();
        const transferID = await context.suite.transferManager.calculateTransferID(
          0,
          context.accounts.aliceWallet.address,
          context.accounts.bobWallet.address,
          100,
        );

        await expect(
          context.suite.transferManager.delegateApproveTransfer(transferID, []),
        ).to.be.revertedWithCustomError(context.suite.transferManager, `SignaturesCanNotBeEmpty`);
      });
    });

    describe('when transfer does not exist', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithVerifiedTransferManager();
        const transferID = await context.suite.transferManager.calculateTransferID(
          0,
          context.accounts.aliceWallet.address,
          context.accounts.bobWallet.address,
          100,
        );

        await expect(
          context.suite.transferManager.delegateApproveTransfer(transferID, [
            await signTransfer(transferID, context.accounts.charlieWallet),
          ]),
        ).to.be.revertedWithCustomError(context.suite.transferManager, `InvalidTransferID`);
      });
    });

    describe('when transfer status is not pending', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithNonSequentialTransfer();
        await context.suite.transferManager.connect(context.accounts.aliceWallet).cancelTransfer(context.transferID);

        await expect(
          context.suite.transferManager.delegateApproveTransfer(context.transferID, [
            await signTransfer(context.transferID, context.accounts.charlieWallet),
          ]),
        ).to.be.revertedWithCustomError(context.suite.transferManager, `TransferIsNotInPendingStatus`);
      });
    });

    describe('when approval criteria are changed after the transfer has been initiated', () => {
      describe('when trying to approve before approval state reset', () => {
        // OK
        it('should reset approvers', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          const modifyTx = await context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .setApprovalCriteria(context.suite.token, false, false, false, [context.accounts.davidWallet.address]);

          await modifyTx.wait();
          const tx = context.suite.transferManager
            .connect(context.accounts.anotherWallet)
            .delegateApproveTransfer(context.transferID, [
              await signTransfer(context.transferID, context.accounts.charlieWallet),
            ]);

          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApprovalStateReset')
            .withArgs(
              context.transferID,
              (await context.suite.transferManager.getApprovalCriteria(context.suite.token)).hash,
            );

          await (await tx).wait();
          const transfer = await context.suite.transferManager.getTransfer(context.transferID);
          expect(transfer.approvers.length).to.be.eq(1);
          expect(transfer.approvers[0]['wallet']).to.be.eq(context.accounts.davidWallet.address);
          expect(transfer.approvers[0]['approved']).to.be.false;
        });
      });

      describe('when trying to approve after approval state reset', () => {
        // OK
        it('should approve', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          const modifyTx = await context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .setApprovalCriteria(context.suite.token, false, false, false, [context.accounts.davidWallet.address]);

          await modifyTx.wait();
          const resetTx = await context.suite.transferManager
            .connect(context.accounts.charlieWallet)
            .approveTransfer(context.transferID);
          await resetTx.wait();

          const tx = context.suite.transferManager
            .connect(context.accounts.anotherWallet)
            .delegateApproveTransfer(context.transferID, [
              await signTransfer(context.transferID, context.accounts.davidWallet),
            ]);
          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApproved')
            .withArgs(context.transferID, context.accounts.davidWallet.address);
        });
      });
    });

    describe('when sequential approval is disabled', () => {
      describe('when caller is not an approver', () => {
        // OK
        it('should revert', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          await expect(
            context.suite.transferManager.delegateApproveTransfer(context.transferID, [
              await signTransfer(context.transferID, context.accounts.anotherWallet),
            ]),
          ).to.be.revertedWithCustomError(context.suite.transferManager, `ApproverNotFound`);
        });
      });

      describe('when signer is an approver', () => {
        // OK
        it('should approve', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          const tx = context.suite.transferManager
            .connect(context.accounts.anotherWallet)
            .delegateApproveTransfer(context.transferID, [
              await signTransfer(context.transferID, context.accounts.charlieWallet),
            ]);

          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApproved')
            .withArgs(context.transferID, context.accounts.charlieWallet.address);
        });
      });
    });
  });

  describe('.cancelTransfer', () => {
    describe('when transfer does not exist', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithVerifiedTransferManager();
        const transferID = await context.suite.transferManager.calculateTransferID(
          0,
          context.accounts.aliceWallet.address,
          context.accounts.bobWallet.address,
          100,
        );

        await expect(context.suite.transferManager.cancelTransfer(transferID)).to.be.revertedWithCustomError(
          context.suite.transferManager,
          `InvalidTransferID`,
        );
      });
    });

    describe('when caller is not sender', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithNonSequentialTransfer();
        await expect(
          context.suite.transferManager.connect(context.accounts.bobWallet).cancelTransfer(context.transferID),
        ).to.be.revertedWithCustomError(context.suite.transferManager, `OnlyTransferSenderCanCall`);
      });
    });

    describe('when transfer status is not pending', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithNonSequentialTransfer();
        await context.suite.transferManager.connect(context.accounts.aliceWallet).cancelTransfer(context.transferID);

        await expect(
          context.suite.transferManager.connect(context.accounts.aliceWallet).cancelTransfer(context.transferID),
        ).to.be.revertedWithCustomError(context.suite.transferManager, `TransferIsNotInPendingStatus`);
      });
    });
  });

  describe('.rejectTransfer', () => {
    describe('when transfer does not exist', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithVerifiedTransferManager();
        const transferID = await context.suite.transferManager.calculateTransferID(
          0,
          context.accounts.aliceWallet.address,
          context.accounts.bobWallet.address,
          100,
        );

        await expect(context.suite.transferManager.rejectTransfer(transferID)).to.be.revertedWithCustomError(
          context.suite.transferManager,
          `InvalidTransferID`,
        );
      });
    });

    describe('when transfer status is not pending', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithNonSequentialTransfer();
        await context.suite.transferManager.connect(context.accounts.aliceWallet).cancelTransfer(context.transferID);

        await expect(context.suite.transferManager.rejectTransfer(context.transferID)).to.be.revertedWithCustomError(
          context.suite.transferManager,
          `TransferIsNotInPendingStatus`,
        );
      });
    });

    describe('when sequential approval is disabled', () => {
      describe('when caller is not an approver', () => {
        // OK
        it('should revert', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          await expect(context.suite.transferManager.rejectTransfer(context.transferID)).to.be.revertedWithCustomError(
            context.suite.transferManager,
            `ApproverNotFound`,
          );
        });
      });
    });

    describe('when sequential approval is enabled', () => {
      describe('when caller is not the next approver', () => {
        // OK
        it('should revert', async () => {
          const context = await deployFullSuiteWithSequentialTransfer();
          await expect(
            context.suite.transferManager.connect(context.accounts.charlieWallet).rejectTransfer(context.transferID),
          ).to.be.revertedWithCustomError(context.suite.transferManager, `ApprovalsMustBeSequential`);
        });
      });
    });

    describe('when approval criteria are changed after the transfer has been initiated', () => {
      describe('when trying to reject before approval state reset', () => {
        // OK
        it('should reset approvers', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          const modifyTx = await context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .setApprovalCriteria(context.suite.token, false, false, false, [context.accounts.davidWallet.address]);

          await modifyTx.wait();
          const tx = context.suite.transferManager
            .connect(context.accounts.charlieWallet)
            .rejectTransfer(context.transferID);
          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApprovalStateReset')
            .withArgs(
              context.transferID,
              (await context.suite.transferManager.getApprovalCriteria(context.suite.token)).hash,
            );

          await (await tx).wait();
          const transfer = await context.suite.transferManager.getTransfer(context.transferID);
          expect(transfer.approvers.length).to.be.eq(1);
          expect(transfer.approvers[0]['wallet']).to.be.eq(context.accounts.davidWallet.address);
          expect(transfer.approvers[0]['approved']).to.be.false;
        });
      });
    });
  });

  describe('.getTransfer', () => {
    describe('when transfer does not exist', () => {
      // OK
      it('should revert', async () => {
        const context = await deployFullSuiteWithVerifiedTransferManager();
        const transferID = await context.suite.transferManager.calculateTransferID(
          0,
          context.accounts.aliceWallet.address,
          context.accounts.bobWallet.address,
          100,
        );

        await expect(context.suite.transferManager.getTransfer(transferID)).to.be.revertedWithCustomError(
          context.suite.transferManager,
          `InvalidTransferID`,
        );
      });
    });
  });

  describe('.getNextTxNonce', () => {
    describe('when there is no transfer', () => {
      // OK
      it(' should return zero', async () => {
        const context = await deployFullSuiteWithVerifiedTransferManager();
        const nonce = await context.suite.transferManager.getNextTxNonce();
        expect(nonce).to.be.eq(0);
      });
    });

    describe('when one transfer exists', () => {
      // OK
      it(' should return one', async () => {
        const context = await deployFullSuiteWithNonSequentialTransfer();
        const nonce = await context.suite.transferManager.getNextTxNonce();
        expect(nonce).to.be.eq(1);
      });
    });
  });

  describe('.getNextApprover', () => {
    describe('when transfer does not exist', () => {
      // OK
      it(' should revert', async () => {
        const context = await deployFullSuiteWithVerifiedTransferManager();
        const transferID = await context.suite.transferManager.calculateTransferID(
          0,
          context.accounts.aliceWallet.address,
          context.accounts.bobWallet.address,
          100,
        );

        await expect(context.suite.transferManager.getNextApprover(transferID)).to.be.revertedWithCustomError(
          context.suite.transferManager,
          `InvalidTransferID`,
        );
      });
    });

    describe('when transfer status is not pending', () => {
      // OK
      it(' should revert', async () => {
        const context = await deployFullSuiteWithNonSequentialTransfer();
        await context.suite.transferManager.connect(context.accounts.aliceWallet).cancelTransfer(context.transferID);

        await expect(
          context.suite.transferManager.connect(context.accounts.aliceWallet).getNextApprover(context.transferID),
        ).to.be.revertedWithCustomError(context.suite.transferManager, `TransferIsNotInPendingStatus`);
      });
    });

    describe('when no one approved the transfer', () => {
      // OK
      it('should return first approver', async () => {
        const context = await deployFullSuiteWithSequentialTransfer();
        const { nextApprover, anyTokenAgent } = await context.suite.transferManager.getNextApprover(context.transferID);
        expect(nextApprover).to.be.eq(context.accounts.bobWallet.address);
        expect(anyTokenAgent).to.be.false;
      });
    });

    describe('when one approver approved the transfer', () => {
      // OK
      it('should return second approver (token agent)', async () => {
        const context = await deployFullSuiteWithSequentialTransfer();
        await context.suite.transferManager.connect(context.accounts.bobWallet).approveTransfer(context.transferID);
        const { nextApprover, anyTokenAgent } = await context.suite.transferManager.getNextApprover(context.transferID);
        expect(nextApprover).to.be.eq('0x0000000000000000000000000000000000000000');
        expect(anyTokenAgent).to.be.true;
      });
    });
  });

  describe('.getApprovalCriteria', () => {
    // OK
    describe('when token is not registered', () => {
      it('should revert', async () => {
        const context = await deployFullSuiteWithVerifiedTransferManager();
        await expect(
          context.suite.transferManager.getApprovalCriteria(context.suite.token),
        ).to.be.revertedWithCustomError(context.suite.transferManager, `TokenIsNotRegistered`);
      });
    });

    // OK
    describe('when token is registered', () => {
      it('should return criteria', async () => {
        const context = await deployFullSuiteWithSequentialTransfer();
        const approvalCriteria = await context.suite.transferManager.getApprovalCriteria(context.suite.token);
        expect(approvalCriteria.includeRecipientApprover).to.be.true;
        expect(approvalCriteria.includeAgentApprover).to.be.true;
        expect(approvalCriteria.sequentialApproval).to.be.true;
        expect(approvalCriteria.additionalApprovers).to.be.eql([context.accounts.charlieWallet.address]);
      });
    });
  });

  // OK
  describe('.name', () => {
    it('should return the name of the module', async () => {
      const context = await deployFullSuiteWithVerifiedTransferManager();

      expect(await context.suite.transferManager.name()).to.be.equal('DVATransferManager');
    });
  });
});
