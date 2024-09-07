import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import { logBox } from '../../sdk/log';

export async function importCliModule(moduleName: string, hre: HardhatRuntimeEnvironment) {
  try {
    await import('../../types');
  } catch (e) {
    logBox("Running 'hardhat typechain' needed. Please wait...");
    await hre.run('typechain');
  }
  return await import('../../sdk/cli/' + moduleName);
}
