import { expect } from 'chai';
import hre from 'hardhat';

import { EncryptedERC20 } from '../../../types';
import { HardhatFhevmInstances, Signers, createInstances, getSigners, initSigners } from '../../utils';
import { deployEncryptedERC20Fixture } from './EncryptedERC20.fixture';

describe('EncryptedERC20', function () {
  let signers: Signers;
  let contractAddress: string;
  let erc20: EncryptedERC20;
  let instances: HardhatFhevmInstances;

  before(async function () {
    await initSigners();
    signers = getSigners();
  });

  beforeEach(async function () {
    erc20 = await deployEncryptedERC20Fixture();
    contractAddress = await erc20.getAddress();
    instances = await createInstances(signers);
  });

  it('should mint the contract', async function () {
    const transaction = await erc20.mint(1000);
    await transaction.wait();

    const balanceHandle = await erc20.balanceOf(signers.alice);
    const balance = await hre.fhevm.decrypt64(balanceHandle);
    expect(balance).to.equal(1000);

    const totalSupply = await erc20.totalSupply();
    expect(totalSupply).to.equal(1000);
  });

  it('should transfer tokens between two users', async function () {
    const transaction = await erc20.mint(10000);
    const t1 = await transaction.wait();
    expect(t1?.status).to.eq(1);

    const input = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
    input.add64(1337);
    const encryptedTransferAmount = input.encrypt();
    const tx = await erc20['transfer(address,bytes32,bytes)'](
      signers.bob.address,
      encryptedTransferAmount.handles[0],
      encryptedTransferAmount.inputProof,
    );
    const t2 = await tx.wait();
    expect(t2?.status).to.eq(1);

    // Decrypt Alice's balance
    const balanceHandleAlice = await erc20.balanceOf(signers.alice);
    const balanceAlice = await hre.fhevm.decrypt64(balanceHandleAlice);
    expect(balanceAlice).to.equal(10000 - 1337);

    // Decrypt Bob's balance
    const balanceHandleBob = await erc20.balanceOf(signers.bob);
    const balanceBob = await hre.fhevm.decrypt64(balanceHandleBob);
    expect(balanceBob).to.equal(1337);
  });

  it('reencrypt - should transfer tokens between two users', async function () {
    const transaction = await erc20.mint(10000);
    const t1 = await transaction.wait();
    expect(t1?.status).to.eq(1);

    const input = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
    input.add64(1337);
    const encryptedTransferAmount = input.encrypt();
    const tx = await erc20['transfer(address,bytes32,bytes)'](
      signers.bob.address,
      encryptedTransferAmount.handles[0],
      encryptedTransferAmount.inputProof,
    );
    const t2 = await tx.wait();
    expect(t2?.status).to.eq(1);

    // Decrypt Alice's balance
    const balanceHandleAlice = await erc20.balanceOf(signers.alice);
    const { publicKey, privateKey } = instances.alice.generateKeypair();
    const eip712 = instances.alice.createEIP712(publicKey, contractAddress);
    const signature = await signers.alice.signTypedData(
      eip712.domain,
      { Reencrypt: eip712.types.Reencrypt },
      eip712.message,
    );
    const balanceAlice = await instances.alice.reencrypt(
      balanceHandleAlice,
      privateKey,
      publicKey,
      signature.replace('0x', ''),
      contractAddress,
      signers.alice.address,
    );

    expect(balanceAlice).to.equal(10000 - 1337);
  });

  it('should not transfer tokens between two users', async function () {
    const transaction = await erc20.mint(1000);
    await transaction.wait();

    const input = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
    input.add64(1337);
    const encryptedTransferAmount = input.encrypt();
    const tx = await erc20['transfer(address,bytes32,bytes)'](
      signers.bob.address,
      encryptedTransferAmount.handles[0],
      encryptedTransferAmount.inputProof,
    );
    await tx.wait();

    // Decrypt Alice's balance
    const balanceHandleAlice = await erc20.balanceOf(signers.alice);
    const balanceAlice = await hre.fhevm.decrypt64(balanceHandleAlice);
    expect(balanceAlice).to.equal(1000);

    // Decrypt Bob's balance
    const balanceHandleBob = await erc20.balanceOf(signers.bob);
    const balanceBob = await hre.fhevm.decrypt64(balanceHandleBob);
    expect(balanceBob).to.equal(0);
  });

  it('HHHH should be able to transferFrom only if allowance is sufficient', async function () {
    const transaction = await erc20.mint(10000);
    await transaction.wait();

    const inputAlice = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
    inputAlice.add64(1337);
    const encryptedAllowanceAmount = inputAlice.encrypt();
    const tx = await erc20['approve(address,bytes32,bytes)'](
      signers.bob.address,
      encryptedAllowanceAmount.handles[0],
      encryptedAllowanceAmount.inputProof,
    );
    await tx.wait();

    const bobErc20 = erc20.connect(signers.bob);
    const inputBob1 = instances.bob.createEncryptedInput(contractAddress, signers.bob.address);
    inputBob1.add64(1338); // above allowance so next tx should actually not send any token
    const encryptedTransferAmount = inputBob1.encrypt();
    const tx2 = await bobErc20['transferFrom(address,address,bytes32,bytes)'](
      signers.alice.address,
      signers.bob.address,
      encryptedTransferAmount.handles[0],
      encryptedTransferAmount.inputProof,
    );
    await tx2.wait();

    // Decrypt Alice's balance
    const balanceHandleAlice = await erc20.balanceOf(signers.alice);
    const balanceAlice = await hre.fhevm.decrypt64(balanceHandleAlice);
    expect(balanceAlice).to.equal(10000); // check that transfer did not happen, as expected

    // Decrypt Bob's balance
    const balanceHandleBob = await erc20.balanceOf(signers.bob);
    const balanceBob = await hre.fhevm.decrypt64(balanceHandleBob);
    expect(balanceBob).to.equal(0); // check that transfer did not happen, as expected

    const inputBob2 = instances.bob.createEncryptedInput(contractAddress, signers.bob.address);
    inputBob2.add64(1337); // below allowance so next tx should send token
    const encryptedTransferAmount2 = inputBob2.encrypt();
    const tx3 = await bobErc20['transferFrom(address,address,bytes32,bytes)'](
      signers.alice.address,
      signers.bob.address,
      encryptedTransferAmount2.handles[0],
      encryptedTransferAmount2.inputProof,
    );
    await tx3.wait();

    // Decrypt Alice's balance
    const balanceHandleAlice2 = await erc20.balanceOf(signers.alice);
    const balanceAlice2 = await hre.fhevm.decrypt64(balanceHandleAlice2);
    expect(balanceAlice2).to.equal(10000 - 1337); // check that transfer did happen this time

    // Decrypt Bob's balance
    const balanceHandleBob2 = await erc20.balanceOf(signers.bob);
    const balanceBob2 = await hre.fhevm.decrypt64(balanceHandleBob2);
    expect(balanceBob2).to.equal(1337); // check that transfer did happen this time
  });
});
