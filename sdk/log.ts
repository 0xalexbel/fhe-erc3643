import { ethers as EthersT } from 'ethers';
import { getContractOwner } from './utils';
import { ChainConfig } from './ChainConfig';
import { TxOptions } from './types';

export type LogOptions = {
  indent: string;
};

export function logBox(msg: string) {
  const left = ' '.repeat(1);
  const inner = ' '.repeat(2);

  const prefix = 'fhe-erc3643:';
  const n = msg.length + inner.length * 2 + prefix.length + 1;
  msg = `\x1b[32m${prefix}\x1b[0m ${msg}`;

  const top = left + '╔' + '═'.repeat(n) + '╗\n';
  const middle = left + '║' + inner + msg + inner + '║\n';
  const bottom = left + '╚' + '═'.repeat(n) + '╝';

  const box = top + middle + bottom;

  console.log('');
  console.log(box);
  console.log('');
}

export function logTrace(msg: string, options?: LogOptions) {
  const indent = options ? options.indent : '';
  console.log(`${indent}\x1b[32m✔ hardhat-fhevm:\x1b[0m ${msg}`);
}

export function logDim(msg: string, options?: LogOptions) {
  const indent = options ? options.indent : '';
  console.log(`${indent}\x1b[2m${msg}\x1b[0m`);
}

export function logError(msg: string) {
  console.log(`\x1b[31m${msg}\x1b[0m`);
}

export function logOK(msg: string) {
  console.log(`\x1b[32m${msg}\x1b[0m`);
}

export function logStepOK(msg: string, options: TxOptions | undefined) {
  if (options?.mute !== true) {
    logOK(msg);
  } else {
    if (options.progress) {
      options.progress.logStep(msg);
    }
  }
}

export function logStepInfo(msg: string, options: TxOptions | undefined) {
  if (options?.mute !== true) {
    logInfo(msg);
  } else {
    if (options.progress) {
      options.progress.logStep(msg);
    }
  }
}

export function logStepMsg(msg: string, options: TxOptions | undefined) {
  if (options?.mute !== true) {
    logMsg(msg);
  } else {
    if (options.progress) {
      options.progress.logStep(msg);
    }
  }
}

export function logStepError(msg: string, options: TxOptions | undefined) {
  if (options?.mute !== true) {
    logError(msg);
  } else {
    if (options.progress) {
      options.progress.logStep(msg);
    }
  }
}

export function logInfo(msg: string) {
  console.log(`\x1b[33m${msg}\x1b[0m`);
}

export function logMsg(msg: string, options?: LogOptions) {
  const indent = options ? options.indent : '';
  console.log(`${indent}${msg}`);
}

export async function logDeployOK(name: string, contract: EthersT.AddressLike) {
  const addr = await EthersT.resolveAddress(contract);
  logOK(`${name} was successfully deployed at address ${addr}`);
}

export async function logContractOwner(name: string, contract: EthersT.BaseContract, chainConfig: ChainConfig) {
  if (!contract.runner) {
    return;
  }

  const ownerAddress = await getContractOwner(contract, contract.runner);
  if (!ownerAddress) {
    return;
  }
  const alias = chainConfig.getWalletNamesFromAddress(ownerAddress);
  if (alias.length > 0) {
    logMsg(`${name} owner is '${alias[0]}' (address: ${ownerAddress})`);
  } else {
    logMsg(`${name} owner is ${ownerAddress}`);
  }
}
