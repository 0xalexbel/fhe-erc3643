import { ethers as EthersT, N } from 'ethers';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import { ChainConfig } from '../sdk/ChainConfig';
import fs from 'fs';
import path from 'path';
import { AgentRole__factory } from '../types';

export function loadWalletArgs(
  chainConfig: ChainConfig,
  walletIndex: number | undefined,
  privateKey: string | undefined,
) {
  if (walletIndex !== undefined) {
    return chainConfig.getWalletAt(walletIndex, chainConfig.provider);
  }

  if (privateKey !== undefined) {
    return chainConfig.walletFromPrivateKey(privateKey);
  }

  throw new Error('Missing wallet arguments. Expecting private key or wallet index');
}

export function loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig: ChainConfig, wallet: number | string) {
  if (typeof wallet === 'number') {
    return chainConfig.getWalletAt(wallet, chainConfig.provider);
  }

  if (!EthersT.isHexString(wallet)) {
    const index = Number.parseInt(wallet, 10);
    if (Number.isNaN(index)) {
      return chainConfig.getWalletFromName(wallet, chainConfig.provider);
    }
    return chainConfig.getWalletAt(index, chainConfig.provider);
  }

  if (EthersT.isAddress(wallet)) {
    return chainConfig.getWalletFromAddress(EthersT.getAddress(wallet), chainConfig.provider);
  }
  try {
    return chainConfig.walletFromPrivateKey(wallet);
  } catch (e) {
    throw new Error('Missing wallet arguments. Expecting private key or wallet index or wallet address');
  }
}

export function loadAddressFromWalletIndexOrAliasOrAddress(chainConfig: ChainConfig, wallet: string) {
  try {
    return EthersT.getAddress(wallet);
  } catch (e) {
    const index = Number.parseInt(wallet, 10);
    if (Number.isNaN(index)) {
      return chainConfig.getWalletFromName(wallet, chainConfig.provider).address;
    }
    return chainConfig.getWalletAt(index, chainConfig.provider).address;
  }
}

export function loadKeyAddress(chainConfig: ChainConfig, taskArgs: TaskArguments) {
  if (taskArgs.key !== undefined) {
    if (EthersT.isAddress(taskArgs.key)) {
      return taskArgs.key;
    }
    let index: number;
    if (typeof taskArgs.key === 'number') {
      index = taskArgs.key;
    } else {
      index = Number.parseInt(taskArgs.key, 10);
    }
    return chainConfig.getWalletAt(index, chainConfig.provider).address;
  } else if (taskArgs.keyWalletIndex !== undefined) {
    return chainConfig.getWalletAt(taskArgs.keyWalletIndex, chainConfig.provider).address;
  }

  throw new Error('Missing key arguments. Expecting key address or wallet index');
}

export function getHistoryPath() {
  return path.normalize(path.join(__dirname, '../.fhe-erc3643.history.json'));
}

export async function loadChainConfig(hre: HardhatRuntimeEnvironment, historyPath: string) {
  const networkName = hre.network.name;
  if (networkName === 'hardhat') {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  const mnemonic = (hre.config.networks[networkName].accounts as any).mnemonic;
  const walletPath = (hre.config.networks[networkName].accounts as any).path;
  const url = (hre.config.networks[networkName] as any).url;
  const chainId = (hre.config.networks[networkName] as any).chainId;

  const chainConfig = await ChainConfig.load(
    {
      url,
      chainId,
      name: networkName,
      accounts: { path: walletPath, mnemonic },
    },
    historyPath,
  );

  return chainConfig;
}

export function logError(msg: string) {
  console.log(`\x1b[31m${msg}\x1b[0m`);
}

export function logOK(msg: string) {
  console.log(`\x1b[32m${msg}\x1b[0m`);
}

export function logInfo(msg: string) {
  console.log(`\x1b[33m${msg}\x1b[0m`);
}

export function throwIfInvalidAddress(address: string, hre: HardhatRuntimeEnvironment) {
  if (!hre.ethers.isAddress(address)) {
    throw new Error(`Invalid identity address: ${address}`);
  }
}
