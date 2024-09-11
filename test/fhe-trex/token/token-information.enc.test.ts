import { expect } from 'chai';
import { fhevm } from 'hardhat';
import { deployFullSuiteFixture } from '../fixtures/deploy-full-suite.fixture';
import { tokenBalanceOf, tokenFreeze, tokenTotalSupply, tokenUnfreeze } from '../../utils';

describe('Token - Information', () => {
  describe('.totalSupply()', () => {
    it('should return the total supply', async () => {
      const {
        suite: { token },
        accounts: { aliceWallet, bobWallet },
      } = await deployFullSuiteFixture();

      const aliceBalance = await tokenBalanceOf(token, aliceWallet);
      const bobBalance = await tokenBalanceOf(token, bobWallet);
      const totalSupply = await tokenTotalSupply(token);

      expect(totalSupply).to.equal(aliceBalance + bobBalance);
    });
  });

  describe('.freezePartialTokens', () => {
    describe('when sender is an agent', () => {
      describe('when amounts exceed current balance', () => {
        it('should do nothing', async () => {
          const {
            suite: { token },
            accounts: { tokenAgent, anotherWallet },
          } = await deployFullSuiteFixture();

          const encBefore = await token.getFrozenTokens(anotherWallet);
          await tokenFreeze(token, tokenAgent, anotherWallet, 1);
          const encAfter = await token.getFrozenTokens(anotherWallet);

          const before = encBefore === 0n ? 0n : await fhevm.decrypt64(encBefore);
          const after = encAfter === 0n ? 0n : await fhevm.decrypt64(encAfter);

          expect(after).to.be.equal(before);
        });
      });
    });
  });

  describe('.unfreezePartialTokens', () => {
    describe('when sender is an agent', () => {
      describe('when amounts exceed current frozen balance', () => {
        it('should o nothing', async () => {
          const {
            suite: { token },
            accounts: { tokenAgent, anotherWallet },
          } = await deployFullSuiteFixture();

          const encBefore = await token.getFrozenTokens(anotherWallet);
          await tokenUnfreeze(token, tokenAgent, anotherWallet, 1);
          const encAfter = await token.getFrozenTokens(anotherWallet);

          const before = encBefore === 0n ? 0n : await fhevm.decrypt64(encBefore);
          const after = encAfter === 0n ? 0n : await fhevm.decrypt64(encAfter);

          expect(after).to.be.equal(before);

          // await expect(token.connect(tokenAgent).unfreezePartialTokens(anotherWallet.address, 1)).to.be.revertedWith(
          //   'Amount should be less than or equal to frozen tokens',
          // );
        });
      });
    });
  });
});
