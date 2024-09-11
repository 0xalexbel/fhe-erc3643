/* eslint-disable @typescript-eslint/no-unused-expressions */

import { expect } from 'chai';
import hre from 'hardhat';
import { deployIdentityFixture } from '../fixtures';

describe('ClaimIssuer - Reference (with revoke)', () => {
  describe('revokeClaim (deprecated)', () => {
    describe('when calling as a non MANAGEMENT key', () => {
      it('should revert for missing permissions', async () => {
        const { claimIssuerContract, aliceWallet, aliceClaim666 } = await deployIdentityFixture();

        await expect(
          claimIssuerContract.connect(aliceWallet).revokeClaim(aliceClaim666.id, aliceClaim666.identity),
        ).to.be.revertedWith('Permissions: Sender does not have management key');
      });
    });

    describe('when calling as a MANAGEMENT key', () => {
      describe('when claim was already revoked', () => {
        it('should revert for conflict', async () => {
          const { claimIssuerContract, claimIssuerWallet, aliceClaim666 } = await deployIdentityFixture();

          await claimIssuerContract.connect(claimIssuerWallet).revokeClaim(aliceClaim666.id, aliceClaim666.identity);

          await expect(
            claimIssuerContract.connect(claimIssuerWallet).revokeClaim(aliceClaim666.id, aliceClaim666.identity),
          ).to.be.revertedWith('Conflict: Claim already revoked');
        });
      });

      describe('when is not revoked already', () => {
        it('should revoke the claim', async () => {
          const { claimIssuerContract, claimIssuerWallet, aliceClaim666 } = await deployIdentityFixture();

          expect(
            await claimIssuerContract.isClaimValid(
              aliceClaim666.identity,
              aliceClaim666.topic,
              aliceClaim666.signature,
              aliceClaim666.data,
            ),
          ).to.be.true;

          const tx = await claimIssuerContract
            .connect(claimIssuerWallet)
            .revokeClaim(aliceClaim666.id, aliceClaim666.identity);

          await expect(tx).to.emit(claimIssuerContract, 'ClaimRevoked').withArgs(aliceClaim666.signature);

          expect(await claimIssuerContract.isClaimRevoked(aliceClaim666.signature)).to.be.true;
          expect(
            await claimIssuerContract.isClaimValid(
              aliceClaim666.identity,
              aliceClaim666.topic,
              aliceClaim666.signature,
              aliceClaim666.data,
            ),
          ).to.be.false;
        });
      });
    });
  });

  describe('revokeClaimBySignature', () => {
    describe('when calling as a non MANAGEMENT key', () => {
      it('should revert for missing permissions', async () => {
        const { claimIssuerContract, aliceWallet, aliceClaim666 } = await deployIdentityFixture();

        await expect(
          claimIssuerContract.connect(aliceWallet).revokeClaimBySignature(aliceClaim666.signature),
        ).to.be.revertedWith('Permissions: Sender does not have management key');
      });
    });

    describe('when calling as a MANAGEMENT key', () => {
      describe('when claim was already revoked', () => {
        it('should revert for conflict', async () => {
          const { claimIssuerContract, claimIssuerWallet, aliceClaim666 } = await deployIdentityFixture();

          await claimIssuerContract.connect(claimIssuerWallet).revokeClaimBySignature(aliceClaim666.signature);

          await expect(
            claimIssuerContract.connect(claimIssuerWallet).revokeClaimBySignature(aliceClaim666.signature),
          ).to.be.revertedWith('Conflict: Claim already revoked');
        });
      });

      describe('when is not revoked already', () => {
        it('should revoke the claim', async () => {
          const { claimIssuerContract, claimIssuerWallet, aliceClaim666 } = await deployIdentityFixture();

          expect(
            await claimIssuerContract.isClaimValid(
              aliceClaim666.identity,
              aliceClaim666.topic,
              aliceClaim666.signature,
              aliceClaim666.data,
            ),
          ).to.be.true;

          const tx = await claimIssuerContract
            .connect(claimIssuerWallet)
            .revokeClaimBySignature(aliceClaim666.signature);

          await expect(tx).to.emit(claimIssuerContract, 'ClaimRevoked').withArgs(aliceClaim666.signature);

          expect(await claimIssuerContract.isClaimRevoked(aliceClaim666.signature)).to.be.true;
          expect(
            await claimIssuerContract.isClaimValid(
              aliceClaim666.identity,
              aliceClaim666.topic,
              aliceClaim666.signature,
              aliceClaim666.data,
            ),
          ).to.be.false;
        });
      });
    });
  });

  describe('getRecoveredAddress', () => {
    it('should return with a zero address with signature is not of proper length', async () => {
      const { claimIssuerContract, aliceClaim666 } = await deployIdentityFixture();

      expect(
        await claimIssuerContract.getRecoveredAddress(
          aliceClaim666.signature + '00',
          hre.ethers.getBytes(
            hre.ethers.keccak256(
              hre.ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'bytes'],
                [aliceClaim666.identity, aliceClaim666.topic, aliceClaim666.data],
              ),
            ),
          ),
        ),
      ).to.be.equal(hre.ethers.ZeroAddress);
    });
  });
});
