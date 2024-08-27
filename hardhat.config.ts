import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'hardhat-ignore-warnings';
/**
 *    IMPORTANT HH PLUGIN WARNING
 *    ===========================
 *    !! the 'hardhat-fhevm' HH plugin must be imported AFTER the 'hardhat-gas-reporter' plugin !!
 *
 *    Both plugins are overriding the built-in TASK_TEST. However,
 *    'hardhat-fhevm' must be called first by the runtime to start the fhevm network.
 *    If 'hardhat-gas-reporter' is called first and 'hardhat-fhevm' second the following
 *    error will be raised:
 *
 *    "Error HH108: Cannot connect to the network fhevm.
 *     Please make sure your node is running, and check your internet connection and networks config"
 */
import 'hardhat-fhevm';
import { HardhatUserConfig } from 'hardhat/config';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      evmVersion: 'cancun',
    },
  },
  // required to silence all fhevm solidity warnings
  warnings: {
    '*': {
      'transient-storage': false,
    },
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v6',
  },
  mocha: {
    timeout: 500000,
  },
};

export default config;
