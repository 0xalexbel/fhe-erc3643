import { ethers as EthersT } from 'ethers';
import { Identity, IdentityRegistry, IdentityRegistryStorage, Token, Token__factory } from './artifacts';
import { TxOptions } from './types';
import { txWait } from './utils';
import { IdentityRegistryAPI } from './IdentityRegistryAPI';
import { ClaimTopicsRegistryAPI } from './ClaimTopicsRegistryAPI';
import { IdentityAPI } from './IdentityAPI';
import { ModularComplianceAPI } from './ModuleComplianceAPI';

export class TokenAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): Token {
    const contract = Token__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  /**
   * Permission: public
   */
  static async claimTopics(token: Token, runner?: EthersT.ContractRunner | null) {
    if (!runner) {
      runner = token.runner;
    }

    const ir = await this.identityRegistry(token, runner);
    const ctr = await IdentityRegistryAPI.claimTopicsRegistry(ir, runner);
    return ClaimTopicsRegistryAPI.claimTopics(ctr, runner);
  }

  /**
   * Permission: public
   */
  static async compliance(token: Token, runner?: EthersT.ContractRunner | null) {
    if (!runner) {
      runner = token.runner;
    }

    return ModularComplianceAPI.from(await token.compliance(), runner);
  }

  /**
   * Permission: compliance owner
   */
  static async complianceWithOwner(token: Token, complianceOwner: EthersT.Signer) {
    return ModularComplianceAPI.fromWithOwner(await token.compliance(), complianceOwner);
  }

  /**
   * - Permission: public
   * - Access: readonly
   */
  static async identityFromUser(token: Token, user: EthersT.AddressLike, runner?: EthersT.ContractRunner | null) {
    if (!runner) {
      runner = token.runner;
    }

    // user cannot be zero
    const userAddress = EthersT.resolveAddress(user);
    if (userAddress === EthersT.ZeroAddress) {
      throw new Error(`Invalid user address ${userAddress}`);
    }

    const irs = await this.identityRegistryStorage(token, runner);

    let identityAddress = await irs.connect(runner).storedIdentity(user);
    if (identityAddress === EthersT.ZeroAddress) {
      return undefined;
    }

    const investorCountry = await irs.connect(runner).storedInvestorCountry(user);
    const identity = IdentityAPI.from(identityAddress);

    return {
      identity,
      investorCountry,
    };
  }

  static async identityRegistry(token: Token, runner?: EthersT.ContractRunner | null): Promise<IdentityRegistry> {
    return IdentityRegistryAPI.from(await token.identityRegistry(), runner);
  }

  static async identityRegistryStorage(
    token: Token,
    runner?: EthersT.ContractRunner | null,
  ): Promise<IdentityRegistryStorage> {
    const ir = await this.identityRegistry(token, runner);
    return IdentityRegistryAPI.identityRegistryStorage(ir, runner);
  }

  static async hasIdentity(
    token: Token,
    user: EthersT.AddressLike,
    identity: Identity,
    country: bigint,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ) {
    // user cannot be zero
    const userAddress = EthersT.resolveAddress(user);
    if (userAddress === EthersT.ZeroAddress) {
      throw new Error(`Invalid user address ${userAddress}`);
    }

    const existing = await this.identityFromUser(token, user, runner);
    if (existing?.identity) {
      if ((await existing.identity.getAddress()) !== (await identity.getAddress())) {
        throw new Error(`user ${await userAddress} already stored in identity registry with a different identity`);
      }
      if (existing.investorCountry !== country) {
        throw new Error(`user ${await userAddress} already stored in identity registry with a different country code`);
      }
      return true;
    }

    return false;
  }

  static async registerIdentity(
    token: Token,
    user: EthersT.AddressLike,
    identity: Identity,
    country: bigint,
    agent: EthersT.Signer,
    options?: TxOptions,
  ) {
    // user cannot be zero
    const userAddress = EthersT.resolveAddress(user);
    if (userAddress === EthersT.ZeroAddress) {
      throw new Error(`Invalid user address ${userAddress}`);
    }

    const existing = await this.identityFromUser(token, user, agent);
    if (existing?.identity) {
      if ((await existing.identity.getAddress()) !== (await identity.getAddress())) {
        throw new Error(`user ${await userAddress} already stored in identity registry with a different identity`);
      }
      if (existing.investorCountry !== country) {
        throw new Error(`user ${await userAddress} already stored in identity registry with a different country code`);
      }
      console.log(
        `Identity ${await identity.getAddress()} with country ${country} is already stored in the token identity registry`,
      );
      return;
    }

    // for debug purpose
    const ok = await IdentityAPI.isManagementKey(identity, user);
    if (!ok) {
      throw new Error(`Strange!! user ${user} is not a management key of identity `);
    }

    // identity cannot be zero
    // user can only have one identity
    // user cannot be already stored.
    const ir = await this.identityRegistry(token, agent);

    if (!(await ir.isAgent(agent))) {
      throw new Error(`${await agent.getAddress()} is not an agent of Identity Registry ${await ir.getAddress()}`);
    }

    //storedIdentity
    await txWait(ir.registerIdentity(user, identity, country), options);

    // Check
    const irs = await IdentityRegistryAPI.identityRegistryStorage(ir, agent);

    const storedIdentityAddress = await irs.storedIdentity(user);
    if (storedIdentityAddress === EthersT.ZeroAddress) {
      throw new Error(`Register identity failed. Address is zero!`);
    }
  }
}
