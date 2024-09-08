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

  describe('.initiateTransfer', () => {
    describe('when token is registered to the DVA manager', () => {
      describe('when amount is higher than sender balance', () => {
        it('A transfer of zero should be initiated', async () => {
          const context = await deployFullSuiteWithVerifiedTransferManager();
          await context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .setApprovalCriteria(context.suite.token, true, true, true, [
              context.accounts.charlieWallet.address,
              context.accounts.anotherWallet.address,
            ]);

          const encValue1 = await encrypt64(context.suite.token, context.accounts.aliceWallet, 100000);
          await context.suite.token
            .connect(context.accounts.aliceWallet)
            [
              'approve(address,bytes32,bytes)'
            ](context.suite.transferManager, encValue1.handles[0], encValue1.inputProof);

          const encValue = await encrypt64(context.suite.transferManager, context.accounts.aliceWallet, 100000);
          const transferID = await context.suite.transferManager.calculateTransferID(
            0,
            context.accounts.aliceWallet.address,
            context.accounts.bobWallet.address,
            ethers.toBigInt(encValue.handles[0]),
          );

          const tx = await context.suite.transferManager
            .connect(context.accounts.aliceWallet)
            .initiateTransfer(
              context.suite.token,
              context.accounts.bobWallet.address,
              encValue.handles[0],
              encValue.inputProof,
            );
          const txReceipt = await tx.wait(1);
          const args = getLogEventArgs(txReceipt, 'TransferInitiated', undefined, context.suite.transferManager);
          expect(args.length).to.eq(7);
          expect(args[0]).to.eq(transferID);
          expect(args[1]).to.eq(await context.suite.token.getAddress());
          expect(args[2]).to.eq(context.accounts.aliceWallet.address);
          expect(args[3]).to.eq(context.accounts.bobWallet.address);
          expect(args[4]).to.eq(ethers.toBigInt(encValue.handles[0])); //eamount

          const encActualAmount = args[5];
          expect(await hre.fhevm.decrypt64(encActualAmount)).to.eq(0);

          expect(args[6]).to.eq((await context.suite.transferManager.getApprovalCriteria(context.suite.token)).hash);
        });
      });

      describe('when sender has enough balance', () => {
        describe('when includeRecipientApprover is true', () => {
          it('BBBB should initiate the transfer with recipient approver', async () => {
            await hre.fhevm.init(true);
            const context = await deployFullSuiteWithVerifiedTransferManager();
            await context.suite.transferManager
              .connect(context.accounts.tokenAgent)
              .setApprovalCriteria(context.suite.token, true, false, true, []);

            const encApprove = await encrypt64(context.suite.token, context.accounts.aliceWallet, 100000);
            await context.suite.token
              .connect(context.accounts.aliceWallet)
              [
                'approve(address,bytes32,bytes)'
              ](context.suite.transferManager, encApprove.handles[0], encApprove.inputProof);

            const encHundred = await encrypt64(context.suite.transferManager, context.accounts.aliceWallet, 100);
            const transferID = await context.suite.transferManager.calculateTransferID(
              0,
              context.accounts.aliceWallet.address,
              context.accounts.bobWallet.address,
              ethers.toBigInt(encHundred.handles[0]),
            );

            const tx = await context.suite.transferManager
              .connect(context.accounts.aliceWallet)
              .initiateTransfer(
                context.suite.token,
                context.accounts.bobWallet.address,
                encHundred.handles[0],
                encHundred.inputProof,
              );
            const txReceipt = await tx.wait(1);
            const args = getLogEventArgs(txReceipt, 'TransferInitiated', undefined, context.suite.transferManager);
            expect(args.length).to.eq(7);
            expect(args[0]).to.eq(transferID);
            expect(args[1]).to.eq(await context.suite.token.getAddress());
            expect(args[2]).to.eq(context.accounts.aliceWallet.address);
            expect(args[3]).to.eq(context.accounts.bobWallet.address);
            expect(args[4]).to.eq(ethers.toBigInt(encHundred.handles[0])); //eamount

            const encActualAmount = args[5];
            expect(await hre.fhevm.decrypt64(encActualAmount)).to.eq(100);

            expect(args[6]).to.eq((await context.suite.transferManager.getApprovalCriteria(context.suite.token)).hash);

            const transfer = await context.suite.transferManager.getTransfer(transferID);
            expect(transfer.approvers.length).to.be.eq(1);
            expect(transfer.approvers[0]['wallet']).to.be.eq(context.accounts.bobWallet.address);
            expect(transfer.approvers[0]['approved']).to.be.false;
          });
        });

        describe('when includeAgentApprover is true', () => {
          // OK
          it('should initiate the transfer with token agent approver', async () => {
            const context = await deployFullSuiteWithVerifiedTransferManager();
            await context.suite.transferManager
              .connect(context.accounts.tokenAgent)
              .setApprovalCriteria(context.suite.token, false, true, true, []);

            const encApprove = await encrypt64(context.suite.token, context.accounts.aliceWallet, 100000);
            await context.suite.token
              .connect(context.accounts.aliceWallet)
              [
                'approve(address,bytes32,bytes)'
              ](context.suite.transferManager, encApprove.handles[0], encApprove.inputProof);

            const encHundred = await encrypt64(context.suite.transferManager, context.accounts.aliceWallet, 100);
            const transferID = await context.suite.transferManager.calculateTransferID(
              0,
              context.accounts.aliceWallet.address,
              context.accounts.bobWallet.address,
              ethers.toBigInt(encHundred.handles[0]),
            );

            const tx = await context.suite.transferManager
              .connect(context.accounts.aliceWallet)
              .initiateTransfer(
                context.suite.token,
                context.accounts.bobWallet.address,
                encHundred.handles[0],
                encHundred.inputProof,
              );
            const txReceipt = await tx.wait(1);
            const args = getLogEventArgs(txReceipt, 'TransferInitiated', undefined, context.suite.transferManager);
            expect(args.length).to.eq(7);
            expect(args[0]).to.eq(transferID);
            expect(args[1]).to.eq(await context.suite.token.getAddress());
            expect(args[2]).to.eq(context.accounts.aliceWallet.address);
            expect(args[3]).to.eq(context.accounts.bobWallet.address);
            expect(args[4]).to.eq(ethers.toBigInt(encHundred.handles[0])); //eamount

            const encActualAmount = args[5];
            expect(await hre.fhevm.decrypt64(encActualAmount)).to.eq(100);

            expect(args[6]).to.eq((await context.suite.transferManager.getApprovalCriteria(context.suite.token)).hash);

            const transfer = await context.suite.transferManager.getTransfer(transferID);
            expect(transfer.approvers.length).to.be.eq(1);
            expect(transfer.approvers[0]['wallet']).to.be.eq('0x0000000000000000000000000000000000000000');
            expect(transfer.approvers[0]['approved']).to.be.false;
          });
        });

        describe('when additional approvers exist', () => {
          // OK
          it('should initiate the transfer with token agent approver', async () => {
            const context = await deployFullSuiteWithVerifiedTransferManager();
            await context.suite.transferManager
              .connect(context.accounts.tokenAgent)
              .setApprovalCriteria(context.suite.token, false, false, true, [
                context.accounts.charlieWallet.address,
                context.accounts.anotherWallet.address,
              ]);

            const encApprove = await encrypt64(context.suite.token, context.accounts.aliceWallet, 100000);
            await context.suite.token
              .connect(context.accounts.aliceWallet)
              [
                'approve(address,bytes32,bytes)'
              ](context.suite.transferManager, encApprove.handles[0], encApprove.inputProof);

            const encHundred = await encrypt64(context.suite.transferManager, context.accounts.aliceWallet, 100);
            const transferID = await context.suite.transferManager.calculateTransferID(
              0,
              context.accounts.aliceWallet.address,
              context.accounts.bobWallet.address,
              ethers.toBigInt(encHundred.handles[0]),
            );

            const tx = await context.suite.transferManager
              .connect(context.accounts.aliceWallet)
              .initiateTransfer(
                context.suite.token,
                context.accounts.bobWallet.address,
                encHundred.handles[0],
                encHundred.inputProof,
              );

            const txReceipt = await tx.wait(1);
            const args = getLogEventArgs(txReceipt, 'TransferInitiated', undefined, context.suite.transferManager);
            expect(args.length).to.eq(7);
            expect(args[0]).to.eq(transferID);
            expect(args[1]).to.eq(await context.suite.token.getAddress());
            expect(args[2]).to.eq(context.accounts.aliceWallet.address);
            expect(args[3]).to.eq(context.accounts.bobWallet.address);
            expect(args[4]).to.eq(ethers.toBigInt(encHundred.handles[0])); //eamount

            const encActualAmount = args[5];
            expect(await hre.fhevm.decrypt64(encActualAmount)).to.eq(100);

            expect(args[6]).to.eq((await context.suite.transferManager.getApprovalCriteria(context.suite.token)).hash);

            const transfer = await context.suite.transferManager.getTransfer(transferID);
            expect(transfer.approvers.length).to.be.eq(2);
            expect(transfer.approvers[0]['wallet']).to.be.eq(context.accounts.charlieWallet.address);
            expect(transfer.approvers[0]['approved']).to.be.false;
            expect(transfer.approvers[1]['wallet']).to.be.eq(context.accounts.anotherWallet.address);
            expect(transfer.approvers[1]['approved']).to.be.false;
          });
        });

        describe('when all criteria are enabled', () => {
          // OK
          it('should initiate the transfer with all approvers', async () => {
            const context = await deployFullSuiteWithVerifiedTransferManager();
            await context.suite.transferManager
              .connect(context.accounts.tokenAgent)
              .setApprovalCriteria(context.suite.token, true, true, true, [
                context.accounts.charlieWallet.address,
                context.accounts.anotherWallet.address,
              ]);

            const encApprove = await encrypt64(context.suite.token, context.accounts.aliceWallet, 100000);
            await context.suite.token
              .connect(context.accounts.aliceWallet)
              [
                'approve(address,bytes32,bytes)'
              ](context.suite.transferManager, encApprove.handles[0], encApprove.inputProof);

            const encHundred = await encrypt64(context.suite.transferManager, context.accounts.aliceWallet, 100);
            const transferID = await context.suite.transferManager.calculateTransferID(
              0,
              context.accounts.aliceWallet.address,
              context.accounts.bobWallet.address,
              ethers.toBigInt(encHundred.handles[0]),
            );

            const tx = await context.suite.transferManager
              .connect(context.accounts.aliceWallet)
              .initiateTransfer(
                context.suite.token,
                context.accounts.bobWallet.address,
                encHundred.handles[0],
                encHundred.inputProof,
              );

            const txReceipt = await tx.wait(1);
            const args = getLogEventArgs(txReceipt, 'TransferInitiated', undefined, context.suite.transferManager);
            expect(args.length).to.eq(7);
            expect(args[0]).to.eq(transferID);
            expect(args[1]).to.eq(await context.suite.token.getAddress());
            expect(args[2]).to.eq(context.accounts.aliceWallet.address);
            expect(args[3]).to.eq(context.accounts.bobWallet.address);
            expect(args[4]).to.eq(ethers.toBigInt(encHundred.handles[0])); //eamount

            const encActualAmount = args[5];
            expect(await hre.fhevm.decrypt64(encActualAmount)).to.eq(100);

            expect(args[6]).to.eq((await context.suite.transferManager.getApprovalCriteria(context.suite.token)).hash);

            const transfer = await context.suite.transferManager.getTransfer(transferID);
            expect(transfer.approvers.length).to.be.eq(4);
            expect(transfer.approvers[0]['wallet']).to.be.eq(context.accounts.bobWallet.address);
            expect(transfer.approvers[0]['approved']).to.be.false;
            expect(transfer.approvers[1]['wallet']).to.be.eq('0x0000000000000000000000000000000000000000');
            expect(transfer.approvers[1]['approved']).to.be.false;
            expect(transfer.approvers[2]['wallet']).to.be.eq(context.accounts.charlieWallet.address);
            expect(transfer.approvers[2]['approved']).to.be.false;
            expect(transfer.approvers[3]['wallet']).to.be.eq(context.accounts.anotherWallet.address);
            expect(transfer.approvers[3]['approved']).to.be.false;

            const senderBalance = await context.suite.token.balanceOf(context.accounts.aliceWallet.address);
            expect(await hre.fhevm.decrypt64(senderBalance)).to.be.eq(900);

            const dvaBalance = await context.suite.token.balanceOf(context.suite.transferManager);
            expect(await hre.fhevm.decrypt64(dvaBalance)).to.be.eq(100);
          });
        });
      });
    });
  });

  describe('.approveTransfer', () => {
    describe('when sequential approval is disabled', () => {
      describe('when all parties approve the transfer', () => {
        // OK
        it('BBBB should complete', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();

          await context.suite.transferManager.connect(context.accounts.tokenAgent).approveTransfer(context.transferID);
          await context.suite.transferManager.connect(context.accounts.bobWallet).approveTransfer(context.transferID);
          const tx = context.suite.transferManager
            .connect(context.accounts.charlieWallet)
            .approveTransfer(context.transferID);

          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApproved')
            .withArgs(context.transferID, context.accounts.charlieWallet.address);

          // TODO
          // await expect(tx)
          //   .to.emit(context.suite.transferManager, 'TransferCompleted')
          //   .withArgs(
          //     context.transferID,
          //     context.suite.token,
          //     context.accounts.aliceWallet.address,
          //     context.accounts.bobWallet.address,
          //     100,
          //   );

          const transfer = await context.suite.transferManager.getTransfer(context.transferID);
          expect(transfer.status).to.be.eq(1);

          const esenderBalance = await context.suite.token.balanceOf(context.accounts.aliceWallet.address);
          const senderBalance = await hre.fhevm.decrypt64(esenderBalance);
          expect(senderBalance).to.be.eq(900);

          const ereceiverBalance = await context.suite.token.balanceOf(context.accounts.bobWallet.address);
          const receiverBalance = await hre.fhevm.decrypt64(ereceiverBalance);
          expect(receiverBalance).to.be.eq(600);

          const edvaBalance = await context.suite.token.balanceOf(context.suite.transferManager);
          const dvaBalance = await hre.fhevm.decrypt64(edvaBalance);
          expect(dvaBalance).to.be.eq(0);
        });
      });
    });

    describe('when sequential approval is enabled', () => {
      describe('when all parties approve the transfer', () => {
        // OK
        it('should complete', async () => {
          const context = await deployFullSuiteWithSequentialTransfer();

          await context.suite.transferManager.connect(context.accounts.bobWallet).approveTransfer(context.transferID);
          await context.suite.transferManager.connect(context.accounts.tokenAgent).approveTransfer(context.transferID);
          const tx = context.suite.transferManager
            .connect(context.accounts.charlieWallet)
            .approveTransfer(context.transferID);

          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApproved')
            .withArgs(context.transferID, context.accounts.charlieWallet.address);

          // TODO
          // await expect(tx)
          //   .to.emit(context.suite.transferManager, 'TransferCompleted')
          //   .withArgs(
          //     context.transferID,
          //     context.suite.token,
          //     context.accounts.aliceWallet.address,
          //     context.accounts.bobWallet.address,
          //     100,
          //   );

          const transfer = await context.suite.transferManager.getTransfer(context.transferID);
          expect(transfer.status).to.be.eq(1);

          const senderBalance = await context.suite.token.balanceOf(context.accounts.aliceWallet.address);
          expect(await hre.fhevm.decrypt64(senderBalance)).to.be.eq(900);

          const receiverBalance = await context.suite.token.balanceOf(context.accounts.bobWallet.address);
          expect(await hre.fhevm.decrypt64(receiverBalance)).to.be.eq(600);

          const dvaBalance = await context.suite.token.balanceOf(context.suite.transferManager);
          expect(await hre.fhevm.decrypt64(dvaBalance)).to.be.eq(0);
        });
      });
    });
  });

  describe('.delegateApproveTransfer', () => {
    describe('when sequential approval is disabled', () => {
      describe('when all parties approve the transfer', () => {
        it('should complete', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();

          const tx = await context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .delegateApproveTransfer(context.transferID, [
              await signTransfer(context.transferID, context.accounts.tokenAgent),
              await signTransfer(context.transferID, context.accounts.bobWallet),
              await signTransfer(context.transferID, context.accounts.charlieWallet),
            ]);

          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferApproved')
            .withArgs(context.transferID, context.accounts.tokenAgent.address)
            .to.emit(context.suite.transferManager, 'TransferApproved')
            .withArgs(context.transferID, context.accounts.bobWallet.address)
            .to.emit(context.suite.transferManager, 'TransferApproved')
            .withArgs(context.transferID, context.accounts.charlieWallet.address);

          // TODO
          // await expect(tx)
          //   .to.emit(context.suite.transferManager, 'TransferCompleted')
          //   .withArgs(
          //     context.transferID,
          //     context.suite.token,
          //     context.accounts.aliceWallet.address,
          //     context.accounts.bobWallet.address,
          //     100,
          //   );

          const transfer = await context.suite.transferManager.getTransfer(context.transferID);
          expect(transfer.status).to.be.eq(1);

          const senderBalance = await context.suite.token.balanceOf(context.accounts.aliceWallet.address);
          expect(await hre.fhevm.decrypt64(senderBalance)).to.be.eq(900);

          const receiverBalance = await context.suite.token.balanceOf(context.accounts.bobWallet.address);
          expect(await hre.fhevm.decrypt64(receiverBalance)).to.be.eq(600);

          const dvaBalance = await context.suite.token.balanceOf(context.suite.transferManager);
          expect(await hre.fhevm.decrypt64(dvaBalance)).to.be.eq(0);
        });
      });
    });
  });

  describe('.cancelTransfer', () => {
    describe('when transfer status is pending', () => {
      // OK
      it('should cancel', async () => {
        const context = await deployFullSuiteWithNonSequentialTransfer();

        const tx = await context.suite.transferManager
          .connect(context.accounts.aliceWallet)
          .cancelTransfer(context.transferID);
        await expect(tx).to.emit(context.suite.transferManager, 'TransferCancelled').withArgs(context.transferID);

        const transfer = await context.suite.transferManager.getTransfer(context.transferID);
        expect(transfer.status).to.be.eq(2);

        const senderBalance = await context.suite.token.balanceOf(context.accounts.aliceWallet.address);
        expect(await hre.fhevm.decrypt64(senderBalance)).to.be.eq(1000);
      });
    });
  });

  describe('.rejectTransfer', () => {
    describe('when sequential approval is disabled', () => {
      describe('when caller is the last approver', () => {
        // OK
        it('should reject', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          const tx = context.suite.transferManager
            .connect(context.accounts.charlieWallet)
            .rejectTransfer(context.transferID);
          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferRejected')
            .withArgs(context.transferID, context.accounts.charlieWallet.address);

          const transfer = await context.suite.transferManager.getTransfer(context.transferID);
          expect(transfer.status).to.be.eq(3);

          const senderBalance = await context.suite.token.balanceOf(context.accounts.aliceWallet.address);
          expect(await hre.fhevm.decrypt64(senderBalance)).to.be.eq(1000);
        });
      });
    });

    describe('when sequential approval is enabled', () => {
      describe('when caller is the next approver and it is a token agent', () => {
        // OK
        it('should reject', async () => {
          const context = await deployFullSuiteWithSequentialTransfer();
          await context.suite.transferManager.connect(context.accounts.bobWallet).approveTransfer(context.transferID);
          const tx = context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .rejectTransfer(context.transferID);

          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferRejected')
            .withArgs(context.transferID, context.accounts.tokenAgent.address);

          const transfer = await context.suite.transferManager.getTransfer(context.transferID);
          expect(transfer.status).to.be.eq(3);

          const senderBalance = await context.suite.token.balanceOf(context.accounts.aliceWallet.address);
          expect(await hre.fhevm.decrypt64(senderBalance)).to.be.eq(1000);
        });
      });
    });

    describe('when approval criteria are changed after the transfer has been initiated', () => {
      describe('when trying to reject after approval state reset', () => {
        // OK
        it('should reject', async () => {
          const context = await deployFullSuiteWithNonSequentialTransfer();
          const modifyTx = await context.suite.transferManager
            .connect(context.accounts.tokenAgent)
            .setApprovalCriteria(context.suite.token, false, false, false, [context.accounts.davidWallet.address]);

          await modifyTx.wait();
          const resetTx = await context.suite.transferManager
            .connect(context.accounts.charlieWallet)
            .rejectTransfer(context.transferID);
          await resetTx.wait();

          const tx = context.suite.transferManager
            .connect(context.accounts.davidWallet)
            .rejectTransfer(context.transferID);

          await expect(tx)
            .to.emit(context.suite.transferManager, 'TransferRejected')
            .withArgs(context.transferID, context.accounts.davidWallet.address);

          const transfer = await context.suite.transferManager.getTransfer(context.transferID);
          expect(transfer.status).to.be.eq(3);

          const senderBalance = await context.suite.token.balanceOf(context.accounts.aliceWallet.address);
          expect(await hre.fhevm.decrypt64(senderBalance)).to.be.eq(1000);
        });
      });
    });
  });

  describe('.getTransfer', () => {
    describe('when transfer exists', () => {
      // OK
      it('should return transfer', async () => {
        const context = await deployFullSuiteWithNonSequentialTransfer();

        const transfer = await context.suite.transferManager.getTransfer(context.transferID);
        expect(transfer.tokenAddress).to.be.eq(context.suite.token);
        expect(transfer.sender).to.be.eq(context.accounts.aliceWallet.address);
        expect(transfer.recipient).to.be.eq(context.accounts.bobWallet.address);
        expect(await hre.fhevm.decrypt64(transfer.eamount)).to.be.eq(100);
        expect(await hre.fhevm.decrypt64(transfer.eactualAmount)).to.be.eq(100);
        expect(transfer.status).to.be.eq(0);
        expect(transfer.approvers.length).to.be.eq(3);
        expect(transfer.approvers[0].wallet).to.be.eq(context.accounts.bobWallet.address);
        expect(transfer.approvers[0].approved).to.be.false;
        expect(transfer.approvers[1].wallet).to.be.eq('0x0000000000000000000000000000000000000000');
        expect(transfer.approvers[1].approved).to.be.false;
        expect(transfer.approvers[2].wallet).to.be.eq(context.accounts.charlieWallet.address);
        expect(transfer.approvers[2].approved).to.be.false;
      });
    });
  });
});
