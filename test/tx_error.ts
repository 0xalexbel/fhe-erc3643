import assert from 'assert';
import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider';
import { expect } from 'chai';
import { AbstractProvider, ContractTransactionResponse } from 'ethers';
import hre from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const RPC_ERROR_MESSAGE_PREFIX = 'rpc error: code = Unknown desc = execution reverted: ';

class TxRevertError extends Error {
  public data: string;
  constructor(errorMessage: string) {
    super();
    this.data = toErrorData(errorMessage);
  }
}

function toErrorData(errorMsg: string) {
  const abi = new hre.ethers.AbiCoder();
  let msg = errorMsg;
  if (msg.startsWith(RPC_ERROR_MESSAGE_PREFIX)) {
    msg = msg.substring(RPC_ERROR_MESSAGE_PREFIX.length);
  }
  return '0x08c379a0' + abi.encode(['string'], [msg]).substring(2);
}

export function expectRevert(
  txPromise: Promise<
    | ContractTransactionResponse
    | {
        deploymentTransaction(): ContractTransactionResponse;
      }
  >,
): Chai.Assertion {
  if (hre.network.name === 'hardhat') {
    return expect(txPromise);
  } else {
    return expect(_interceptTxError(txPromise));
  }
}

const _interceptTxError = async (
  txPromise: Promise<
    | ContractTransactionResponse
    | {
        deploymentTransaction(): ContractTransactionResponse;
      }
  >,
) => {
  let tx;
  try {
    tx = await txPromise;
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.startsWith(RPC_ERROR_MESSAGE_PREFIX)) {
        throw new TxRevertError(err.message);
      }
    }
    throw err;
  }
  if ('deploymentTransaction' in tx) {
    tx = tx.deploymentTransaction();
  }
  try {
    await tx.wait();
  } catch {}
  const error = await _getTxError(tx.hash, hre);
  throw error;
};

async function _getTxError(txHash: string | null | undefined, hre: HardhatRuntimeEnvironment): Promise<Error | null> {
  if (!txHash) {
    return null;
  }

  let provider: HardhatEthersProvider | AbstractProvider;
  if (hre.network.name === 'hardhat') {
    provider = hre.ethers.provider;
  } else if (hre.network.name === 'fhevm') {
    const jsonRpcProvider = new hre.ethers.JsonRpcProvider(hre.config.networks.fhevm.url, {
      chainId: hre.config.networks.fhevm.chainId,
      name: hre.network.name,
    });
    provider = jsonRpcProvider;
  } else {
    provider = hre.ethers.provider;
  }

  const tx = await provider.getTransaction(txHash);
  try {
    await provider.call({
      ...tx,
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined,
    });
    return null;
  } catch (error) {
    assert(error instanceof Error);
    assert('data' in error);
    assert(typeof error.data === 'string');
    return error;
  }
}
