import { expect } from 'chai';
import hre from 'hardhat';
import { deployFullSuiteFixture } from './fixtures/deploy-full-suite.fixture';
import { encrypt64, expectDecrypt64, getLogEventArgs } from '../utils';
import { ethers as EthersT } from 'ethers';
import { AgentManager } from '../../types';
import { expectRevert } from '../tx_error';

export async function callFreezeTxPromise(
  agentManager: AgentManager,
  signer: EthersT.Signer,
  user: EthersT.AddressLike,
  amount: number | bigint,
  identity: EthersT.AddressLike,
) {
  const signerEncAmount = await encrypt64(agentManager, signer, amount);
  return agentManager
    .connect(signer)
    [
      'callFreezePartialTokens(address,bytes32,address,bytes)'
    ](user, signerEncAmount.handles[0], identity, signerEncAmount.inputProof);
}

export async function callUnfreezeTxPromise(
  agentManager: AgentManager,
  signer: EthersT.Signer,
  user: EthersT.AddressLike,
  amount: number | bigint,
  identity: EthersT.AddressLike,
) {
  const signerEncAmount = await encrypt64(agentManager, signer, amount);
  return agentManager
    .connect(signer)
    [
      'callUnfreezePartialTokens(address,bytes32,address,bytes)'
    ](user, signerEncAmount.handles[0], identity, signerEncAmount.inputProof);
}

export async function callMintTxPromise(
  agentManager: AgentManager,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
  identity: EthersT.AddressLike,
) {
  const signerEncAmount = await encrypt64(agentManager, signer, amount);
  return agentManager
    .connect(signer)
    ['callMint(address,bytes32,address,bytes)'](to, signerEncAmount.handles[0], identity, signerEncAmount.inputProof);
}

export async function callBurnTxPromise(
  agentManager: AgentManager,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
  identity: EthersT.AddressLike,
) {
  const signerEncAmount = await encrypt64(agentManager, signer, amount);
  return agentManager
    .connect(signer)
    ['callBurn(address,bytes32,address,bytes)'](to, signerEncAmount.handles[0], identity, signerEncAmount.inputProof);
}

export async function callFreeze(
  agentManager: AgentManager,
  signer: EthersT.Signer,
  user: EthersT.AddressLike,
  amount: number | bigint,
  identity: EthersT.AddressLike,
) {
  const tx = await callFreezeTxPromise(agentManager, signer, user, amount, identity);
  return await tx.wait(1);
}

export async function callUnfreeze(
  agentManager: AgentManager,
  signer: EthersT.Signer,
  user: EthersT.AddressLike,
  amount: number | bigint,
  identity: EthersT.AddressLike,
) {
  const tx = await callUnfreezeTxPromise(agentManager, signer, user, amount, identity);
  return await tx.wait(1);
}

export async function callMint(
  agentManager: AgentManager,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
  identity: EthersT.AddressLike,
) {
  const tx = await callMintTxPromise(agentManager, signer, to, amount, identity);
  return await tx.wait(1);
}

export async function callBurn(
  agentManager: AgentManager,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
  identity: EthersT.AddressLike,
) {
  const tx = await callBurnTxPromise(agentManager, signer, to, amount, identity);
  return await tx.wait(1);
}

describe('AgentManager', () => {
  describe('.callForceTransfer', () => {
    // describe('when specified identity is missing the TransferManager role', () => {
    //   it('Should revert', async () => {
    //     const {
    //       suite: { agentManager },
    //       accounts: { aliceWallet, bobWallet },
    //       identities: { aliceIdentity },
    //     } = await deployFullSuiteFixture();

    //     await expect(
    //       agentManager.connect(aliceWallet).callForcedTransfer(aliceWallet, bobWallet, 200, aliceIdentity),
    //     ).to.be.revertedWith('Role: Sender is NOT Transfer Manager');
    //   });
    // });

    // describe('when specified identity has the TransferManager role but the sender is not authorized for it', () => {
    //   it('should revert', async () => {
    //     const {
    //       suite: { agentManager },
    //       accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
    //       identities: { aliceIdentity },
    //     } = await deployFullSuiteFixture();

    //     await agentManager.connect(tokenAdmin).addTransferManager(aliceIdentity);

    //     await expect(
    //       agentManager
    //         .connect(anotherWallet)
    //         .callForcedTransfer(aliceWallet.address, bobWallet.address, 200, aliceIdentity),
    //     ).to.be.revertedWith('Role: Sender is NOT Transfer Manager');
    //   });
    // });

    describe('when identity has the TransferManager role and the sender is authorized for it', () => {
      it('Should perform the transfer', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addTransferManager(aliceIdentity);

        const signerEncAmount = await encrypt64(token, aliceWallet, 200);

        // await expect(transferTx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 200);
        const tx = await agentManager
          .connect(aliceWallet)
          [
            'callForcedTransfer(address,address,bytes32,address,bytes)'
          ](aliceWallet.address, bobWallet.address, signerEncAmount.handles[0], aliceIdentity, signerEncAmount.inputProof);
        const txReceipt = await tx.wait(1);

        const args = getLogEventArgs(txReceipt, 'Transfer', undefined, token);
        expect(args[0]).to.equal(aliceWallet.address);
        expect(args[1]).to.equal(bobWallet.address);

        await expectDecrypt64(args[2], 200);
      });
    });
  });

  describe('.callBatchForceTransfer', () => {
    // Not supported in FHEVM
    // describe('when identity has the TransferManager role and the sender is authorized for it', () => {
    //   it('Should perform the transfer', async () => {
    //     const {
    //       suite: { agentManager, token },
    //       accounts: { tokenAdmin, aliceWallet, bobWallet },
    //       identities: { aliceIdentity },
    //     } = await deployFullSuiteFixture();
    //     await agentManager.connect(tokenAdmin).addTransferManager(aliceIdentity);
    //     const transferTx = await agentManager
    //       .connect(aliceWallet)
    //       .callBatchForcedTransfer(
    //         [aliceWallet.address, bobWallet.address],
    //         [bobWallet.address, aliceWallet.address],
    //         [200, 200],
    //         aliceIdentity,
    //       );
    //     await expect(transferTx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 200);
    //     await expect(transferTx).to.emit(token, 'Transfer').withArgs(bobWallet.address, aliceWallet.address, 200);
    //   });
    // });
  });

  describe('.callMint', () => {
    describe('when specified identity is missing the SupplyModifier role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await expectRevert(
          callMintTxPromise(agentManager, aliceWallet, bobWallet, 1000, aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    describe('when specified identity has the SupplyModifier role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addSupplyModifier(aliceIdentity);

        // await expect(
        //   agentManager.connect(anotherWallet).callMint(bobWallet.address, 1000, aliceIdentity),
        // ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
        await expectRevert(
          callMintTxPromise(agentManager, anotherWallet, bobWallet, 1000, aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    describe('when identity has the SupplyModifier role and the sender is authorized for it', () => {
      it('Should perform the mint', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addSupplyModifier(aliceIdentity);

        //1. await agentManager.connect(aliceWallet).callMint(bobWallet.address, 1000, aliceIdentity);
        const txReceipt = await callMint(agentManager, aliceWallet, bobWallet.address, 1000, aliceIdentity);

        // 2. expect(mintTx).to.emit(token, 'Transfer').withArgs(hre.ethers.ZeroAddress, bobWallet.address, 1000);
        const args = getLogEventArgs(txReceipt, 'Transfer', undefined, token);
        expect(args[0]).to.equal(hre.ethers.ZeroAddress);
        expect(args[1]).to.equal(bobWallet.address);

        await expectDecrypt64(args[2], 1000);
      });
    });
  });

  // BatchMint not supported in FHEVM
  describe('.callBatchMint', () => {
    describe('when specified identity is missing the SupplyModifier role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await expect(
          agentManager
            .connect(aliceWallet)
            .callBatchMint([bobWallet.address, aliceWallet.address], [1000, 500], aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    describe('when specified identity has the SupplyModifier role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addSupplyModifier(aliceIdentity);

        await expect(
          agentManager
            .connect(anotherWallet)
            .callBatchMint([bobWallet.address, aliceWallet.address], [1000, 500], aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    // Not supported in FHEVM
    // describe('when identity has the SupplyModifier role and the sender is authorized for it', () => {
    //   it('Should perform the batch mint', async () => {
    //     const {
    //       suite: { agentManager, token },
    //       accounts: { tokenAdmin, aliceWallet, bobWallet },
    //       identities: { aliceIdentity },
    //     } = await deployFullSuiteFixture();

    //     await agentManager.connect(tokenAdmin).addSupplyModifier(aliceIdentity);

    //     const mintTx = await agentManager
    //       .connect(aliceWallet)
    //       .callBatchMint([bobWallet.address, aliceWallet.address], [1000, 500], aliceIdentity);

    //     await expect(mintTx).to.emit(token, 'Transfer').withArgs(hre.ethers.ZeroAddress, bobWallet.address, 1000);
    //     await expect(mintTx).to.emit(token, 'Transfer').withArgs(hre.ethers.ZeroAddress, aliceWallet.address, 500);
    //   });
    // });
  });

  describe('.callBurn', () => {
    describe('when specified identity is missing the SupplyModifier role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        // await expect(
        //   agentManager.connect(aliceWallet).callBurn(bobWallet.address, 1000, aliceIdentity),
        // ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
        await expectRevert(
          callMintTxPromise(agentManager, aliceWallet, bobWallet, 1000, aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    describe('when specified identity has the SupplyModifier role but the sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet, anotherWallet },
          identities: { bobIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addSupplyModifier(bobIdentity);

        // await expect(
        //   agentManager.connect(anotherWallet).callBurn(bobWallet.address, 200, bobIdentity),
        // ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
        await expectRevert(
          callMintTxPromise(agentManager, anotherWallet, bobWallet, 200, bobIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    describe('when identity has the SupplyModifier role and the sender is authorized for it', () => {
      it('Should perform the burn', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, bobWallet },
          identities: { bobIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addSupplyModifier(bobIdentity);

        // 1. await agentManager.connect(bobWallet).callBurn(bobWallet.address, 200, bobIdentity);
        const txReceipt = await callBurn(agentManager, bobWallet, bobWallet.address, 200, bobIdentity);

        // 2. expect(burnTx).to.emit(token, 'Transfer').withArgs(bobWallet.address, hre.ethers.ZeroAddress, 200);
        const args = getLogEventArgs(txReceipt, 'Transfer', undefined, token);
        expect(args[0]).to.equal(bobWallet.address);
        expect(args[1]).to.equal(hre.ethers.ZeroAddress);

        await expectDecrypt64(args[2], 200);
      });
    });
  });

  describe('.callBatchBurn', () => {
    describe('when specified identity is missing the SupplyModifier role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await expect(
          agentManager
            .connect(aliceWallet)
            .callBatchBurn([bobWallet.address, aliceWallet.address], [500, 1000], aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    describe('when specified identity has the SupplyModifier role but the sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addSupplyModifier(aliceIdentity);

        await expect(
          agentManager
            .connect(anotherWallet)
            .callBatchBurn([bobWallet.address, aliceWallet.address], [500, 100], aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    // Not supported in FHEVM
    // describe('when identity has the SupplyModifier role and the sender is authorized for it', () => {
    //   it('Should perform the batch burn', async () => {
    //     const {
    //       suite: { agentManager, token },
    //       accounts: { tokenAdmin, aliceWallet, bobWallet },
    //       identities: { aliceIdentity },
    //     } = await deployFullSuiteFixture();

    //     await agentManager.connect(tokenAdmin).addSupplyModifier(aliceIdentity);

    //     const burnTx = await agentManager
    //       .connect(aliceWallet)
    //       .callBatchBurn([bobWallet.address, aliceWallet.address], [500, 100], aliceIdentity);

    //     await expect(burnTx).to.emit(token, 'Transfer').withArgs(bobWallet.address, hre.ethers.ZeroAddress, 500);
    //     await expect(burnTx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, hre.ethers.ZeroAddress, 100);
    //   });
    // });
  });

  describe('.callFreezePartialTokens', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await expectRevert(
          callFreezeTxPromise(agentManager, aliceWallet, aliceIdentity, 100, aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');

        // await expect(
        //   agentManager.connect(aliceWallet).callFreezePartialTokens(aliceIdentity, 100, aliceIdentity),
        // ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, anotherWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addFreezer(aliceIdentity);

        await expectRevert(
          callFreezeTxPromise(agentManager, anotherWallet, aliceIdentity, 100, aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');

        // await expect(
        //   agentManager.connect(anotherWallet).callFreezePartialTokens(aliceIdentity, 100, aliceIdentity),
        // ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when identity has the Freezer role and the sender is authorized for it', () => {
      it('Should perform the freeze of partial tokens', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addFreezer(aliceIdentity);

        const txReceipt = await callFreeze(agentManager, aliceWallet, aliceWallet, 100, aliceIdentity);
        // 2. expect(freezeTx).to.emit(token, 'TokensFrozen').withArgs(aliceWallet.address, 100);
        const args = getLogEventArgs(txReceipt, 'TokensFrozen', undefined, token);
        expect(args[0]).to.equal(aliceWallet.address);

        await expectDecrypt64(args[1], 100);
      });
    });
  });

  describe('.callBatchFreezePartialTokens', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await expect(
          agentManager
            .connect(aliceWallet)
            .callBatchFreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addFreezer(aliceIdentity);

        await expect(
          agentManager
            .connect(anotherWallet)
            .callBatchFreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    // Not supported in FHEVM
    // describe('when identity has the Freezer role and the sender is authorized for it', () => {
    //   it('Should perform the batch freeze of partial tokens', async () => {
    //     const {
    //       suite: { agentManager, token },
    //       accounts: { tokenAdmin, aliceWallet, bobWallet },
    //       identities: { aliceIdentity },
    //     } = await deployFullSuiteFixture();

    //     await agentManager.connect(tokenAdmin).addFreezer(aliceIdentity);

    //     const freezeTx = await agentManager
    //       .connect(aliceWallet)
    //       .callBatchFreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], aliceIdentity);

    //     await expect(freezeTx).to.emit(token, 'TokensFrozen').withArgs(aliceWallet.address, 100);
    //     await expect(freezeTx).to.emit(token, 'TokensFrozen').withArgs(bobWallet.address, 200);
    //   });
    // });
  });

  describe('.callUnfreezePartialTokens', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await expectRevert(
          callUnfreezeTxPromise(agentManager, aliceWallet, aliceIdentity, 100, aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');

        // await expect(
        //   agentManager.connect(aliceWallet).callUnfreezePartialTokens(aliceIdentity, 100, aliceIdentity),
        // ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, anotherWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addFreezer(aliceIdentity);

        await expectRevert(
          callUnfreezeTxPromise(agentManager, anotherWallet, aliceIdentity, 100, aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');

        // await expect(
        //   agentManager.connect(anotherWallet).callUnfreezePartialTokens(aliceIdentity, 100, aliceIdentity),
        // ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when identity has the Freezer role and the sender is authorized for it', () => {
      it('Should perform the unfreeze of partial tokens', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addFreezer(aliceIdentity);

        await callFreeze(agentManager, aliceWallet, aliceWallet, 100, aliceIdentity);

        const txReceipt = await callUnfreeze(agentManager, aliceWallet, aliceWallet, 100, aliceIdentity);

        // 1. expect(freezeTx).to.emit(token, 'TokensUnfrozen').withArgs(aliceWallet.address, 100);
        const args = getLogEventArgs(txReceipt, 'TokensUnfrozen', undefined, token);
        expect(args[0]).to.equal(aliceWallet.address);

        await expectDecrypt64(args[1], 100);
      });
    });
  });

  describe('.callBatchUnfreezePartialTokens', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await expect(
          agentManager
            .connect(aliceWallet)
            .callBatchUnfreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addFreezer(aliceIdentity);

        await expect(
          agentManager
            .connect(anotherWallet)
            .callBatchUnfreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    // Not supported in FHEVM
    // describe('when identity has the Freezer role and the sender is authorized for it', () => {
    //   it('Should perform the batch unfreeze of partial tokens', async () => {
    //     const {
    //       suite: { agentManager, token },
    //       accounts: { tokenAdmin, aliceWallet, bobWallet },
    //       identities: { aliceIdentity },
    //     } = await deployFullSuiteFixture();

    //     await agentManager.connect(tokenAdmin).addFreezer(aliceIdentity);

    //     await agentManager.connect(aliceWallet).callFreezePartialTokens(aliceWallet.address, 100, aliceIdentity);
    //     await agentManager.connect(aliceWallet).callFreezePartialTokens(bobWallet.address, 200, aliceIdentity);

    //     const freezeTx = await agentManager
    //       .connect(aliceWallet)
    //       .callBatchUnfreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], aliceIdentity);

    //     await expect(freezeTx).to.emit(token, 'TokensUnfrozen').withArgs(aliceWallet.address, 100);
    //   });
    // });
  });

  describe('.callRecoveryAddress', () => {
    describe('when specified identity is missing the RecoveryAgent role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await deployFullSuiteFixture();

        await expect(
          agentManager
            .connect(aliceWallet)
            .callRecoveryAddress(bobWallet.address, anotherWallet.address, bobIdentity, aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Recovery Agent');
      });
    });

    describe('when specified identity has the RecoveryAgent role but sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet, anotherWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addRecoveryAgent(aliceIdentity);

        await expect(
          agentManager
            .connect(anotherWallet)
            .callRecoveryAddress(bobWallet.address, anotherWallet.address, bobIdentity, aliceIdentity),
        ).to.be.revertedWith('Role: Sender is NOT Recovery Agent');
      });
    });

    describe('when identity has the RecoveryAgent role and the sender is authorized for it', () => {
      it('Should perform the recovery of the address', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await deployFullSuiteFixture();

        await agentManager.connect(tokenAdmin).addRecoveryAgent(aliceIdentity);

        await bobIdentity
          .connect(bobWallet)
          .addKey(
            hre.ethers.keccak256(hre.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [anotherWallet.address])),
            1,
            1,
          );

        const recoveryTx = await agentManager
          .connect(aliceWallet)
          .callRecoveryAddress(bobWallet.address, anotherWallet.address, bobIdentity, aliceIdentity);

        await expect(recoveryTx)
          .to.emit(token, 'RecoverySuccess')
          .withArgs(bobWallet.address, anotherWallet.address, bobIdentity);
      });
    });
  });
});
