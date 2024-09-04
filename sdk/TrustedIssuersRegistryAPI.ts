import { ethers as EthersT } from 'ethers';
import { ClaimIssuer, TrustedIssuersRegistry, TrustedIssuersRegistry__factory } from './artifacts';
import { ClaimTopic } from './ClaimIssuerAPI';

export class TrustedIssuersRegistryAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): TrustedIssuersRegistry {
    const contract = TrustedIssuersRegistry__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  /**
   * Permissions: public.
   */
  static async trustedIssuers(tir: TrustedIssuersRegistry, runner?: EthersT.ContractRunner | null) {
    if (runner === undefined) {
      runner = tir.runner;
    }
    return tir.connect(runner).getTrustedIssuers();
  }

  /**
   * Permissions: public.
   */
  static async isTrustedIssuer(
    tir: TrustedIssuersRegistry,
    issuer: EthersT.AddressLike,
    runner?: EthersT.ContractRunner | null,
  ) {
    if (runner === undefined) {
      runner = tir.runner;
    }
    return tir.connect(runner).isTrustedIssuer(issuer);
  }

  /**
   * Permissions: public.
   */
  static async trustedIssuerClaimTopics(
    tir: TrustedIssuersRegistry,
    claimIssuer: ClaimIssuer,
    runner?: EthersT.ContractRunner | null,
  ) {
    if (runner === undefined) {
      runner = tir.runner;
    }
    if (!this.isTrustedIssuer(tir, claimIssuer)) {
      throw new Error(`${await claimIssuer.getAddress()} is not a claim issuer`);
    }
    return tir.connect(runner).getTrustedIssuerClaimTopics(claimIssuer);
  }

  /**
   * Permissions: public.
   */
  static async hasClaimTopic(
    tir: TrustedIssuersRegistry,
    issuer: ClaimIssuer,
    topic: ClaimTopic,
    runner?: EthersT.ContractRunner | null,
  ) {
    if (runner === undefined) {
      runner = tir.runner;
    }
    return tir.connect(runner).hasClaimTopic(issuer, topic);
  }
}
