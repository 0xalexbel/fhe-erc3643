import { ethers as EthersT } from 'ethers';
import {
  ClaimTopicsRegistry,
  Identity,
  IdentityRegistry,
  IdentityRegistry__factory,
  IdentityRegistryStorage,
  TrustedIssuersRegistry,
} from './artifacts';
import { IdentityRegistryStorageAPI } from './IdentityRegistryStorageAPI';
import { ClaimTopicsRegistryAPI } from './ClaimTopicsRegistryAPI';
import { TrustedIssuersRegistryAPI } from './TrustedIssuersRegistryAPI';
import { IdentityAPI } from './IdentityAPI';

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

  static async identity(
    ir: IdentityRegistry,
    user: EthersT.AddressLike,
    runner?: EthersT.ContractRunner | null,
  ): Promise<Identity | undefined> {
    const addr = await ir.identity(user);
    if (addr === EthersT.ZeroAddress) {
      return undefined;
    }
    return IdentityAPI.from(addr, runner);
  }
}
