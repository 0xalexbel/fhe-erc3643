import { ethers as EthersT } from 'ethers';
import {
  ClaimTopicsRegistry,
  IdentityRegistry,
  IdentityRegistry__factory,
  IdentityRegistryStorage,
  TrustedIssuersRegistry,
} from './artifacts';
import { IdentityRegistryStorageAPI } from './IdentityRegistryStorageAPI';
import { ClaimTopicsRegistryAPI } from './ClaimTopicsRegistryAPI';
import { TrustedIssuersRegistryAPI } from './TrustedIssuersRegistryAPI';

export class IdentityRegistryAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): IdentityRegistry {
    const contract = IdentityRegistry__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async identityRegistryStorage(
    ir: IdentityRegistry,
    runner?: EthersT.ContractRunner | null,
  ): Promise<IdentityRegistryStorage> {
    return IdentityRegistryStorageAPI.from(await ir.identityStorage(), runner);
  }

  static async claimTopicsRegistry(
    ir: IdentityRegistry,
    runner?: EthersT.ContractRunner | null,
  ): Promise<ClaimTopicsRegistry> {
    return ClaimTopicsRegistryAPI.from(await ir.topicsRegistry(), runner);
  }

  static async trustedIssuersRegistry(
    ir: IdentityRegistry,
    runner?: EthersT.ContractRunner | null,
  ): Promise<TrustedIssuersRegistry> {
    return TrustedIssuersRegistryAPI.from(await ir.issuersRegistry(), runner);
  }
}
