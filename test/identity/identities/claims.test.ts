import { expect } from 'chai';
import hre from 'hardhat';

import { deployIdentityFixture } from '../fixtures';
import { ClaimIssuer, Identity } from '../../../types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('Identity', () => {
  describe('Claims', () => {
    describe('addClaim', () => {
      describe('when the claim is self-attested (issuer is identity address)', () => {
        describe('when the claim is not valid', () => {
          it('should add the claim anyway', async () => {
            const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();
            const aliceIdentityContractAddress = await aliceIdentityContract.getAddress();
            const invalidClaim = {
              identity: aliceIdentityContractAddress,
              issuer: aliceIdentityContractAddress,
              topic: 42,
              scheme: 1,
              data: '0x0042',
              signature: '',
              uri: 'https://example.com',
            };
            invalidClaim.signature = await aliceWallet.signMessage(
              hre.ethers.getBytes(
                hre.ethers.keccak256(
                  hre.ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address', 'uint256', 'bytes'],
                    [invalidClaim.identity, invalidClaim.topic, '0x101010'],
                  ),
                ),
              ),
            );

            const tx = await aliceIdentityContract
              .connect(aliceWallet)
              .addClaim(
                invalidClaim.topic,
                invalidClaim.scheme,
                invalidClaim.issuer,
                invalidClaim.signature,
                invalidClaim.data,
                invalidClaim.uri,
              );
            await expect(tx)
              .to.emit(aliceIdentityContract, 'ClaimAdded')
              .withArgs(
                hre.ethers.keccak256(
                  hre.ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address', 'uint256'],
                    [invalidClaim.issuer, invalidClaim.topic],
                  ),
                ),
                invalidClaim.topic,
                invalidClaim.scheme,
                invalidClaim.issuer,
                invalidClaim.signature,
                invalidClaim.data,
                invalidClaim.uri,
              );
            await expect(
              aliceIdentityContract.isClaimValid(
                invalidClaim.identity,
                invalidClaim.topic,
                invalidClaim.signature,
                invalidClaim.data,
              ),
            ).to.eventually.equal(false);
          });
        });

        describe('when the claim is valid', () => {
          let claim = { identity: '', issuer: '', topic: 0, scheme: 1, data: '', uri: '', signature: '' };
          let aliceIdentityContract: Identity;
          let aliceIdentityContractAddress: string;
          let aliceWallet: HardhatEthersSigner;
          let bobWallet: HardhatEthersSigner;
          beforeEach(async () => {
            const params = await deployIdentityFixture();
            aliceIdentityContract = params.aliceIdentityContract;
            aliceWallet = params.aliceWallet;
            bobWallet = params.bobWallet;

            aliceIdentityContractAddress = await aliceIdentityContract.getAddress();

            claim = {
              identity: aliceIdentityContractAddress,
              issuer: aliceIdentityContractAddress,
              topic: 42,
              scheme: 1,
              data: '0x0042',
              signature: '',
              uri: 'https://example.com',
            };
            claim.signature = await aliceWallet.signMessage(
              hre.ethers.getBytes(
                hre.ethers.keccak256(
                  hre.ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address', 'uint256', 'bytes'],
                    [claim.identity, claim.topic, claim.data],
                  ),
                ),
              ),
            );
          });

          describe('when caller is the identity itself (execute)', () => {
            it('should add the claim', async () => {
              const action = {
                to: aliceIdentityContractAddress,
                value: 0,
                data: new hre.ethers.Interface([
                  'function addClaim(uint256 topic, uint256 scheme, address issuer, bytes calldata signature, bytes calldata data, string calldata uri) external returns (bytes32 claimRequestId)',
                ]).encodeFunctionData('addClaim', [
                  claim.topic,
                  claim.scheme,
                  claim.issuer,
                  claim.signature,
                  claim.data,
                  claim.uri,
                ]),
              };
              await aliceIdentityContract.connect(bobWallet).execute(action.to, action.value, action.data);
              const tx = await aliceIdentityContract.connect(aliceWallet).approve(0, true);
              await expect(tx)
                .to.emit(aliceIdentityContract, 'ClaimAdded')
                .withArgs(
                  hre.ethers.keccak256(
                    hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [claim.issuer, claim.topic]),
                  ),
                  claim.topic,
                  claim.scheme,
                  claim.issuer,
                  claim.signature,
                  claim.data,
                  claim.uri,
                );
              await expect(tx).to.emit(aliceIdentityContract, 'Approved');
              await expect(tx).to.emit(aliceIdentityContract, 'Executed');
              await expect(
                aliceIdentityContract.isClaimValid(claim.identity, claim.topic, claim.signature, claim.data),
              ).to.eventually.equal(true);
            });
          });

          describe('when caller is a CLAIM or MANAGEMENT key', () => {
            it('should add the claim', async () => {
              it('should add the claim anyway', async () => {
                //const { aliceIdentityContract, aliceWallet } = await deployIdentityFixture();
                const tx = await aliceIdentityContract
                  .connect(aliceWallet)
                  .addClaim(claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);
                await expect(tx)
                  .to.emit(aliceIdentityContract, 'ClaimAdded')
                  .withArgs(
                    hre.ethers.keccak256(
                      hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [claim.issuer, claim.topic]),
                    ),
                    claim.topic,
                    claim.scheme,
                    claim.issuer,
                    claim.signature,
                    claim.data,
                    claim.uri,
                  );
              });
            });
          });

          describe('when caller is not a CLAIM key', () => {
            it('should revert for missing permission', async () => {
              //const { aliceIdentityContract, bobWallet } = await deployIdentityFixture();
              await expect(
                aliceIdentityContract
                  .connect(bobWallet)
                  .addClaim(claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri),
              ).to.be.revertedWith('Permissions: Sender does not have claim signer key');
            });
          });
        });
      });

      describe('when the claim is from a claim issuer', () => {
        describe('when the claim is not valid', () => {
          it('should revert for invalid claim', async () => {
            const { aliceIdentityContract, aliceWallet, claimIssuerWallet, claimIssuerContract } =
              await deployIdentityFixture();
            const aliceIdentityContractAddress = await aliceIdentityContract.getAddress();
            const claimIssuerContractAddress = await claimIssuerContract.getAddress();
            const claim = {
              identity: aliceIdentityContractAddress,
              issuer: claimIssuerContractAddress,
              topic: 42,
              scheme: 1,
              data: '0x0042',
              signature: '',
              uri: 'https://example.com',
            };
            claim.signature = await claimIssuerWallet.signMessage(
              hre.ethers.getBytes(
                hre.ethers.keccak256(
                  hre.ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address', 'uint256', 'bytes'],
                    [claim.identity, claim.topic, '0x10101010'],
                  ),
                ),
              ),
            );
            await expect(
              aliceIdentityContract
                .connect(aliceWallet)
                .addClaim(claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri),
            ).to.be.revertedWith('invalid claim');
          });
        });

        describe('when the claim is valid', () => {
          let claim = { identity: '', issuer: '', topic: 0, scheme: 1, data: '', uri: '', signature: '' };
          let aliceIdentityContract: Identity;
          let claimIssuerContract: ClaimIssuer;
          let aliceIdentityContractAddress: string;
          let claimIssuerContractAddress: string;
          let aliceWallet: HardhatEthersSigner;
          let bobWallet: HardhatEthersSigner;
          let claimIssuerWallet: HardhatEthersSigner;

          beforeEach(async () => {
            const params = await deployIdentityFixture();
            aliceIdentityContract = params.aliceIdentityContract;
            claimIssuerContract = params.claimIssuerContract;
            claimIssuerWallet = params.claimIssuerWallet;
            aliceWallet = params.aliceWallet;
            bobWallet = params.bobWallet;
            aliceIdentityContractAddress = await aliceIdentityContract.getAddress();
            claimIssuerContractAddress = await claimIssuerContract.getAddress();

            claim = {
              identity: aliceIdentityContractAddress,
              issuer: claimIssuerContractAddress,
              topic: 42,
              scheme: 1,
              data: '0x0042',
              signature: '',
              uri: 'https://example.com',
            };
            claim.signature = await claimIssuerWallet.signMessage(
              hre.ethers.getBytes(
                hre.ethers.keccak256(
                  hre.ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address', 'uint256', 'bytes'],
                    [claim.identity, claim.topic, claim.data],
                  ),
                ),
              ),
            );
          });

          describe('when caller is the identity itself (execute)', () => {
            it('should add the claim', async () => {
              const action = {
                to: aliceIdentityContractAddress,
                value: 0,
                data: new hre.ethers.Interface([
                  'function addClaim(uint256 topic, uint256 scheme, address issuer, bytes calldata signature, bytes calldata data, string calldata uri) external returns (bytes32 claimRequestId)',
                ]).encodeFunctionData('addClaim', [
                  claim.topic,
                  claim.scheme,
                  claim.issuer,
                  claim.signature,
                  claim.data,
                  claim.uri,
                ]),
              };

              await aliceIdentityContract.connect(bobWallet).execute(action.to, action.value, action.data);
              const tx = await aliceIdentityContract.connect(aliceWallet).approve(0, true);
              await expect(tx)
                .to.emit(aliceIdentityContract, 'ClaimAdded')
                .withArgs(
                  hre.ethers.keccak256(
                    hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [claim.issuer, claim.topic]),
                  ),
                  claim.topic,
                  claim.scheme,
                  claim.issuer,
                  claim.signature,
                  claim.data,
                  claim.uri,
                );
              await expect(tx).to.emit(aliceIdentityContract, 'Approved');
              await expect(tx).to.emit(aliceIdentityContract, 'Executed');
            });
          });

          describe('when caller is a CLAIM or MANAGEMENT key', () => {
            it('should add the claim', async () => {
              it('should add the claim anyway', async () => {
                const tx = await aliceIdentityContract
                  .connect(aliceWallet)
                  .addClaim(claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);
                await expect(tx)
                  .to.emit(aliceIdentityContract, 'ClaimAdded')
                  .withArgs(
                    hre.ethers.keccak256(
                      hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [claim.issuer, claim.topic]),
                    ),
                    claim.topic,
                    claim.scheme,
                    claim.issuer,
                    claim.signature,
                    claim.data,
                    claim.uri,
                  );
              });
            });
          });

          describe('when caller is not a CLAIM key', () => {
            it('should revert for missing permission', async () => {
              await expect(
                aliceIdentityContract
                  .connect(bobWallet)
                  .addClaim(claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri),
              ).to.be.revertedWith('Permissions: Sender does not have claim signer key');
            });
          });
        });
      });
    });

    describe('updateClaim (addClaim)', () => {
      describe('when there is already a claim from this issuer and this topic', () => {
        let aliceIdentityContract: Identity;
        let aliceWallet: HardhatEthersSigner;
        let claimIssuerContract: ClaimIssuer;
        let claimIssuerWallet: HardhatEthersSigner;
        let aliceIdentityContractAddress: string;
        let claimIssuerContractAddress: string;

        beforeEach(async () => {
          const params = await deployIdentityFixture();
          aliceIdentityContract = params.aliceIdentityContract;
          aliceWallet = params.aliceWallet;
          claimIssuerContract = params.claimIssuerContract;
          claimIssuerWallet = params.claimIssuerWallet;

          aliceIdentityContractAddress = await aliceIdentityContract.getAddress();
          claimIssuerContractAddress = await claimIssuerContract.getAddress();

          const claim = {
            identity: aliceIdentityContractAddress,
            issuer: claimIssuerContractAddress,
            topic: 42,
            scheme: 1,
            data: '0x0042',
            signature: '',
            uri: 'https://example.com',
          };
          claim.signature = await claimIssuerWallet.signMessage(
            hre.ethers.getBytes(
              hre.ethers.keccak256(
                hre.ethers.AbiCoder.defaultAbiCoder().encode(
                  ['address', 'uint256', 'bytes'],
                  [claim.identity, claim.topic, claim.data],
                ),
              ),
            ),
          );
          await aliceIdentityContract
            .connect(aliceWallet)
            .addClaim(claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);
        });
        it('should replace the existing claim', async () => {
          const claim = {
            identity: aliceIdentityContractAddress,
            issuer: claimIssuerContractAddress,
            topic: 42,
            scheme: 1,
            data: '0x004200101010',
            signature: '',
            uri: 'https://example.com',
          };
          claim.signature = await claimIssuerWallet.signMessage(
            hre.ethers.getBytes(
              hre.ethers.keccak256(
                hre.ethers.AbiCoder.defaultAbiCoder().encode(
                  ['address', 'uint256', 'bytes'],
                  [claim.identity, claim.topic, claim.data],
                ),
              ),
            ),
          );
          const tx = await aliceIdentityContract
            .connect(aliceWallet)
            .addClaim(claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);
          await expect(tx)
            .to.emit(aliceIdentityContract, 'ClaimChanged')
            .withArgs(
              hre.ethers.keccak256(
                hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [claim.issuer, claim.topic]),
              ),
              claim.topic,
              claim.scheme,
              claim.issuer,
              claim.signature,
              claim.data,
              claim.uri,
            );
        });
      });
    });

    describe('removeClaim', () => {
      describe('When caller is the identity itself (execute)', () => {
        it('should remove an existing claim', async () => {
          const { aliceIdentityContract, aliceWallet, bobWallet, claimIssuerContract, claimIssuerWallet } =
            await deployIdentityFixture();
          const aliceIdentityContractAddress = await aliceIdentityContract.getAddress();
          const claimIssuerContractAddress = await claimIssuerContract.getAddress();

          const claim = {
            identity: aliceIdentityContractAddress,
            issuer: claimIssuerContractAddress,
            topic: 42,
            scheme: 1,
            data: '0x0042',
            signature: '',
            uri: 'https://example.com',
          };
          const claimId = hre.ethers.keccak256(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [claim.issuer, claim.topic]),
          );
          claim.signature = await claimIssuerWallet.signMessage(
            hre.ethers.getBytes(
              hre.ethers.keccak256(
                hre.ethers.AbiCoder.defaultAbiCoder().encode(
                  ['address', 'uint256', 'bytes'],
                  [claim.identity, claim.topic, claim.data],
                ),
              ),
            ),
          );
          await aliceIdentityContract
            .connect(aliceWallet)
            .addClaim(claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);
          const action = {
            to: aliceIdentityContractAddress,
            value: 0,
            data: new hre.ethers.Interface([
              'function removeClaim(bytes32 claimId) external returns (bool success)',
            ]).encodeFunctionData('removeClaim', [claimId]),
          };
          await aliceIdentityContract.connect(bobWallet).execute(action.to, action.value, action.data);
          const tx = await aliceIdentityContract.connect(aliceWallet).approve(0, true);
          await expect(tx)
            .to.emit(aliceIdentityContract, 'ClaimRemoved')
            .withArgs(claimId, claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);
        });
      });

      describe('When caller is not a CLAIM key', () => {
        it('should revert for missing permission', async () => {
          const { aliceIdentityContract, bobWallet, claimIssuerContract } = await deployIdentityFixture();
          const claimIssuerContractAddress = await claimIssuerContract.getAddress();

          const claimId = hre.ethers.keccak256(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [claimIssuerContractAddress, 42]),
          );

          await expect(aliceIdentityContract.connect(bobWallet).removeClaim(claimId)).to.be.revertedWith(
            'Permissions: Sender does not have claim signer key',
          );
        });
      });

      describe('When claim does not exist', () => {
        it('should revert for non existing claim', async () => {
          const { aliceIdentityContract, carolWallet, claimIssuerContract } = await deployIdentityFixture();
          const claimIssuerContractAddress = await claimIssuerContract.getAddress();

          const claimId = hre.ethers.keccak256(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [claimIssuerContractAddress, 42]),
          );

          await expect(aliceIdentityContract.connect(carolWallet).removeClaim(claimId)).to.be.revertedWith(
            'NonExisting: There is no claim with this ID',
          );
        });
      });

      describe('When claim does exist', () => {
        it('should remove the claim', async () => {
          const { aliceIdentityContract, aliceWallet, claimIssuerContract, claimIssuerWallet } =
            await deployIdentityFixture();
          const aliceIdentityContractAddress = await aliceIdentityContract.getAddress();
          const claimIssuerContractAddress = await claimIssuerContract.getAddress();

          const claim = {
            identity: aliceIdentityContractAddress,
            issuer: claimIssuerContractAddress,
            topic: 42,
            scheme: 1,
            data: '0x0042',
            signature: '',
            uri: 'https://example.com',
          };
          const claimId = hre.ethers.keccak256(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [claim.issuer, claim.topic]),
          );
          claim.signature = await claimIssuerWallet.signMessage(
            hre.ethers.getBytes(
              hre.ethers.keccak256(
                hre.ethers.AbiCoder.defaultAbiCoder().encode(
                  ['address', 'uint256', 'bytes'],
                  [claim.identity, claim.topic, claim.data],
                ),
              ),
            ),
          );

          await aliceIdentityContract
            .connect(aliceWallet)
            .addClaim(claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);

          const tx = await aliceIdentityContract.connect(aliceWallet).removeClaim(claimId);
          await expect(tx)
            .to.emit(aliceIdentityContract, 'ClaimRemoved')
            .withArgs(claimId, claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);
        });
      });
    });

    describe('getClaim', () => {
      describe('when claim does not exist', () => {
        it('should return an empty struct', async () => {
          const { aliceIdentityContract, claimIssuerContract } = await deployIdentityFixture();
          const claimIssuerContractAddress = await claimIssuerContract.getAddress();

          const claimId = hre.ethers.keccak256(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [claimIssuerContractAddress, 42]),
          );
          const found = await aliceIdentityContract.getClaim(claimId);
          expect(found.issuer).to.equal(hre.ethers.ZeroAddress);
          expect(found.topic).to.equal(0);
          expect(found.scheme).to.equal(0);
          expect(found.data).to.equal('0x');
          expect(found.signature).to.equal('0x');
          expect(found.uri).to.equal('');
        });
      });

      describe('when claim does exist', () => {
        it('should return the claim', async () => {
          const { aliceIdentityContract, aliceClaim666 } = await deployIdentityFixture();
          const found = await aliceIdentityContract.getClaim(aliceClaim666.id);
          expect(found.issuer).to.equal(aliceClaim666.issuer);
          expect(found.topic).to.equal(aliceClaim666.topic);
          expect(found.scheme).to.equal(aliceClaim666.scheme);
          expect(found.data).to.equal(aliceClaim666.data);
          expect(found.signature).to.equal(aliceClaim666.signature);
          expect(found.uri).to.equal(aliceClaim666.uri);
        });
      });
    });

    describe('getClaimIdsByTopic', () => {
      it('should return an empty array when there are no claims for the topic', async () => {
        const { aliceIdentityContract } = await deployIdentityFixture();
        await expect(aliceIdentityContract.getClaimIdsByTopic(101010)).to.eventually.deep.equal([]);
      });
      it('should return an array of claim Id existing fo the topic', async () => {
        const { aliceIdentityContract, aliceClaim666 } = await deployIdentityFixture();
        await expect(aliceIdentityContract.getClaimIdsByTopic(aliceClaim666.topic)).to.eventually.deep.equal([
          aliceClaim666.id,
        ]);
      });
    });
  });
});
