import { ethers as EthersT } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ChainConfig } from '../sdk/ChainConfig';
import path from 'path';
import { isDeployed } from '../sdk/utils';
import {
  FhevmRuntimeEnvironmentType,
  HardhatFhevmRuntimeEnvironment,
} from 'hardhat-fhevm/dist/src/common/HardhatFhevmRuntimeEnvironment';

/**
 * Start the fhevm local node if needed and deploy all FHEVM contracts
 */
async function setupFhevmEnvironment(hre: HardhatRuntimeEnvironment) {
  if (!HardhatFhevmRuntimeEnvironment.isUserRequested(hre)) {
    return;
  }

  if (!(await isDeployed(hre.ethers.provider, hre.fhevm.ACLAddress()))) {
    if (hre.fhevm.runtimeType() === FhevmRuntimeEnvironmentType.Mock) {
      await hre.run('fhevm:start:mock');
    } else {
      await hre.run('fhevm:start');
    }
  }

  try {
    // Should support mupliple calls.
    // Initialize fhevm runtime
    await hre.fhevm.init();
  } catch (e) {}

  // Add a separator
  console.log('');
}

export function getHistoryPath() {
  return path.normalize(path.join(__dirname, '../.fhe-erc3643.history.json'));
}

export async function loadChainConfig(hre: HardhatRuntimeEnvironment) {
  const networkName = hre.network.name;
  const historyPath: string | undefined = networkName === 'hardhat' ? undefined : getHistoryPath();

  await setupFhevmEnvironment(hre);

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
      cryptEngine: {
        decrypt64: hre.fhevm.decrypt64.bind(hre.fhevm),
        encrypt64: async (contract: EthersT.AddressLike, user: EthersT.AddressLike, value: number | bigint) => {
          const instance = await hre.fhevm.createInstance();
          const contractAddr = await hre.ethers.resolveAddress(contract);
          const userAddr = await hre.ethers.resolveAddress(user);
          const input = instance.createEncryptedInput(contractAddr, userAddr);
          input.add64(value);
          return input.encrypt();
        },
      },
      hardhatProvider: hre.network.name === 'hardhat' ? hre.ethers.provider : undefined,
    },
    historyPath,
  );

  return chainConfig;
}
