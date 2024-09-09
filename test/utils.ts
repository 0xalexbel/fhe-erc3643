import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import assert from 'assert';
import hre, { fhevm } from 'hardhat';
import { ethers as EthersT } from 'ethers';
import { HardhatFhevmInstance } from 'hardhat-fhevm';
import { Token } from '../types';
import { expect } from 'chai';

export interface Signers {
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
  dave: HardhatEthersSigner;
  eve: HardhatEthersSigner;
}

let signers: Signers | undefined;

export interface HardhatFhevmInstances {
  alice: HardhatFhevmInstance;
  bob: HardhatFhevmInstance;
  carol: HardhatFhevmInstance;
  dave: HardhatFhevmInstance;
  eve: HardhatFhevmInstance;
}

export const initSigners = async (): Promise<Signers> => {
  if (!signers) {
    const eSigners = await hre.ethers.getSigners();
    signers = {
      alice: eSigners[0],
      bob: eSigners[1],
      carol: eSigners[2],
      dave: eSigners[3],
      eve: eSigners[4],
    };
  }
  return signers;
};

export const getSigners = (): Signers => {
  assert(signers !== undefined);
  return signers;
};

export const createInstances = async (accounts: Signers): Promise<HardhatFhevmInstances> => {
  const instances: HardhatFhevmInstances = {} as HardhatFhevmInstances;
  await Promise.all(
    Object.keys(accounts).map(async k => {
      instances[k as keyof HardhatFhevmInstances] = await hre.fhevm.createInstance();
    }),
  );
  return instances;
};

export async function encrypt64(contract: EthersT.AddressLike, user: EthersT.AddressLike, value: number | bigint) {
  const instance = await hre.fhevm.createInstance();
  const contractAddr = await hre.ethers.resolveAddress(contract);
  const userAddr = await hre.ethers.resolveAddress(user);
  const input = instance.createEncryptedInput(contractAddr, userAddr);
  input.add64(value);
  return input.encrypt();
}

export async function encrypt64Array(
  contract: EthersT.AddressLike,
  user: EthersT.AddressLike,
  value: Array<number | bigint>,
) {
  const instance = await hre.fhevm.createInstance();
  const contractAddr = await hre.ethers.resolveAddress(contract);
  const userAddr = await hre.ethers.resolveAddress(user);
  const input = instance.createEncryptedInput(contractAddr, userAddr);
  value.forEach(v => input.add64(v));
  return input.encrypt();
}

/* eslint-disable no-unexpected-multiline */
export async function tokenTransferTxPromise(
  token: Token,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const signerEncAmount = await encrypt64(token, signer, amount);
  return token
    .connect(signer)
    ['transfer(address,bytes32,bytes)'](to, signerEncAmount.handles[0], signerEncAmount.inputProof);
}

export async function tokenTransfer(
  token: Token,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const tx = await tokenTransferTxPromise(token, signer, to, amount);
  return await tx.wait(1);
}

export async function expectTokenTransferToSucceed(
  token: Token,
  from: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const fromBalance = await tokenBalanceOf(token, from);
  const toBalance = await tokenBalanceOf(token, to);
  await expectTokenTransferToEq(token, from, to, amount, amount);
  await expectTokenBalanceToEq(token, from, fromBalance - BigInt(amount));
  await expectTokenBalanceToEq(token, to, toBalance + BigInt(amount));
}

export async function expectTokenTransferToFail(
  token: Token,
  from: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const fromBalance = await tokenBalanceOf(token, from);
  expect(fromBalance).to.greaterThan(0);
  const toBalance = await tokenBalanceOf(token, to);
  await expectTokenTransferToEq(token, from, to, amount, 0);
  await expectTokenBalanceToEq(token, from, fromBalance);
  await expectTokenBalanceToEq(token, to, toBalance);
}

export async function expectTokenMintToSucceed(
  token: Token,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const toBalance = await tokenBalanceOf(token, to);

  await expectTokenMintToEq(token, signer, to, amount, amount);
  await expectTokenBalanceToEq(token, to, toBalance + BigInt(amount));
}

export async function expectTokenBurnToSucceed(
  token: Token,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const toBalance = await tokenBalanceOf(token, to);
  expect(amount).to.be.greaterThanOrEqual(0);
  await expectTokenBurnToEq(token, signer, to, amount, amount);
  await expectTokenBalanceToEq(token, to, toBalance - BigInt(amount));
}

export async function expectTokenTransferToEq(
  token: Token,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
  expectedAmount: number | bigint,
) {
  expect(amount).to.be.greaterThanOrEqual(0);
  expect(expectedAmount).to.be.greaterThanOrEqual(0);
  const fromAddress = await signer.getAddress();
  const toAddress = await EthersT.resolveAddress(to);
  const txReceipt = await tokenTransfer(token, signer, to, amount);
  const args = getLogEventArgs(txReceipt, 'Transfer', undefined);
  expect(args[0]).to.equal(fromAddress);
  expect(args[1]).to.equal(toAddress);
  if (args.length >= 3) {
    const amount = await fhevm.decrypt64(args[2]);
    expect(amount).to.equal(expectedAmount);
  }
}

export async function expectTokenMintToEq(
  token: Token,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
  expectedAmount: number | bigint,
) {
  expect(amount).to.be.greaterThanOrEqual(0);
  expect(expectedAmount).to.be.greaterThanOrEqual(0);
  const toAddress = await EthersT.resolveAddress(to);
  const txReceipt = await tokenMint(token, signer, to, amount);
  const args = getLogEventArgs(txReceipt, 'Transfer', undefined);
  expect(args[0]).to.equal(EthersT.ZeroAddress);
  expect(args[1]).to.equal(toAddress);
  if (args.length >= 3) {
    const amount = await fhevm.decrypt64(args[2]);
    expect(amount).to.equal(expectedAmount);
  }
}

export async function expectTokenBurnToEq(
  token: Token,
  signer: EthersT.Signer,
  from: EthersT.AddressLike,
  amount: number | bigint,
  expectedAmount: number | bigint,
) {
  expect(amount).to.be.greaterThanOrEqual(0);
  expect(expectedAmount).to.be.greaterThanOrEqual(0);
  const fromAddress = await EthersT.resolveAddress(from);
  const txReceipt = await tokenBurn(token, signer, from, amount);
  const args = getLogEventArgs(txReceipt, 'Transfer', undefined);
  expect(args[0]).to.equal(fromAddress);
  expect(args[1]).to.equal(EthersT.ZeroAddress);
  if (args.length >= 3) {
    const amount = await fhevm.decrypt64(args[2]);
    expect(amount).to.equal(expectedAmount);
  }
}

export async function expectTokenBalanceToEq(token: Token, user: EthersT.AddressLike, expectedAmount: number | bigint) {
  const amount = await tokenBalanceOf(token, user);
  expect(expectedAmount).to.equal(amount);
}

/* eslint-disable no-unexpected-multiline */
export async function tokenMintTxPromise(
  token: Token,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const signerEncAmount = await encrypt64(token, signer, amount);
  return token
    .connect(signer)
    ['mint(address,bytes32,bytes)'](to, signerEncAmount.handles[0], signerEncAmount.inputProof);
}

/* eslint-disable no-unexpected-multiline */
export async function tokenBatchMintTxPromise(
  token: Token,
  signer: EthersT.Signer,
  tos: Array<EthersT.AddressLike>,
  amounts: Array<number | bigint>,
) {
  const signerEncAmount = await encrypt64Array(token, signer, amounts);
  return token
    .connect(signer)
    ['batchMint(address[],bytes32[],bytes)'](tos, signerEncAmount.handles, signerEncAmount.inputProof);
}

export async function tokenMint(
  token: Token,
  signer: EthersT.Signer,
  to: EthersT.AddressLike,
  amount: number | bigint,
) {
  const tx = await tokenMintTxPromise(token, signer, to, amount);
  return await tx.wait(1);
}

export async function tokenBatchMint(
  token: Token,
  signer: EthersT.Signer,
  tos: Array<EthersT.AddressLike>,
  amounts: Array<number | bigint>,
) {
  const tx = await tokenBatchMintTxPromise(token, signer, tos, amounts);
  return await tx.wait(1);
}

export async function tokenFreeze(
  token: Token,
  signer: EthersT.Signer,
  user: EthersT.AddressLike,
  amount: number | bigint,
) {
  const signerEncAmount = await encrypt64(token, signer, amount);
  const tx = await token
    .connect(signer)
    ['freezePartialTokens(address,bytes32,bytes)'](user, signerEncAmount.handles[0], signerEncAmount.inputProof);
  return await tx.wait(1);
}

/* eslint-disable no-unexpected-multiline */
export async function tokenUnfreeze(
  token: Token,
  signer: EthersT.Signer,
  user: EthersT.AddressLike,
  amount: number | bigint,
) {
  const signerEncAmount = await encrypt64(token, signer, amount);
  const tx = await token
    .connect(signer)
    ['unfreezePartialTokens(address,bytes32,bytes)'](user, signerEncAmount.handles[0], signerEncAmount.inputProof);
  return await tx.wait(1);
}

export async function tokenBalanceOf(token: Token, user: EthersT.AddressLike) {
  const encBalance = await token.balanceOf(user);
  if (encBalance === 0n) {
    return 0n;
  }
  const b = await hre.fhevm.decrypt64(encBalance);
  return b;
}

export async function tokenTotalSupply(token: Token) {
  const enc = await token.totalSupply();
  return await hre.fhevm.decrypt64(enc);
}

/* eslint-disable no-unexpected-multiline */
export async function tokenBurn(
  token: Token,
  signer: EthersT.Signer,
  user: EthersT.AddressLike,
  amount: number | bigint,
) {
  const signerEncAmount = await encrypt64(token, signer, amount);

  const tx = await token
    .connect(signer)
    ['burn(address,bytes32,bytes)'](user, signerEncAmount.handles[0], signerEncAmount.inputProof);
  return await tx.wait(1);
}

export function getLogEventArgs(
  txReceipt: EthersT.ContractTransactionReceipt | null,
  eventName: string,
  count: number | undefined,
  contract?: EthersT.BaseContract,
) {
  expect(txReceipt).not.to.be.null;
  assert(txReceipt);
  if (contract) {
    txReceipt = new EthersT.ContractTransactionReceipt(contract.interface, txReceipt.provider, txReceipt);
  }
  const log = txReceipt.logs.find(log => 'eventName' in log && log.eventName === eventName);
  assert(log, `No event named '${eventName}'`);
  assert('args' in log);
  assert(count === undefined || log.args.length === count);
  return log.args;
}

// args are expected to be like this : [x1, x2, x3, ..., xn, someEncryptedUint64]
export async function expectArrayFinishingWithEncUint64(allArgs: EthersT.Result[], [...values]) {
  for (let i = 0; allArgs.length; ++i) {
    const a = allArgs[i];
    let found = true;
    for (let j = 0; j < values.length; ++j) {
      let v = values[j];
      if (j === values.length) {
        v = await fhevm.decrypt64(v);
      }
      if (a[j] !== v) {
        found = false;
        break;
      }
    }
    if (found) {
      return true;
    }
  }
  return false;
}

export function getAllLogEventArgs(
  txReceipt: EthersT.ContractTransactionReceipt | null,
  eventName: string,
  contract?: EthersT.BaseContract,
) {
  expect(txReceipt).not.to.be.null;
  assert(txReceipt);
  if (contract) {
    txReceipt = new EthersT.ContractTransactionReceipt(contract.interface, txReceipt.provider, txReceipt);
  }

  const allArgs: EthersT.Result[] = [];
  txReceipt.logs.forEach(log => {
    if ('eventName' in log && log.eventName === eventName) {
      allArgs.push(log.args);
    }
  });

  return allArgs;
}

export async function expectDecrypt64(handle: bigint, value: number | bigint) {
  const amount = await hre.fhevm.decrypt64(handle);
  expect(amount).to.equal(value);
}

export async function waitNBlocks(nBlocks: number) {
  if (nBlocks <= 0) {
    return;
  }

  let blockCount = 0;
  return new Promise((resolve, reject) => {
    const onBlock = async (newBlockNumber: number) => {
      blockCount++;
      if (blockCount >= nBlocks) {
        await hre.ethers.provider.off('block', onBlock);
        resolve(newBlockNumber);
      }
    };
    hre.ethers.provider.on('block', onBlock).catch(err => {
      reject(err);
    });
    if (hre.network.name === 'hardhat') {
      sendNDummyTransactions(nBlocks);
    }
  });
}

async function sendNDummyTransactions(blockCount: number) {
  let counter = blockCount;
  while (counter >= 0) {
    counter--;
    const [signer] = await hre.ethers.getSigners();
    const nullAddress = '0x0000000000000000000000000000000000000000';
    const tx = {
      to: nullAddress,
      value: 0n,
    };
    const receipt = await signer.sendTransaction(tx);
    await receipt.wait();
  }
}
