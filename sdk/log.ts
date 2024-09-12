import { ethers as EthersT } from 'ethers';
import { getContractOwner, jsonStringify } from './utils';
import { ChainConfig } from './ChainConfig';
import { TxOptions } from './types';

export type LogOptions = {
  indent?: string;
  stderr?: boolean;
  quiet?: boolean;
};

export type LogResultOptions = {
  indent?: string;
  stderr?: boolean;
};

export function logBox(msg: string, options?: LogOptions) {
  const left = ' '.repeat(1);
  const inner = ' '.repeat(2);

  const prefix = 'fhe-erc3643:';
  const n = msg.length + inner.length * 2 + prefix.length + 1;
  msg = `\x1b[32m${prefix}\x1b[0m ${msg}`;

  const top = left + '╔' + '═'.repeat(n) + '╗\n';
  const middle = left + '║' + inner + msg + inner + '║\n';
  const bottom = left + '╚' + '═'.repeat(n) + '╝';

  const box = top + middle + bottom;

  _log('', options);
  _log(box, options);
  _log('', options);
}

function _log(msg: string, options?: LogOptions) {
  if (options?.quiet === true) {
    return;
  }
  const indent = options?.indent ? options.indent : '';
  if (options?.stderr) {
    console.error(indent + msg);
  } else {
    console.log(indent + msg);
  }
}

function _logResult(msg: string, options?: LogOptions) {
  const indent = options?.indent ? options.indent : '';

  if (options?.stderr) {
    process.stderr.write(indent + msg + '\n');
  } else {
    process.stdout.write(indent + msg + '\n');
  }
}

export function logDimErrorWithPrefix(prefix: string, msg: string, options?: LogOptions) {
  _log(`\x1b[31m${prefix}\x1b[0m\x1b[31m${msg}\x1b[0m`, options);
}

export function logDimWithGreenPrefix(prefix: string, msg: string, options?: LogOptions) {
  _log(`\x1b[32m${prefix}\x1b[0m\x1b[2m${msg}\x1b[0m`, options);
}

export function logDim(msg: string, options?: LogOptions) {
  _log(`\x1b[2m${msg}\x1b[0m`, options);
}

export function logMsg(msg: string, options?: LogOptions) {
  _log(msg, options);
}

export function logError(msg: string, options?: LogOptions) {
  _log(`\x1b[31m${msg}\x1b[0m`, options);
}

export function logOK(msg: string, options?: LogOptions) {
  _log(`\x1b[32m${msg}\x1b[0m`, options);
}

export function logJSONResult(o: any, options?: LogResultOptions) {
  _logResult(jsonStringify(o), options);
}

export function logMsgResult(msg: string, options?: LogResultOptions) {
  _logResult(msg, options);
}

export function logInfo(msg: string, options?: LogOptions) {
  _log(`\x1b[33m${msg}\x1b[0m`, options);
}

export function logStepOK(msg: string, options: TxOptions | undefined) {
  if (options?.progress && options.noProgress !== true) {
    options.progress.logStep(msg);
  }
}

export function logStepInfo(msg: string, options: TxOptions | undefined) {
  if (options?.progress && options.noProgress !== true) {
    options.progress.logStep(msg);
  }
}

export function logStepMsg(msg: string, options: TxOptions | undefined) {
  if (options?.progress && options.noProgress !== true) {
    options.progress.logStep(msg);
  }
}

export function logStepError(msg: string, options: TxOptions | undefined) {
  if (options?.progress && options.noProgress !== true) {
    options.progress.logStepError(msg);
  }
}

export async function logStepDeployOK(name: string, contract: EthersT.AddressLike, options: TxOptions | undefined) {
  const addr = await EthersT.resolveAddress(contract);
  logStepOK(`${name} was successfully deployed at address ${addr}`, options);
}

export async function logContractOwner(
  name: string,
  contract: EthersT.BaseContract,
  chainConfig: ChainConfig,
  options: TxOptions | undefined,
) {
  if (options?.noProgress === true) {
    return;
  }
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

export class Progress {
  public step: number;
  public stepCount: number;
  public columnWidth: number;
  public ignore: boolean;
  public percentage: boolean;
  public tostderr: boolean;

  constructor(n: number) {
    this.stepCount = n;
    this.step = 1;
    this.columnWidth = 40;
    this.ignore = false;
    this.percentage = true;
    this.tostderr = true;
  }

  pause() {
    this.ignore = true;
  }
  unpause() {
    this.ignore = false;
  }

  logStepDeployed(contractName: string, address: string, options?: LogOptions) {
    const str = `${contractName}:`.padEnd(this.columnWidth);
    this.logStep(`${str}${address}`, options);
  }

  log(msg: string, error: boolean, options?: LogOptions) {
    if (!this.ignore) {
      if (options) {
        options.stderr = this.tostderr;
      } else {
        options = { stderr: this.tostderr };
      }
      if (this.percentage) {
        const perc = `${Math.ceil((100 * this.step) / this.stepCount)}`.padStart(3, ' ') + '%';
        if (error) {
          logDimErrorWithPrefix(`${perc} `, msg, options);
        } else {
          logDimWithGreenPrefix(`${perc} `, msg, options);
        }
      } else {
        if (error) {
          logDimErrorWithPrefix(`${this.step}/${this.stepCount}`, msg, options);
        } else {
          logDimWithGreenPrefix(`${this.step}/${this.stepCount}`, msg, options);
        }
      }
    }
  }

  logStep(msg: string, options?: LogOptions) {
    if (!this.ignore) {
      this.log(msg, false, options);
      this.step += 1;
    }
  }

  logStepError(msg: string, options?: LogOptions) {
    if (!this.ignore) {
      this.log(msg, true, options);
      this.step += 1;
    }
  }
}

export function defaultTxOptions(steps: number): TxOptions {
  return {
    progress: new Progress(steps),
    confirms: 1,
    noProgress: false,
  };
}
