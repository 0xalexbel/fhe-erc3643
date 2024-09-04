import { expect } from 'chai';
import { deployFullSuiteFixture } from '../fixtures/deploy-full-suite.fixture';

describe('ClaimTopicsRegistry', () => {
  describe('.init', () => {
    describe('when contract was already initialized', () => {
      it('should revert', async () => {
        const {
          suite: { claimTopicsRegistry },
        } = await deployFullSuiteFixture();
        await expect(claimTopicsRegistry.init()).to.be.revertedWithCustomError(
          claimTopicsRegistry,
          'InvalidInitialization',
        );
      });
    });
  });

  describe('.addClaimTopic', () => {
    describe('when sender is not owner', () => {
      it('should revert', async () => {
        const {
          suite: { claimTopicsRegistry },
          accounts: { anotherWallet },
        } = await deployFullSuiteFixture();

        await expect(claimTopicsRegistry.connect(anotherWallet).addClaimTopic(1)).to.be.revertedWithCustomError(
          claimTopicsRegistry,
          'OwnableUnauthorizedAccount',
        );
      });
    });

    describe('when sender is owner', () => {
      describe('when topic array contains more than 14 elements', () => {
        it('should revert', async () => {
          const {
            suite: { claimTopicsRegistry },
            accounts: { deployer },
          } = await deployFullSuiteFixture();

          await Promise.all(Array.from({ length: 14 }, (_, i) => i).map(i => claimTopicsRegistry.addClaimTopic(i)));

          await expect(claimTopicsRegistry.connect(deployer).addClaimTopic(14)).to.be.revertedWith(
            'cannot require more than 15 topics',
          );
        });
      });

      describe('when adding a topic that is already added', () => {
        it('should revert', async () => {
          const {
            suite: { claimTopicsRegistry },
            accounts: { deployer },
          } = await deployFullSuiteFixture();

          await claimTopicsRegistry.addClaimTopic(1);

          await expect(claimTopicsRegistry.connect(deployer).addClaimTopic(1)).to.be.revertedWith(
            'claimTopic already exists',
          );
        });
      });
    });
  });

  describe('.removeClaimTopic', () => {
    describe('when sender is not owner', () => {
      it('should revert', async () => {
        const {
          suite: { claimTopicsRegistry },
          accounts: { anotherWallet },
        } = await deployFullSuiteFixture();

        await expect(claimTopicsRegistry.connect(anotherWallet).removeClaimTopic(1)).to.be.revertedWithCustomError(
          claimTopicsRegistry,
          'OwnableUnauthorizedAccount',
        );
      });
    });

    describe('when sender is owner', () => {
      it('should remove claim topic', async () => {
        const {
          suite: { claimTopicsRegistry },
          accounts: { deployer },
        } = await deployFullSuiteFixture();

        await claimTopicsRegistry.addClaimTopic(1);
        await claimTopicsRegistry.addClaimTopic(2);
        await claimTopicsRegistry.addClaimTopic(3);

        const tx = await claimTopicsRegistry.connect(deployer).removeClaimTopic(2);
        await expect(tx).to.emit(claimTopicsRegistry, 'ClaimTopicRemoved').withArgs(2);
      });
    });
  });
});
