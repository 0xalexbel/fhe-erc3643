import { ethers as EthersT } from 'ethers';
import {
  Identity,
  IdentityRegistry,
  IdentityRegistryStorage,
  ITREXFactory,
  ModularCompliance,
  SupplyLimitModule,
  SupplyLimitModule__factory,
  Token,
  Token__factory,
  TokenProxy__factory,
  TREXFactory,
} from './artifacts';
import { TxOptions } from './types';
import { isDeployed, txWait, txWaitAndCatchError } from './utils';
import { IdentityRegistryAPI } from './IdentityRegistryAPI';
import { ClaimTopicsRegistryAPI } from './ClaimTopicsRegistryAPI';
import { IdentityAPI } from './IdentityAPI';
import { ModularComplianceAPI } from './ModuleComplianceAPI';
import { FheERC3643Error, throwIfNotOwner } from './errors';
import { ChainConfig } from './ChainConfig';
import { IdFactoryAPI } from './IdFactoryAPI';
import { AgentRoleAPI } from './AgentRoleAPI';

export class TokenAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): Token {
    const contract = Token__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async fromSafe(address: string, runner: EthersT.ContractRunner): Promise<Token> {
    if (!runner.provider) {
      throw new FheERC3643Error('ContractRunner has no provider');
    }

    const contract = Token__factory.connect(address);

    if (!(await isDeployed(runner.provider, address))) {
      throw new FheERC3643Error(`Token ${address} is not deployed`);
    }

    return contract.connect(runner);
  }

  /**
   * token.owner == trexFactoryOwner
   */
  static async deployNew(
    trexFactory: TREXFactory,
    trexFactoryOwner: EthersT.Signer, // same as deploy suite. (onlyOwner)
    trexIdFactoryOwner: EthersT.Signer,
    identityRegistry: IdentityRegistry,
    compliance: ModularCompliance,
    trexFactorySalt: string,
    tokenDetails: ITREXFactory.TokenDetailsStruct,
    chainConfig: ChainConfig,
    options: TxOptions,
  ) {
    // trexFactory.owner() === trexFactoryOwner
    throwIfNotOwner('TREXFactory', chainConfig, trexFactory, trexFactoryOwner);
    const trexImplementationAuthorityAddress = await trexFactory.connect(trexFactoryOwner).getImplementationAuthority();

    const trexIdFactoryAddress = await trexFactory.connect(trexFactoryOwner).getIdFactory();
    const trexIdFactory = await IdFactoryAPI.fromWithOwner(trexIdFactoryAddress, trexIdFactoryOwner);

    const tokenFactory = new TokenProxy__factory().connect(trexFactoryOwner);
    const proxy = await tokenFactory.deploy(
      trexImplementationAuthorityAddress,
      identityRegistry,
      compliance,
      tokenDetails.name,
      tokenDetails.symbol,
      tokenDetails.decimals,
      tokenDetails.ONCHAINID,
    );
    await proxy.waitForDeployment();
    const token = Token__factory.connect(await proxy.getAddress()).connect(trexFactoryOwner);

    // token.owner() === trexFactoryOwner
    throwIfNotOwner('Token', chainConfig, token, trexFactoryOwner);

    const tokenIDAddress = EthersT.resolveAddress(tokenDetails.ONCHAINID);
    if (tokenIDAddress === EthersT.ZeroAddress) {
      await IdFactoryAPI.createTokenIdentity(
        trexIdFactory.idFactory,
        trexIdFactoryOwner,
        token,
        trexFactoryOwner,
        tokenDetails.owner,
        trexFactorySalt,
        chainConfig,
        options,
      );
    }

    // From deployTREXSuite()
    // AgentRole(address(ir)).addAgent(address(token));
    const agentRole = await AgentRoleAPI.fromWithOwner(await identityRegistry.getAddress(), trexFactoryOwner);
    await AgentRoleAPI.addAgent(agentRole, token, trexFactoryOwner, options);

    return token;
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
    return ModularComplianceAPI.fromWithOwner(await token.connect(complianceOwner).compliance(), complianceOwner);
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
      throw new FheERC3643Error(`Invalid user address ${userAddress}`);
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
      throw new FheERC3643Error(`Invalid user address ${userAddress}`);
    }

    const existing = await this.identityFromUser(token, user, runner);
    if (existing?.identity) {
      if ((await existing.identity.getAddress()) !== (await identity.getAddress())) {
        throw new FheERC3643Error(
          `user ${await userAddress} already stored in identity registry with a different identity`,
        );
      }
      if (existing.investorCountry !== country) {
        throw new FheERC3643Error(
          `user ${await userAddress} already stored in identity registry with a different country code`,
        );
      }
      return true;
    }

    return false;
  }

  /**
   * Returns true if registered, false if already registered, throw error if failed.
   */
  static async registerIdentity(
    token: Token,
    user: EthersT.AddressLike,
    identity: Identity,
    country: bigint,
    agent: EthersT.Signer,
    options: TxOptions,
  ): Promise<boolean> {
    // user cannot be zero
    const userAddress = EthersT.resolveAddress(user);
    if (userAddress === EthersT.ZeroAddress) {
      throw new FheERC3643Error(`Invalid user address ${userAddress}`);
    }

    const existing = await this.identityFromUser(token, user, agent);
    if (existing?.identity) {
      if ((await existing.identity.getAddress()) !== (await identity.getAddress())) {
        throw new FheERC3643Error(
          `user ${await userAddress} already stored in identity registry with a different identity`,
        );
      }
      if (existing.investorCountry !== country) {
        throw new FheERC3643Error(
          `user ${await userAddress} already stored in identity registry with a different country code`,
        );
      }
      return false;
    }

    // for debug purpose
    const ok = await IdentityAPI.isManagementKey(identity, user);
    if (!ok) {
      throw new FheERC3643Error(`Strange!! user ${user} is not a management key of identity `);
    }

    // identity cannot be zero
    // user can only have one identity
    // user cannot be already stored.
    const ir = await this.identityRegistry(token, agent);

    if (!(await ir.isAgent(agent))) {
      throw new FheERC3643Error(
        `${await agent.getAddress()} is not an agent of Identity Registry ${await ir.getAddress()}`,
      );
    }

    //storedIdentity
    await txWait(ir.registerIdentity(user, identity, country), options);

    // Check
    const irs = await IdentityRegistryAPI.identityRegistryStorage(ir, agent);

    const storedIdentityAddress = await irs.storedIdentity(user);
    if (storedIdentityAddress === EthersT.ZeroAddress) {
      throw new FheERC3643Error(`Register identity failed. Address is zero!`);
    }

    return true;
  }

  static async mint(
    token: Token,
    user: EthersT.AddressLike,
    eamount: Uint8Array,
    inputProof: Uint8Array,
    agent: EthersT.Signer,
    chainConfig: ChainConfig,
    options?: TxOptions,
  ) {
    const userAddr = EthersT.resolveAddress(user);
    const txPromise = token
      .connect(agent)
      ['mint(address,bytes32,bytes)'](userAddr, eamount, inputProof, { gasLimit: options?.gasLimit });

    const txReceipt = await txWaitAndCatchError(txPromise);
    return txReceipt;
  }

  static async burn(
    token: Token,
    user: EthersT.AddressLike,
    eamount: Uint8Array,
    inputProof: Uint8Array,
    agent: EthersT.Signer,
    options?: TxOptions,
  ) {
    const userAddr = EthersT.resolveAddress(user);
    const txPromise = token
      .connect(agent)
      ['burn(address,bytes32,bytes)'](userAddr, eamount, inputProof, { gasLimit: options?.gasLimit });

    const txReceipt = await txWaitAndCatchError(txPromise);
    return txReceipt;
  }

  static async transfer(
    token: Token,
    to: EthersT.AddressLike,
    eamount: Uint8Array,
    inputProof: Uint8Array,
    wallet: EthersT.Signer,
    options?: TxOptions,
  ) {
    const toAddr = EthersT.resolveAddress(to);
    const txPromise = token
      .connect(wallet)
      ['transfer(address,bytes32,bytes)'](toAddr, eamount, inputProof, { gasLimit: options?.gasLimit });

    const txReceipt = await txWaitAndCatchError(txPromise);
    return txReceipt;
  }

  static async freezePartialTokens(
    token: Token,
    user: EthersT.AddressLike,
    eamount: Uint8Array,
    inputProof: Uint8Array,
    agent: EthersT.Signer,
    options?: TxOptions,
  ) {
    const userAddr = EthersT.resolveAddress(user);
    const txPromise = token
      .connect(agent)
      ['freezePartialTokens(address,bytes32,bytes)'](userAddr, eamount, inputProof, { gasLimit: options?.gasLimit });

    const txReceipt = await txWaitAndCatchError(txPromise);
    return txReceipt;
  }

  static async unfreezePartialTokens(
    token: Token,
    user: EthersT.AddressLike,
    eamount: Uint8Array,
    inputProof: Uint8Array,
    agent: EthersT.Signer,
    options?: TxOptions,
  ) {
    const userAddr = EthersT.resolveAddress(user);
    const txPromise = token
      .connect(agent)
      ['unfreezePartialTokens(address,bytes32,bytes)'](userAddr, eamount, inputProof, { gasLimit: options?.gasLimit });

    const txReceipt = await txWaitAndCatchError(txPromise);
    return txReceipt;
  }

  static async balanceOf(token: Token, user: EthersT.AddressLike, runner: EthersT.ContractRunner, options?: TxOptions) {
    const userAddr = EthersT.resolveAddress(user);
    const encBalance = await token.connect(runner).balanceOf(userAddr);
    return encBalance;
  }

  static async totalSupply(token: Token, runner: EthersT.ContractRunner, options?: TxOptions) {
    const encTotalSupply = await token.connect(runner).totalSupply();
    return encTotalSupply;
  }

  static async getFrozenTokens(
    token: Token,
    user: EthersT.AddressLike,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ) {
    const userAddr = EthersT.resolveAddress(user);
    const encFrozenTokens = await token.connect(runner).getFrozenTokens(userAddr);
    return encFrozenTokens;
  }

  static async pause(token: Token, agent: EthersT.Signer, options?: TxOptions) {
    const txPromise = token.connect(agent).pause({ gasLimit: options?.gasLimit });

    const txReceipt = await txWaitAndCatchError(txPromise);
    return txReceipt;
  }

  static async unpause(token: Token, agent: EthersT.Signer, options?: TxOptions) {
    const txPromise = token.connect(agent).unpause({ gasLimit: options?.gasLimit });

    const txReceipt = await txWaitAndCatchError(txPromise);
    return txReceipt;
  }

  static async paused(token: Token, runner: EthersT.ContractRunner, options?: TxOptions) {
    return await token.connect(runner).paused();
  }

  static async getSupplyLimitModules(token: Token, runner: EthersT.ContractRunner, options?: TxOptions) {
    const compliance = ModularComplianceAPI.from(await token.compliance(), runner);
    const modules = await ModularComplianceAPI.findModulesWithName(compliance, 'SupplyLimitModule', runner, options);
    const m: Array<SupplyLimitModule> = [];
    for (let i = 0; i < modules.length; ++i) {
      m.push(SupplyLimitModule__factory.connect(await modules[i].getAddress(), runner));
    }
    return m;
  }
}
