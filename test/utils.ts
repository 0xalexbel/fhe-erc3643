import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import assert from 'assert';
import hre from 'hardhat';
import { ethers } from 'hardhat';
import { HardhatFhevmInstance } from 'hardhat-fhevm';

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
    const eSigners = await ethers.getSigners();
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
