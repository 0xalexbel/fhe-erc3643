import { ContractRunner, ethers as EthersT } from 'ethers';
import { TxOptions } from './types';
import { ChainConfig } from './ChainConfig';
import { AgentRole__factory } from '../types';

export async function txWait(
  promise: Promise<EthersT.ContractTransactionResponse>,
  options?: TxOptions,
): Promise<EthersT.ContractTransactionReceipt | null> {
  const tx = await promise;
  const confirms = options?.confirms;

  if (confirms) {
    return await tx.wait(confirms);
  } else {
    return await tx.wait(1);
  }
}

export class Progress {
  public step: number;
  public stepCount: number;
  public columnWidth: number;

  constructor(n: number) {
    this.stepCount = n;
    this.step = 1;
    this.columnWidth = 40;
  }

  contractDeployed(contractName: string, address: string) {
    const str = `${contractName}:`.padEnd(this.columnWidth);
    this.logStep(`${str}${address}`);
  }

  logStep(msg: string) {
    console.log(`\x1b[33m${this.step}/\x1b[0m\x1b[32m${this.stepCount}\x1b[0m \x1b[2m${msg}\x1b[0m`);
    this.step += 1;
  }
}

export async function isDeployed(provider: EthersT.Provider, address: string | undefined): Promise<string | undefined> {
  if (!address) {
    return undefined;
  }
  if ((await provider.getCode(address)) !== '0x') {
    return address;
  }
  return undefined;
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
