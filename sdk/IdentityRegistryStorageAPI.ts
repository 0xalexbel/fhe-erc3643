import { ethers as EthersT } from 'ethers';
import { IdentityRegistryStorage, IdentityRegistryStorage__factory } from './artifacts';

export class IdentityRegistryStorageAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): IdentityRegistryStorage {
    const contract = IdentityRegistryStorage__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }
}
