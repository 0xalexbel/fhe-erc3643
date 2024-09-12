import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ChainConfig } from '../sdk/ChainConfig';
import path from 'path';
import { TASK_FHEVM_SETUP } from 'hardhat-fhevm/dist/src/task-names';
import { LogOptions } from '../sdk/log';
import fs from 'fs';

/**
 * Start the fhevm local node if needed and deploy all FHEVM contracts
 */
async function setupFhevmEnvironment(hre: HardhatRuntimeEnvironment, logOptions: LogOptions) {
  // if (!HardhatFhevmRuntimeEnvironment.isUserRequested(hre)) {
  //   return;
  // }

  //if (!(await isDeployed(hre.ethers.provider, hre.fhevm.ACLAddress()))) {
  //   if (hre.fhevm.runtimeType() === FhevmRuntimeEnvironmentType.Mock) {
  //     await hre.run('fhevm:start:mock');
  //   } else {
  //     await hre.run('fhevm:start');
  //   }
  //}

  // try {
  //   // Should support mupliple calls.
  //   // Initialize fhevm runtime
  //   await hre.fhevm.init();
  // } catch (e) {}

  // // Add a separator
  // //console.log('');
  await hre.run(TASK_FHEVM_SETUP, { quiet: !!logOptions.quiet, stderr: !!logOptions.stderr });
}

export function getHistoryPath(hre: HardhatRuntimeEnvironment) {
  if (hre.network.name === 'hardhat') {
    return path.normalize(path.join(__dirname, '../.fhe-erc3643.hh.history.json'));
  }
  if (hre.network.name === 'fhevm') {
    return path.normalize(path.join(__dirname, '../.fhe-erc3643.fhevm.history.json'));
  }
  return undefined;
}

export function clearHistory(hre: HardhatRuntimeEnvironment) {
  const p = getHistoryPath(hre);
  if (!p) {
    return;
  }
  if (fs.existsSync(p)) {
    fs.rmSync(p);
  }
}

export async function loadChainConfig(hre: HardhatRuntimeEnvironment, quietFhevm?: boolean) {
  const networkName = hre.network.name;
  const historyPath: string | undefined = getHistoryPath(hre);

  await setupFhevmEnvironment(hre, { quiet: quietFhevm === true, stderr: true });

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
      // cryptEngine: {
      //   decrypt64: hre.fhevm.decrypt64.bind(hre.fhevm),
      //   encrypt64: async (contract: EthersT.AddressLike, user: EthersT.AddressLike, value: number | bigint) => {
      //     const instance = await hre.fhevm.createInstance();
      //     const contractAddr = await hre.ethers.resolveAddress(contract);
      //     const userAddr = await hre.ethers.resolveAddress(user);
      //     const input = instance.createEncryptedInput(contractAddr, userAddr);
      //     input.add64(value);
      //     return input.encrypt();
      //   },
      // },
      hardhatProvider: hre.network.name === 'hardhat' ? hre.ethers.provider : undefined,
    },
    historyPath,
    hre.fhevm,
  );

  return chainConfig;
}
