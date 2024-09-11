import { ethers as EthersT } from 'ethers';
import { TxOptions } from './types';
import { Progress } from './log';

export async function txWait(
  promise: Promise<EthersT.ContractTransactionResponse>,
  options: TxOptions,
): Promise<EthersT.ContractTransactionReceipt | null> {
  const tx = await promise;
  const confirms = options.confirms;

  if (confirms) {
    return await tx.wait(confirms);
  } else {
    return await tx.wait(1);
  }
}

export async function txWaitAndCatchError(
  promise: Promise<EthersT.ContractTransactionResponse>,
  options?: TxOptions,
): Promise<EthersT.ContractTransactionReceipt | null> {
  const tx = await promise;
  const confirms = options?.confirms;

  let _confirms = confirms ? confirms : 1;
  try {
    return await tx.wait(_confirms);
  } catch (e) {
    if (e instanceof Error) {
      const txHash = (e as any)?.receipt?.hash;
      const _e = await getTxError(txHash, tx.provider);
      throw _e;
    } else {
      throw e;
    }
  }
}

export async function getTxError(txHash: string, provider: EthersT.Provider) {
  const tx = await provider.getTransaction(txHash);
  try {
    await provider.call({
      ...tx,
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined,
    });
    return null;
  } catch (error) {
    // get revert error
    if (
      error instanceof Error &&
      'revert' in error &&
      typeof error.revert === 'object' &&
      error.revert &&
      'args' in error.revert &&
      Array.isArray(error.revert.args) &&
      error.revert.args.length > 0
    ) {
      return new Error(error.revert.args[0]);
    }
    return error;
  }
}

export async function isDeployed(provider: EthersT.Provider, address: string | undefined): Promise<string | undefined> {
  if (!address) {
    return undefined;
  }
  try {
    if ((await provider.getCode(address)) !== '0x') {
      return address;
    }
    return undefined;
  } catch {
    // no network connection ?
    return undefined;
  }
}

export async function getContractOwner(contract: string | EthersT.Addressable, runner: EthersT.ContractRunner) {
  const abi = [
    {
      inputs: [],
      name: 'owner',
      outputs: [
        {
          internalType: 'address',
          name: '',
          type: 'address',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ];

  const c = new EthersT.Contract(contract, abi, runner);
  try {
    return (await c.owner()) as string;
  } catch {
    return undefined;
  }
}
