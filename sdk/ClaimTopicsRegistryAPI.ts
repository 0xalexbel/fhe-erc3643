import { ethers as EthersT } from 'ethers';
import { ClaimTopicsRegistry, ClaimTopicsRegistry__factory } from './artifacts';

export class ClaimTopicsRegistryAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): ClaimTopicsRegistry {
    const contract = ClaimTopicsRegistry__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  /**
   * Permissions: public.
   */
  static async claimTopics(ctr: ClaimTopicsRegistry, runner?: EthersT.ContractRunner | null) {
    if (runner === undefined) {
      runner = ctr.runner;
    }
    return ctr.connect(runner).getClaimTopics();
  }
}
