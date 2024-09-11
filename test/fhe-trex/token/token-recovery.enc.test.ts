import { expect } from 'chai';
import { ethers, fhevm } from 'hardhat';
import { deployFullSuiteFixture } from '../fixtures/deploy-full-suite.fixture';
import { getLogEventArgs, tokenFreeze } from '../../utils';

describe('Token - Recovery', () => {
  describe('.recoveryAddress()', () => {
    describe('when sender is an agent', () => {
      // This test is not meaningfull in FHEVM mode
      // describe('when wallet to recover has no balance', () => {
      //   it('should revert', async () => {
      //     const {
      //       suite: { token },
      //       accounts: { tokenAgent, aliceWallet, bobWallet, anotherWallet },
      //       identities: { bobIdentity },
      //     } = await deployFullSuiteFixture();

      //     await token
      //       .connect(bobWallet)
      //       ['transfer(address,uint256)'](aliceWallet.address, await token.balanceOf(bobWallet.address));

      //     await expect(
      //       token.connect(tokenAgent).recoveryAddress(bobWallet.address, anotherWallet.address, bobIdentity),
      //     ).to.be.revertedWith('no tokens to recover');
      //   });
      // });

      describe('when wallet has frozen token', () => {
        it('should recover and freeze tokens on the new wallet', async () => {
          const {
            suite: { token },
            accounts: { tokenAgent, bobWallet, anotherWallet },
            identities: { bobIdentity },
          } = await deployFullSuiteFixture();

          await bobIdentity
            .connect(bobWallet)
            .addKey(
              ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address'], [anotherWallet.address])),
              1,
              1,
            );

          await tokenFreeze(token, tokenAgent, bobWallet, 50);

          const tx = await token
            .connect(tokenAgent)
            .recoveryAddress(bobWallet.address, anotherWallet.address, bobIdentity);
          const txReceipt = await tx.wait(1);

          const args1 = getLogEventArgs(txReceipt, 'RecoverySuccess', 3);
          expect(args1[0]).to.eq(bobWallet.address);
          expect(args1[1]).to.eq(anotherWallet.address);
          expect(args1[2]).to.eq(await bobIdentity.getAddress());

          const args2 = getLogEventArgs(txReceipt, 'TokensFrozen', 2);
          expect(args2[0]).to.eq(anotherWallet.address);
          expect(await fhevm.decrypt64(args2[1])).to.eq(50);

          const encFrozenTokens = await token.getFrozenTokens(anotherWallet.address);
          const frozenTokens = await fhevm.decrypt64(encFrozenTokens);

          expect(frozenTokens).to.be.eq(50);
        });
      });
    });
  });
});
