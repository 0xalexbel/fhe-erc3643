import hre from 'hardhat';

import type { EncryptedERC20 } from '../../../types';
import { getSigners } from '../../utils';

export async function deployEncryptedERC20Fixture(): Promise<EncryptedERC20> {
  const signers = getSigners();

  const contractFactory = await hre.ethers.getContractFactory('EncryptedERC20');
  const contract = await contractFactory.connect(signers.alice).deploy('Naraggara', 'NARA'); // City of Zama's battle
  await contract.waitForDeployment();

  return contract;
}
