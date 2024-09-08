import { assert, expect } from 'chai';
import hre from 'hardhat';

import { TestAsyncDecrypt } from '../../../types';
import { HardhatFhevmInstances, Signers, createInstances, getSigners, initSigners } from '../../utils';

describe('TestAsyncDecrypt', function () {
  let signers: Signers;
  let relayerAddress: string;
  let contract: TestAsyncDecrypt;
  let contractAddress: string;
  let instances: HardhatFhevmInstances;

  before(async function () {
    await initSigners();
    signers = getSigners();
    relayerAddress = hre.fhevm.gatewayRelayerAddress();
  });

  beforeEach(async function () {
    const contractFactory = await hre.ethers.getContractFactory('TestAsyncDecrypt');
    contract = await contractFactory.connect(signers.alice).deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
    instances = await createInstances(signers);
  });

  it('test async decrypt bool', async function () {
    const balanceBeforeR = await hre.ethers.provider.getBalance(relayerAddress);
    const balanceBeforeU = await hre.ethers.provider.getBalance(signers.carol.address);
    const tx = await contract.connect(signers.carol).requestBool({ gasLimit: 5_000_000 });
    const fhevm_results = await hre.fhevm.waitForTransactionDecryptions(tx);

    // requestBool performs only one decryption
    assert(fhevm_results);
    expect(fhevm_results.results.length).to.equal(1);
    const result = fhevm_results.results[0].result;
    // make sure the decryption succeeded
    expect(result.success).to.equal(true);
    // make sure the decryption was performed by the GatewayContract.sol contract
    expect(result.address).to.equal(hre.fhevm.GatewayContractAddress());
    // make sure the decryption was requested by 'TestAsyncDecrypt'
    expect(fhevm_results.results[0].request.contractCaller).to.equal(contractAddress);

    const balanceAfterU = await hre.ethers.provider.getBalance(signers.carol.address);
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yBool();
    expect(y).to.equal(true);
    const balanceAfterR = await hre.ethers.provider.getBalance(relayerAddress);
    console.log('gas paid by relayer (fulfil tx) : ', balanceBeforeR - balanceAfterR);
    console.log('gas paid by user (request tx) : ', balanceBeforeU - balanceAfterU);
  });

  it('test async decrypt uint4', async function () {
    const balanceBefore = await hre.ethers.provider.getBalance(relayerAddress);
    const tx2 = await contract.connect(signers.carol).requestUint4({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint4();
    expect(y).to.equal(4);
    const balanceAfter = await hre.ethers.provider.getBalance(relayerAddress);
    console.log(balanceBefore - balanceAfter);
  });

  it('test async decrypt uint8', async function () {
    const tx2 = await contract.connect(signers.carol).requestUint8({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint8();
    expect(y).to.equal(42);
  });

  it('test async decrypt uint16', async function () {
    const tx2 = await contract.connect(signers.carol).requestUint16({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint16();
    expect(y).to.equal(16);
  });

  it('test async decrypt uint32', async function () {
    const tx2 = await contract.connect(signers.carol).requestUint32(5, 15, { gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint32();
    expect(y).to.equal(52); // 5+15+32
  });

  it('test async decrypt uint64', async function () {
    const tx2 = await contract.connect(signers.carol).requestUint64({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint64();
    expect(y).to.equal(18446744073709551600n);
  });

  it('test async decrypt address', async function () {
    const tx2 = await contract.connect(signers.carol).requestAddress({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yAddress();
    expect(y).to.equal('0x8ba1f109551bD432803012645Ac136ddd64DBA72');
  });

  it('test async decrypt several addresses', async function () {
    const tx2 = await contract.connect(signers.carol).requestSeveralAddresses({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yAddress();
    const y2 = await contract.yAddress2();
    expect(y).to.equal('0x8ba1f109551bD432803012645Ac136ddd64DBA72');
    expect(y2).to.equal('0xf48b8840387ba3809DAE990c930F3b4766A86ca3');
  });

  it('test async decrypt mixed', async function () {
    const contractFactory = await hre.ethers.getContractFactory('TestAsyncDecrypt');
    const contract2 = await contractFactory.connect(signers.alice).deploy();
    const tx2 = await contract2.connect(signers.carol).requestMixed(5, 15, { gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const yB = await contract2.yBool();
    expect(yB).to.equal(true);
    let y = await contract2.yUint4();
    expect(y).to.equal(4);
    y = await contract2.yUint8();
    expect(y).to.equal(42);
    y = await contract2.yUint16();
    expect(y).to.equal(16);
    const yAdd = await contract2.yAddress();
    expect(yAdd).to.equal('0x8ba1f109551bD432803012645Ac136ddd64DBA72');
    y = await contract2.yUint32();
    expect(y).to.equal(52); // 5+15+32
    y = await contract2.yUint64();
    expect(y).to.equal(18446744073709551600n);
  });

  it('test async decrypt uint64 non-trivial', async function () {
    const inputAlice = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
    inputAlice.add64(18446744073709550042n);
    const encryptedAmount = inputAlice.encrypt();
    const tx = await contract.requestUint64NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof, {
      gasLimit: 5_000_000,
    });
    await tx.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint64();
    expect(y).to.equal(18446744073709550042n);
  });

  it('test async decrypt ebytes256 non-trivial', async function () {
    const inputAlice = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
    inputAlice.addBytes256(18446744073709550022n);
    const encryptedAmount = inputAlice.encrypt();
    const tx = await contract.requestEbytes256NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof, {
      gasLimit: 5_000_000,
    });
    await tx.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yBytes256();
    expect(y).to.equal(hre.ethers.toBeHex(18446744073709550022n, 256));
  });

  it('test async decrypt ebytes256 non-trivial with snapsho2t [skip-on-coverage]', async function () {
    if (hre.network.name === 'hardhat') {
      const snapshotId: unknown = await hre.ethers.provider.send('evm_snapshot');
      const inputAlice = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
      inputAlice.addBytes256(18446744073709550022n);
      const encryptedAmount = inputAlice.encrypt();
      const tx = await contract.requestEbytes256NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof, {
        gasLimit: 5_000_000,
      });
      await tx.wait();
      await hre.fhevm.waitForAllDecryptions();
      const y = await contract.yBytes256();
      expect(y).to.equal(hre.ethers.toBeHex(18446744073709550022n, 256));

      await hre.ethers.provider.send('evm_revert', [snapshotId]);
      const inputAlice2 = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
      inputAlice2.addBytes256(424242n);
      const encryptedAmount2 = inputAlice2.encrypt();
      const tx2 = await contract.requestEbytes256NonTrivial(encryptedAmount2.handles[0], encryptedAmount2.inputProof, {
        gasLimit: 5_000_000,
      });
      await tx2.wait();
      await hre.fhevm.waitForAllDecryptions();
      const y2 = await contract.yBytes256();
      expect(y2).to.equal(hre.ethers.toBeHex(424242n, 256));
    }
  });

  it('test async decrypt mixed with ebytes256', async function () {
    const inputAlice = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
    inputAlice.addBytes256(18446744073709550032n);
    const encryptedAmount = inputAlice.encrypt();
    const tx = await contract.requestMixedBytes256(encryptedAmount.handles[0], encryptedAmount.inputProof, {
      gasLimit: 5_000_000,
    });
    await tx.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yBytes256();
    expect(y).to.equal(hre.ethers.toBeHex(18446744073709550032n, 256));
    const yb = await contract.yBool();
    expect(yb).to.equal(true);
    const yAdd = await contract.yAddress();
    expect(yAdd).to.equal('0x8ba1f109551bD432803012645Ac136ddd64DBA72');
  });
});
