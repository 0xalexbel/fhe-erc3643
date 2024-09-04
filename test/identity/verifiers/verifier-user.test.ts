import { expect } from 'chai';
import hre from 'hardhat';

describe('VerifierUser', () => {
  describe('when calling a verified function not as an identity', () => {
    it('should revert', async () => {
      const verifierUser = await hre.ethers.deployContract('VerifierUser', []);

      await verifierUser.addClaimTopic(666);

      await expect(verifierUser.doSomething()).to.be.reverted;
    });
  });

  describe('when identity is verified', () => {
    it('should return', async () => {
      const [aliceWallet, claimIssuerWallet] = await hre.ethers.getSigners();
      const claimIssuer = await hre.ethers.deployContract('ClaimIssuer', [claimIssuerWallet.address]);
      const aliceIdentity = await hre.ethers.deployContract('Identity', [aliceWallet.address, false]);
      const verifierUser = await hre.ethers.deployContract('VerifierUser', []);

      const aliceIdentityAddress = await aliceIdentity.getAddress();
      const claimIssuerAddress = await claimIssuer.getAddress();
      const verifierUserAddress = await verifierUser.getAddress();

      await verifierUser.addClaimTopic(666);
      await verifierUser.addTrustedIssuer(claimIssuerAddress, [666]);

      const aliceClaim666 = {
        id: '',
        identity: aliceIdentityAddress,
        issuer: claimIssuerAddress,
        topic: 666,
        scheme: 1,
        data: '0x0042',
        signature: '',
        uri: 'https://example.com',
      };
      aliceClaim666.signature = await claimIssuerWallet.signMessage(
        hre.ethers.getBytes(
          hre.ethers.keccak256(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(
              ['address', 'uint256', 'bytes'],
              [aliceClaim666.identity, aliceClaim666.topic, aliceClaim666.data],
            ),
          ),
        ),
      );
      await aliceIdentity
        .connect(aliceWallet)
        .addClaim(
          aliceClaim666.topic,
          aliceClaim666.scheme,
          aliceClaim666.issuer,
          aliceClaim666.signature,
          aliceClaim666.data,
          aliceClaim666.uri,
        );

      const action = {
        to: verifierUserAddress,
        value: 0,
        data: new hre.ethers.Interface(['function doSomething()']).encodeFunctionData('doSomething'),
      };

      const tx = await aliceIdentity.connect(aliceWallet).execute(action.to, action.value, action.data);
      expect(tx).to.emit(aliceIdentity, 'Executed');
    });
  });

  describe('when identity is not verified', () => {
    it('should revert', async () => {
      const [aliceWallet, claimIssuerWallet] = await hre.ethers.getSigners();
      const claimIssuer = await hre.ethers.deployContract('ClaimIssuer', [claimIssuerWallet.address]);
      const aliceIdentity = await hre.ethers.deployContract('Identity', [aliceWallet.address, false]);
      const verifierUser = await hre.ethers.deployContract('VerifierUser', []);

      const aliceIdentityAddress = await aliceIdentity.getAddress();
      const claimIssuerAddress = await claimIssuer.getAddress();
      const verifierUserAddress = await verifierUser.getAddress();

      await verifierUser.addClaimTopic(666);
      await verifierUser.addTrustedIssuer(claimIssuerAddress, [666]);

      const aliceClaim666 = {
        id: '',
        identity: aliceIdentityAddress,
        issuer: claimIssuerAddress,
        topic: 666,
        scheme: 1,
        data: '0x0042',
        signature: '',
        uri: 'https://example.com',
      };
      aliceClaim666.signature = await claimIssuerWallet.signMessage(
        hre.ethers.getBytes(
          hre.ethers.keccak256(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(
              ['address', 'uint256', 'bytes'],
              [aliceClaim666.identity, aliceClaim666.topic, aliceClaim666.data],
            ),
          ),
        ),
      );
      await aliceIdentity
        .connect(aliceWallet)
        .addClaim(
          aliceClaim666.topic,
          aliceClaim666.scheme,
          aliceClaim666.issuer,
          aliceClaim666.signature,
          aliceClaim666.data,
          aliceClaim666.uri,
        );

      await claimIssuer.connect(claimIssuerWallet).revokeClaimBySignature(aliceClaim666.signature);

      const action = {
        to: verifierUserAddress,
        value: 0,
        data: new hre.ethers.Interface(['function doSomething()']).encodeFunctionData('doSomething'),
      };

      const tx = await aliceIdentity.connect(aliceWallet).execute(action.to, action.value, action.data);
      expect(tx).to.emit(aliceIdentity, 'ExecutionFailed');
    });
  });
});
