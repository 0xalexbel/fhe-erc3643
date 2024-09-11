import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployFullSuiteFixture } from '../fixtures/deploy-full-suite.fixture';

describe('Token - Recovery', () => {
  describe('.recoveryAddress()', () => {
    describe('when sender is not an agent', () => {
      it('should reverts', async () => {
        const {
          suite: { token },
          accounts: { bobWallet, anotherWallet },
          identities: { bobIdentity },
        } = await deployFullSuiteFixture();

        await bobIdentity
          .connect(bobWallet)
          .addKey(
            ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address'], [anotherWallet.address])),
            1,
            1,
          );

        await expect(
          token.connect(anotherWallet).recoveryAddress(bobWallet.address, anotherWallet.address, bobIdentity),
        ).to.be.revertedWith('AgentRole: caller does not have the Agent role');
      });
    });

    describe('when sender is an agent', () => {
      describe('when new wallet is not authorized on the identity', () => {
        it('should revert', async () => {
          const {
            suite: { token },
            accounts: { tokenAgent, bobWallet, anotherWallet },
            identities: { bobIdentity },
          } = await deployFullSuiteFixture();

          await expect(
            token.connect(tokenAgent).recoveryAddress(bobWallet.address, anotherWallet.address, bobIdentity),
          ).to.be.revertedWith('Recovery not possible');
        });
      });

      describe('when wallet is frozen', () => {
        it('should recover and freeze the new wallet', async () => {
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

          await token.connect(tokenAgent).setAddressFrozen(bobWallet.address, true);

          const tx = await token
            .connect(tokenAgent)
            .recoveryAddress(bobWallet.address, anotherWallet.address, bobIdentity);
          await expect(token.isFrozen(anotherWallet.address)).to.be.eventually.true;
          await expect(tx)
            .to.emit(token, 'RecoverySuccess')
            .withArgs(bobWallet.address, anotherWallet.address, bobIdentity);
          await expect(tx).to.emit(token, 'AddressFrozen').withArgs(anotherWallet.address, true, tokenAgent.address);
        });
      });
    });
  });
});
