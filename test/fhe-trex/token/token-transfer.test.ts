import '../../../tasks/index';
import { expect } from 'chai';
import hre, { fhevm, ethers } from 'hardhat';
import { ethers as EthersT } from 'ethers';
import {
  deployFullSuiteFixture,
  deploySuiteWithModularCompliancesFixture,
} from '../fixtures/deploy-full-suite.fixture';
import { Token } from '../../../types';
import { expectRevert } from '../../tx_error';
import {
  encrypt64,
  expectDecrypt64,
  expectArrayFinishingWithEncUint64,
  getAllLogEventArgs,
  getLogEventArgs,
  tokenBalanceOf,
  tokenBatchMint,
  tokenBurn,
  tokenFreeze,
  tokenMint,
  tokenTransfer,
  tokenTransferTxPromise,
} from '../../utils';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_BALANCE,
  SCOPE_TOKEN_MINT,
  SCOPE_TREX,
  SCOPE_TREX_SETUP,
} from '../../../tasks/task-names';

async function tokenApprove(
  token: Token,
  signer: EthersT.Signer,
  spender: EthersT.AddressLike,
  amount: number | bigint,
) {
  const signerEncAmount = await encrypt64(token, signer, amount);

  const tx = await token
    .connect(signer)
    ['approve(address,bytes32,bytes)'](spender, signerEncAmount.handles[0], signerEncAmount.inputProof);
  return await tx.wait(1);
}

async function tokenTransferFromTxPromise(
  token: Token,
  signer: EthersT.Signer,
  from: EthersT.AddressLike,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const signerEncAmount = await encrypt64(token, signer, amount);
  return token
    .connect(signer)
    ['transferFrom(address,address,bytes32,bytes)'](from, to, signerEncAmount.handles[0], signerEncAmount.inputProof);
}

async function tokenForcedTransferTxPromise(
  token: Token,
  signer: EthersT.Signer,
  from: EthersT.AddressLike,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const signerEncAmount = await encrypt64(token, signer, amount);
  return token
    .connect(signer)
    ['forcedTransfer(address,address,bytes32,bytes)'](from, to, signerEncAmount.handles[0], signerEncAmount.inputProof);
}

async function tokenForcedTransfer(
  token: Token,
  signer: EthersT.Signer,
  from: EthersT.AddressLike,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const tx = await tokenForcedTransferTxPromise(token, signer, from, to, amount);
  return await tx.wait(1);
}

async function tokenTransferFrom(
  token: Token,
  signer: EthersT.Signer,
  from: EthersT.AddressLike,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const tx = await tokenTransferFromTxPromise(token, signer, from, to, amount);
  return await tx.wait(1);
}

describe('Token - Transfers', () => {
  describe('cli mint', () => {
    it('BBBB should ', async () => {
      // setup TREX token
      const { tokenAddress } = (await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP }, { mint: 10000n })) as {
        tokenAddress: string;
      };

      // get user balance
      const beforeBalance = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BALANCE },
        { token: tokenAddress, user: 'alice' },
      );

      // mint
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_MINT },
        { token: tokenAddress, user: 'alice', agent: 'token-agent', amount: 10n },
      );

      // get new user balance
      const afterBalance = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BALANCE },
        { token: tokenAddress, user: 'alice' },
      );

      expect(afterBalance.value).to.eq(beforeBalance.value + 10n);
    });
  });

  describe('.approve()', () => {
    it('should approve a contract to spend a certain amount of tokens', async () => {
      const {
        suite: { token },
        accounts: { aliceWallet, anotherWallet },
      } = await deployFullSuiteFixture();

      // 1: await expect(tx).to.emit(token, 'Approval').withArgs(aliceWallet.address, anotherWallet.address, 100);
      const txReceipt = await tokenApprove(token, aliceWallet, anotherWallet, 100);
      const args = getLogEventArgs(txReceipt, 'Approval', 3);
      expect(args[0]).to.equal(aliceWallet.address);
      expect(args[1]).to.equal(anotherWallet.address);

      await expectDecrypt64(args[2], 100);

      // 2: await expect(token.allowance(aliceWallet.address, anotherWallet.address)).to.eventually.equal(100);
      const eallowance = await token.allowance(aliceWallet.address, anotherWallet.address);

      await expectDecrypt64(eallowance, 100);
    });
  });

  describe('.increaseAllowance()', () => {
    it('should increase the allowance of a contract to spend a certain amount of tokens', async () => {
      const {
        suite: { token },
        accounts: { aliceWallet, anotherWallet },
      } = await deployFullSuiteFixture();

      // 1. await token.connect(aliceWallet).approve(anotherWallet.address, 100);
      await tokenApprove(token, aliceWallet, anotherWallet, 100);

      // 2. const tx = await token.connect(aliceWallet).increaseAllowance(anotherWallet.address, 100);
      const aliceEncAmount = await encrypt64(token, aliceWallet, 100);

      const tx = await token
        .connect(aliceWallet)
        [
          'increaseAllowance(address,bytes32,bytes)'
        ](anotherWallet.address, aliceEncAmount.handles[0], aliceEncAmount.inputProof);
      const txReceipt = await tx.wait(1);

      // 3. await expect(tx).to.emit(token, 'Approval').withArgs(aliceWallet.address, anotherWallet.address, 200);
      const args = getLogEventArgs(txReceipt, 'Approval', 3);
      expect(args[0]).to.equal(aliceWallet.address);
      expect(args[1]).to.equal(anotherWallet.address);

      await expectDecrypt64(args[2], 200);

      // 4. await expect(token.allowance(aliceWallet.address, anotherWallet.address)).to.eventually.equal(200);
      const eallowance = await token.allowance(aliceWallet.address, anotherWallet.address);
      await expectDecrypt64(eallowance, 200);
    });
  });

  describe('.decreaseAllowance()', () => {
    it('should decrease the allowance of a contract to spend a certain amount of tokens', async () => {
      const {
        suite: { token },
        accounts: { aliceWallet, anotherWallet },
      } = await deployFullSuiteFixture();

      // 1. await token.connect(aliceWallet).approve(anotherWallet.address, 150);
      await tokenApprove(token, aliceWallet, anotherWallet, 150);

      // 2. const tx = await token.connect(aliceWallet).decreaseAllowance(anotherWallet.address, 100);
      const aliceEncAmount = await encrypt64(token, aliceWallet, 100);

      const tx = await token
        .connect(aliceWallet)
        [
          'decreaseAllowance(address,bytes32,bytes)'
        ](anotherWallet.address, aliceEncAmount.handles[0], aliceEncAmount.inputProof);
      const txReceipt = await tx.wait(1);

      // 3. await expect(tx).to.emit(token, 'Approval').withArgs(aliceWallet.address, anotherWallet.address, 50);
      const args = getLogEventArgs(txReceipt, 'Approval', 3);
      expect(args[0]).to.equal(aliceWallet.address);
      expect(args[1]).to.equal(anotherWallet.address);

      await expectDecrypt64(args[2], 50);

      // 4. await expect(token.allowance(aliceWallet.address, anotherWallet.address)).to.eventually.equal(50);
      const eallowance = await token.allowance(aliceWallet.address, anotherWallet.address);
      await expectDecrypt64(eallowance, 50);
    });
  });

  describe('.transfer()', () => {
    describe('when the token is paused', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deployFullSuiteFixture();
        await token.connect(tokenAgent).pause();
        await expect(
          token.connect(aliceWallet)['transfer(address,uint256)'](bobWallet.address, 100),
        ).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('when the recipient balance is frozen', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { tokenAgent, aliceWallet, bobWallet },
        } = await deployFullSuiteFixture();

        await token.connect(tokenAgent).setAddressFrozen(bobWallet.address, true);

        await expect(
          token.connect(aliceWallet)['transfer(address,uint256)'](bobWallet.address, 100),
        ).to.be.revertedWith('wallet is frozen');
      });
    });

    describe('when the sender balance is frozen', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { tokenAgent, aliceWallet, bobWallet },
        } = await deployFullSuiteFixture();

        await token.connect(tokenAgent).setAddressFrozen(aliceWallet.address, true);

        await expect(
          token.connect(aliceWallet)['transfer(address,uint256)'](bobWallet.address, 100),
        ).to.be.revertedWith('wallet is frozen');
      });
    });

    describe('when the sender has not enough balance', () => {
      it('should do nothing', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet },
        } = await deployFullSuiteFixture();

        const encBalance = await token.balanceOf(aliceWallet.address);
        const balance = await fhevm.decrypt64(encBalance);
        await tokenTransfer(token, aliceWallet, bobWallet, balance + 1000n);

        const encNewBalance = await token.balanceOf(aliceWallet.address);
        const newBalance = await fhevm.decrypt64(encNewBalance);

        expect(newBalance).to.be.equal(balance);

        // await expect(token.connect(aliceWallet).transfer(bobWallet.address, balance + 1000n)).to.be.revertedWith(
        //   'Insufficient Balance',
        // );
      });
    });

    describe('when the sender has not enough balance unfrozen', () => {
      it('nothing should happen', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        const encAliceBalance = await token.balanceOf(aliceWallet.address);
        const aliceBalance = await fhevm.decrypt64(encAliceBalance);

        // 1. await token.connect(tokenAgent).freezePartialTokens(aliceWallet.address, balance - 100n);
        await tokenFreeze(token, tokenAgent, aliceWallet, aliceBalance - 100n);

        // 2. await expect(token.connect(aliceWallet).transfer(bobWallet.address, balance)).to.be.revertedWith(
        //   'Insufficient Balance',
        // );
        await tokenTransfer(token, aliceWallet, bobWallet, aliceBalance);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.equal(aliceBalance);
      });

      it('nothing should happen', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        const encAliceBalance = await token.balanceOf(aliceWallet.address);
        const aliceBalance = await fhevm.decrypt64(encAliceBalance);

        // 1. await token.connect(tokenAgent).freezePartialTokens(aliceWallet.address, balance - 100n);
        await tokenFreeze(token, tokenAgent, aliceWallet, aliceBalance - 100n);

        // 2. await expect(token.connect(aliceWallet).transfer(bobWallet.address, balance)).to.be.revertedWith(
        //   'Insufficient Balance',
        // );
        await tokenTransfer(token, aliceWallet, bobWallet, aliceBalance);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.equal(aliceBalance);
      });
    });

    describe('when the recipient identity is not verified', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, anotherWallet },
        } = await deployFullSuiteFixture();

        await expectRevert(tokenTransferTxPromise(token, aliceWallet, anotherWallet, 100n)).to.be.revertedWith(
          'Transfer not possible',
        );

        //const txReceipt = await tokenTransfer(token, aliceWallet, anotherWallet, 100n);
        //   token.connect(aliceWallet)['transfer(address,uint256)'](anotherWallet.address, 100),
        // ).to.be.revertedWith('Transfer not possible');
      });
    });

    describe('when the transfer breaks compliance rules', () => {
      it('should do nothing', async () => {
        const {
          suite: { token, compliance },
          accounts: { aliceWallet, bobWallet },
        } = await deploySuiteWithModularCompliancesFixture();

        const complianceModuleA = await ethers.deployContract('CountryAllowModule');
        await compliance.addModule(complianceModuleA);
        await token.setCompliance(compliance);

        // await expect(token.connect(aliceWallet).transfer(bobWallet.address, 100)).to.be.revertedWith(
        //   'Transfer not possible',
        // );
        const aliceBalance = await tokenBalanceOf(token, aliceWallet);

        await tokenTransfer(token, aliceWallet, bobWallet, 100n);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.equal(aliceBalance);
      });
    });

    describe('when the transfer is compliant', () => {
      it('should transfer tokens', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet },
        } = await deployFullSuiteFixture();

        // const tx = await token.connect(aliceWallet).transfer(bobWallet.address, 100);
        // await expect(tx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 100);
        const txReceipt = await tokenTransfer(token, aliceWallet, bobWallet, 100n);

        const args = getLogEventArgs(txReceipt, 'Transfer', undefined);
        expect(args[0]).to.equal(aliceWallet.address);
        expect(args[1]).to.equal(bobWallet.address);
        if (args.length >= 3) {
          const amount = await fhevm.decrypt64(args[2]);
          expect(amount).to.equal(100);
        }
      });
    });
  });

  /*
    batchTransfer is not supported in FHE
  */
  // describe('.batchTransfer()', () => {
  //   it('should transfer tokens', async () => {
  //     const {
  //       suite: { token },
  //       accounts: { aliceWallet, bobWallet },
  //     } = await deployFullSuiteFixture();

  //     const tx = await token.connect(aliceWallet).batchTransfer([bobWallet.address, bobWallet.address], [100, 200]);
  //     tx.wait(1);
  //     await expect(tx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 100);
  //     await expect(tx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 200);
  //   });
  // });

  describe('.transferFrom()', () => {
    describe('when the token is paused', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        await token.connect(tokenAgent).pause();

        await expect(
          token
            .connect(aliceWallet)
            ['transferFrom(address,address,uint256)'](aliceWallet.address, bobWallet.address, 100),
        ).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('when sender address is frozen', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        await token.connect(tokenAgent).setAddressFrozen(aliceWallet.address, true);

        await expectRevert(
          tokenTransferFromTxPromise(token, aliceWallet, aliceWallet, bobWallet, 100n),
        ).to.be.revertedWith('wallet is frozen');

        // await expect(
        //   token.connect(aliceWallet).transferFrom(aliceWallet.address, bobWallet.address, 100),
        // ).to.be.revertedWith('wallet is frozen');
      });
    });

    describe('when recipient address is frozen', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        await token.connect(tokenAgent).setAddressFrozen(bobWallet.address, true);

        await expectRevert(
          tokenTransferFromTxPromise(token, aliceWallet, aliceWallet, bobWallet, 100n),
        ).to.be.revertedWith('wallet is frozen');

        // await expect(
        //   token.connect(aliceWallet).transferFrom(aliceWallet.address, bobWallet.address, 100),
        // ).to.be.revertedWith('wallet is frozen');
      });
    });

    describe('when sender has not enough balance', () => {
      it('should do nothing', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet },
        } = await deployFullSuiteFixture();

        // await expect(
        //   token.connect(aliceWallet).transferFrom(aliceWallet.address, bobWallet.address, balance + 1000n),
        // ).to.be.revertedWith('Insufficient Balance');
        const aliceBalance = await tokenBalanceOf(token, aliceWallet);

        await tokenTransferFrom(token, aliceWallet, aliceWallet, bobWallet, aliceBalance + 1000n);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.equal(aliceBalance);
      });
    });

    describe('when sender has not enough balance unfrozen', () => {
      it('should do nothing', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        const aliceBalance = await tokenBalanceOf(token, aliceWallet);

        // 1. await token.connect(tokenAgent).freezePartialTokens(aliceWallet.address, balance - 100n);

        await tokenFreeze(token, tokenAgent, aliceWallet, aliceBalance - 100n);

        // 2. await expect(
        //   token.connect(aliceWallet).transferFrom(aliceWallet.address, bobWallet.address, balance),
        // ).to.be.revertedWith('Insufficient Balance');

        await tokenTransfer(token, aliceWallet, bobWallet, aliceBalance);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.equal(aliceBalance);
      });
    });

    describe('when the recipient identity is not verified', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, anotherWallet },
        } = await deployFullSuiteFixture();

        // await expect(
        //   token.connect(aliceWallet).transferFrom(aliceWallet.address, anotherWallet.address, 100),
        // ).to.be.revertedWith('Transfer not possible');
        await expectRevert(
          tokenTransferFromTxPromise(token, aliceWallet, aliceWallet, anotherWallet, 100n),
        ).to.be.revertedWith('Transfer not possible');
      });
    });

    describe('when the transfer breaks compliance rules', () => {
      it('should revert', async () => {
        const {
          suite: { token, compliance },
          accounts: { aliceWallet, bobWallet },
        } = await deploySuiteWithModularCompliancesFixture();

        const complianceModuleA = await ethers.deployContract('CountryAllowModule');
        await compliance.addModule(complianceModuleA);
        await token.setCompliance(compliance);

        // await expect(
        //   token.connect(aliceWallet).transferFrom(aliceWallet.address, bobWallet.address, 100),
        // ).to.be.revertedWith('Transfer not possible');
        const aliceBalance = await tokenBalanceOf(token, aliceWallet);

        await tokenTransferFrom(token, aliceWallet, aliceWallet, bobWallet, 100n);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.equal(aliceBalance);
      });
    });

    describe('when the transfer is compliant', () => {
      it('should transfer tokens and reduce allowance of transferred value', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, anotherWallet },
        } = await deployFullSuiteFixture();

        // 1. await token.connect(aliceWallet).approve(anotherWallet.address, 100);
        await tokenApprove(token, aliceWallet, anotherWallet, 100n);

        // 2. const tx = await token.connect(anotherWallet).transferFrom(aliceWallet.address, bobWallet.address, 100);
        const txReceipt = await tokenTransferFrom(token, anotherWallet, aliceWallet, bobWallet, 100n);

        // 3. await expect(tx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 100);
        const args = getLogEventArgs(txReceipt, 'Transfer', undefined);
        expect(args[0]).to.equal(aliceWallet.address);
        expect(args[1]).to.equal(bobWallet.address);
        if (args.length >= 3) {
          const amount = await fhevm.decrypt64(args[2]);
          expect(amount).to.equal(100);
        }

        // 4. await expect(token.allowance(aliceWallet.address, anotherWallet.address)).to.be.eventually.equal(0);
        const eallowance = await token.allowance(aliceWallet.address, anotherWallet.address);
        await expectDecrypt64(eallowance, 0);
      });
    });
  });

  describe('.forcedTransfer()', () => {
    describe('when sender is not an agent', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet },
        } = await deployFullSuiteFixture();
        await expect(
          token
            .connect(aliceWallet)
            ['forcedTransfer(address,address,uint256)'](aliceWallet.address, bobWallet.address, 100),
        ).to.be.revertedWith('AgentRole: caller does not have the Agent role');
      });
    });

    describe('when source wallet has not enough balance', () => {
      it('should do nothing', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        // 1. await expect(
        //   token.connect(tokenAgent)['forcedTransfer(address,address,bytes32,bytes)'](aliceWallet.address, bobWallet.address, balance + 1000n),
        // ).to.be.revertedWith('sender balance too low');
        const aliceBalance = await tokenBalanceOf(token, aliceWallet);

        await tokenForcedTransfer(token, tokenAgent, aliceWallet, bobWallet, aliceBalance + 1000n);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.equal(aliceBalance);
      });
    });

    describe('when recipient identity is not verified', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, anotherWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        // await expect(
        //   token.connect(tokenAgent).forcedTransfer(aliceWallet.address, anotherWallet.address, 100),
        // ).to.be.revertedWith('Transfer not possible');
        await expectRevert(
          tokenForcedTransferTxPromise(token, tokenAgent, aliceWallet, anotherWallet, 100n),
        ).to.be.revertedWith('Transfer not possible');
      });
    });

    describe('when the transfer breaks compliance rules', () => {
      it('should still transfer tokens', async () => {
        const {
          suite: { token, compliance },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deploySuiteWithModularCompliancesFixture();

        const complianceModuleA = await ethers.deployContract('CountryAllowModule');
        await compliance.addModule(complianceModuleA);
        await token.setCompliance(compliance);

        const aliceBalance = await tokenBalanceOf(token, aliceWallet);

        // 1. const tx = await token.connect(tokenAgent).forcedTransfer(aliceWallet.address, bobWallet.address, 100);
        const txReceipt = await tokenForcedTransfer(token, tokenAgent, aliceWallet, bobWallet, 100n);

        // 2. await expect(tx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 100);
        const args = getLogEventArgs(txReceipt, 'Transfer', undefined);
        expect(args[0]).to.equal(aliceWallet.address);
        expect(args[1]).to.equal(bobWallet.address);
        if (args.length >= 3) {
          const amount = await fhevm.decrypt64(args[2]);
          expect(amount).to.equal(100);
        }

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.equal(aliceBalance - 100n);
      });
    });

    describe('when amount is greater than unfrozen balance', () => {
      it('should unfroze tokens', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        // const balance = await token.balanceOf(aliceWallet.address);
        const aliceBalance = await tokenBalanceOf(token, aliceWallet);

        // 1. await token.connect(tokenAgent).freezePartialTokens(aliceWallet.address, balance - 100n);
        await tokenFreeze(token, tokenAgent, aliceWallet, aliceBalance - 100n);

        // 2. await token.connect(tokenAgent).forcedTransfer(aliceWallet.address, bobWallet.address, balance - 50n);
        const txReceipt = await tokenForcedTransfer(token, tokenAgent, aliceWallet, bobWallet, aliceBalance - 50n);

        // 3. await expect(tx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, balance - 50n);
        const args1 = getLogEventArgs(txReceipt, 'Transfer', undefined);
        expect(args1[0]).to.equal(aliceWallet.address);
        expect(args1[1]).to.equal(bobWallet.address);
        if (args1.length >= 3) {
          const amount = await fhevm.decrypt64(args1[2]);
          expect(amount).to.equal(aliceBalance - 50n);
        }

        // 4. await expect(tx).to.emit(token, 'TokensUnfrozen').withArgs(aliceWallet.address, balance - 150n);
        const args2 = getLogEventArgs(txReceipt, 'TokensUnfrozen', undefined);
        expect(args2[0]).to.equal(aliceWallet.address);
        if (args2.length >= 2) {
          const amount = await fhevm.decrypt64(args2[1]);
          expect(amount).to.equal(aliceBalance - 150n);
        }

        // 5. await expect(token.getFrozenTokens(aliceWallet.address)).to.be.eventually.equal(50);
        const encFrozenTokens = await token.getFrozenTokens(aliceWallet.address);
        const frozenTokens = await fhevm.decrypt64(encFrozenTokens);
        expect(frozenTokens).to.equal(50n);
      });
    });
  });

  describe('.mint', () => {
    describe('when sender is not an agent', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet },
        } = await deployFullSuiteFixture();
        await expect(token.connect(aliceWallet)['mint(address,uint256)'](aliceWallet.address, 100)).to.be.revertedWith(
          'AgentRole: caller does not have the Agent role',
        );
      });
    });

    describe('when recipient identity is not verified', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { anotherWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        await expect(token.connect(tokenAgent)['mint(address,uint256)'](anotherWallet.address, 100)).to.be.revertedWith(
          'Identity is not verified.',
        );
      });
    });

    describe('when the mint breaks compliance rules', () => {
      it('should do nothing', async () => {
        const {
          suite: { token, compliance },
          accounts: { aliceWallet, tokenAgent },
        } = await deploySuiteWithModularCompliancesFixture();

        const complianceModuleA = await ethers.deployContract('CountryAllowModule');
        await compliance.addModule(complianceModuleA);
        await token.setCompliance(compliance);

        const aliceBalance = await tokenBalanceOf(token, aliceWallet);

        await tokenMint(token, tokenAgent, aliceWallet, 100n);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.be.equal(aliceBalance);

        // await expect(token.connect(tokenAgent).mint(aliceWallet.address, 100)).to.be.revertedWith(
        //   'Compliance not followed',
        // );
      });
    });

    // describe('.batchMint()', () => {
    //   it('should transfer tokens', async () => {
    //     const {
    //       suite: { token },
    //       accounts: { aliceWallet, bobWallet },
    //     } = await deployFullSuiteFixture();

    //     const tx = await token.connect(aliceWallet).batchTransfer([bobWallet.address, bobWallet.address], [100, 200]);
    //     tx.wait(1);
    //     await expect(tx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 100);
    //     await expect(tx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 200);
    //   });
    // });

    describe('when identity has the SupplyModifier role and the sender is authorized for it', () => {
      it('Should perform the batch mint', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, bobWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        const aliceBalance = await tokenBalanceOf(token, aliceWallet);
        const bobBalance = await tokenBalanceOf(token, bobWallet);

        const txReceipt = await tokenBatchMint(
          token,
          tokenAgent,
          [aliceWallet.address, bobWallet.address],
          [1000, 500],
        );

        const allArgs = getAllLogEventArgs(txReceipt, 'Transfer', token);

        expectArrayFinishingWithEncUint64(allArgs, [ethers.ZeroAddress, bobWallet.address, 1000]);
        expectArrayFinishingWithEncUint64(allArgs, [ethers.ZeroAddress, aliceWallet.address, 500]);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);
        const newBobBalance = await tokenBalanceOf(token, bobWallet);

        expect(newAliceBalance).to.equal(aliceBalance + 1000n);
        expect(newBobBalance).to.equal(bobBalance + 500n);
      });
    });
  });

  describe('.burn()', () => {
    describe('when sender is not an agent', () => {
      it('should revert', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet },
        } = await deployFullSuiteFixture();
        await expect(token.connect(aliceWallet)['burn(address,uint256)'](aliceWallet.address, 100)).to.be.revertedWith(
          'AgentRole: caller does not have the Agent role',
        );
      });
    });
    describe('when source wallet has not enough balance', () => {
      it('should do nothing', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, tokenAgent },
        } = await deployFullSuiteFixture();

        const aliceBalance = await tokenBalanceOf(token, aliceWallet);

        await tokenBurn(token, tokenAgent, aliceWallet, aliceBalance + 1000n);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.be.equal(aliceBalance);

        // await expect(token.connect(tokenAgent).burn(aliceWallet.address, balance + 1000n)).to.be.revertedWith(
        //   'cannot burn more than balance',
        // );
      });
    });
    describe('when amount to burn is greater that unfrozen balance', () => {
      it('should burn and decrease frozen balance', async () => {
        const {
          suite: { token },
          accounts: { aliceWallet, tokenAgent },
        } = await deployFullSuiteFixture();
        const aliceBalance = await tokenBalanceOf(token, aliceWallet);

        // 1. await token.connect(tokenAgent).freezePartialTokens(aliceWallet.address, balance - 100n);
        await tokenFreeze(token, tokenAgent, aliceWallet, aliceBalance - 100n);

        // 2. await token.connect(tokenAgent).burn(aliceWallet.address, balance - 50n);
        const txReceipt = await tokenBurn(token, tokenAgent, aliceWallet, aliceBalance - 50n);

        // 3. await expect(tx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, balance - 50n);
        const args1 = getLogEventArgs(txReceipt, 'Transfer', undefined);
        expect(args1[0]).to.equal(aliceWallet.address);
        expect(args1[1]).to.equal(ethers.ZeroAddress);
        if (args1.length >= 3) {
          const amount = await fhevm.decrypt64(args1[2]);
          expect(amount).to.equal(aliceBalance - 50n);
        }

        // 4. await expect(tx).to.emit(token, 'TokensUnfrozen').withArgs(aliceWallet.address, balance - 150n);
        const args2 = getLogEventArgs(txReceipt, 'TokensUnfrozen', undefined);
        expect(args2[0]).to.equal(aliceWallet.address);
        if (args2.length >= 2) {
          const amount = await fhevm.decrypt64(args2[1]);
          expect(amount).to.equal(aliceBalance - 150n);
        }

        // 5. await expect(token.getFrozenTokens(aliceWallet.address)).to.be.eventually.equal(50);
        const encFrozenTokens = await token.getFrozenTokens(aliceWallet.address);
        const frozenTokens = await fhevm.decrypt64(encFrozenTokens);
        expect(frozenTokens).to.equal(50n);
      });
    });
  });
});
