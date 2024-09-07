import assert from 'assert';
import { ethers as EthersT } from 'ethers';
import { ITREXFactory, Token, TREXFactory, TREXFactory__factory, TREXImplementationAuthority } from '../types';
import { IdFactoryAPI } from './IdFactoryAPI';
import { TokenAPI } from './TokenAPI';
import { ClaimDetails } from './ClaimIssuerAPI';
import { TxOptions } from './types';
import { txWait } from './utils';
import { IdentityRegistryAPI } from './IdentityRegistryAPI';
import { TREXImplementationAuthorityAPI } from './TRexImplementationAuthorityAPI';
import { FheERC3643Error } from './errors';
import { ChainConfig } from './ChainConfig';

export class TREXFactoryAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): TREXFactory {
    const contract = TREXFactory__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  /**
   * Requirements:
   * - TREXFactory.owner === owner
   * - TREXFactory.implementationAuthority.owner === owner
   */
  static async fromWithOwner(address: string, owner: EthersT.Signer) {
    const factory: TREXFactory = TREXFactory__factory.connect(address, owner);

    const factoryOwnerAddress = await factory.owner();
    const ownerAddress = await owner.getAddress();
    if (factoryOwnerAddress !== ownerAddress) {
      throw new FheERC3643Error(
        `owner ${ownerAddress} is not the owner of TREXFactory ${address}, the actual owner is ${factoryOwnerAddress}`,
      );
    }

    const authorityAddress = await factory.getImplementationAuthority();

    const authority: TREXImplementationAuthority = await TREXImplementationAuthorityAPI.fromWithOwner(
      authorityAddress,
      owner,
    );

    const { major, minor, patch } = await authority.getCurrentVersion();
    if (major !== 4n || minor !== 0n || patch !== 0n) {
      throw new FheERC3643Error('Unexpected TREX version number');
    }

    const idFactory = IdFactoryAPI.from(await factory.getIdFactory(), owner);
    const isTokenFactory = await idFactory.isTokenFactory(factory);
    if (!isTokenFactory) {
      throw new FheERC3643Error('TREXFactory is not linked to its identity factory');
    }

    return factory;
  }

  /**
   * Permissions: public.
   */
  static async tokenFromSalt(
    factory: TREXFactory,
    salt: string,
    runner: EthersT.ContractRunner,
  ): Promise<Token | null> {
    const tokenAddress = await factory.getToken(salt);
    if (tokenAddress === EthersT.ZeroAddress) {
      return null;
    }

    return TokenAPI.from(tokenAddress, runner);
  }

  /**
   * Permissions: public.
   */
  static async tokenFromSaltWithOwner(
    factory: TREXFactory,
    salt: string,
    tokenOwner: EthersT.Signer,
  ): Promise<Token | null> {
    const tokenAddress = await factory.getToken(salt);
    if (tokenAddress === EthersT.ZeroAddress) {
      return null;
    }

    const token = TokenAPI.from(tokenAddress, tokenOwner);
    const actualOwnerAddress = await token.owner();
    const expectedOwnerAddress = await tokenOwner.getAddress();
    if (actualOwnerAddress !== expectedOwnerAddress) {
      throw new FheERC3643Error(
        `${expectedOwnerAddress} is not the token owner, the actual token owner is ${actualOwnerAddress}`,
      );
    }

    return token;
  }

  /**
   * Permissions: ???
   */
  static async createNewToken(
    factory: TREXFactory,
    salt: string,
    tokenOwner: EthersT.AddressLike,
    claimDetails: ClaimDetails,
    irAgent: EthersT.AddressLike,
    deployer: EthersT.Signer,
    chainConfig: ChainConfig,
    options?: TxOptions,
  ) {
    let tokenDetails: ITREXFactory.TokenDetailsStruct = {
      owner: tokenOwner, //will be token management key
      name: 'TREXDINO',
      symbol: 'TREX',
      decimals: 0n,
      irs: EthersT.ZeroAddress, //created by the suite
      ONCHAINID: EthersT.ZeroAddress, // created by the suite owner is management key
      irAgents: [irAgent], //ir.AddAgent(...)
      tokenAgents: [], //token.AddAgent(...) agentManager
      complianceModules: [],
      complianceSettings: [],
    };

    const token = await this.deployTREXSuite(
      factory,
      salt,
      tokenDetails,
      claimDetails.toTREXClaimDetailsStruct(),
      deployer,
      chainConfig,
      options,
    );

    return token;
  }

  /**
   * Permissions: factory owner
   */
  static async deployTREXSuite(
    factory: TREXFactory,
    salt: string,
    tokenDetails: ITREXFactory.TokenDetailsStruct,
    claimDetails: ITREXFactory.ClaimDetailsStruct,
    factoryOwner: EthersT.Signer,
    chainConfig: ChainConfig,
    options?: TxOptions,
  ) {
    const existingToken = await TREXFactoryAPI.tokenFromSalt(factory, salt, factoryOwner);
    if (existingToken) {
      throw new FheERC3643Error(
        `Token with salt '${salt}' already exists in TREX factory ${await factory.getAddress()}`,
      );
    }

    const txReceipt = await txWait(
      factory.connect(factoryOwner).deployTREXSuite(salt, tokenDetails, claimDetails),
      options,
    );

    if (!txReceipt) {
      throw new FheERC3643Error('Deploy TREXSuite failed!');
    }

    if (options?.progress) {
      options.progress.contractDeployed('TREXFactory', await factory.getAddress());
    }

    const log = txReceipt.logs.find(log => 'eventName' in log && log.eventName === 'TREXSuiteDeployed');
    if (!log) {
      throw new FheERC3643Error('Deploy TREXSuite failed!');
    }
    assert(log);
    assert('args' in log);

    //   address indexed _token,
    //   address _ir, identityRegistry
    //   address _irs, identityRegistryStorage
    //   address _tir, trust
    //   address _ctr, claimTopics
    //   address _mc, modularCompliance
    //   string indexed _salt
    const tokenAddress = log.args[0];

    await chainConfig.saveToken(tokenAddress);

    return {
      token: tokenAddress,
      ir: log.args[1],
      irs: log.args[2],
      tir: log.args[3],
      ctr: log.args[4],
      mc: log.args[5],
      saltHash: log.args[6].hash,
    };
  }

  static async transferTokenOwnership(
    factory: TREXFactory,
    salt: string,
    fromOwner: EthersT.Signer,
    toOwner: EthersT.Signer,
  ) {
    const fromOwnerAddress = await fromOwner.getAddress();
    const toOwnerAddress = await toOwner.getAddress();
    if (fromOwnerAddress === toOwnerAddress) {
      return;
    }

    const tokenAddress = await factory.getToken(salt);
    if (tokenAddress === EthersT.ZeroAddress) {
      return null;
    }

    const token = TokenAPI.from(tokenAddress, fromOwner);
    const ir = await TokenAPI.identityRegistry(token, fromOwner);

    const tir = await IdentityRegistryAPI.trustedIssuersRegistry(ir, fromOwner);
    const ctr = await IdentityRegistryAPI.claimTopicsRegistry(ir, fromOwner);
    const mc = await TokenAPI.compliance(token, fromOwner);

    const actualTokenOwnerAddress = await token.owner();
    if (fromOwnerAddress !== actualTokenOwnerAddress && toOwnerAddress !== actualTokenOwnerAddress) {
      throw new FheERC3643Error(`${fromOwnerAddress} is not the Token owner`);
    }

    const actualIROwnerAddress = await ir.owner();
    if (fromOwnerAddress !== actualIROwnerAddress && toOwnerAddress !== actualIROwnerAddress) {
      throw new FheERC3643Error(`${fromOwnerAddress} is not the Identity Registry owner`);
    }

    const actualTIROwnerAddress = await tir.owner();
    if (fromOwnerAddress !== actualTIROwnerAddress && toOwnerAddress !== actualTIROwnerAddress) {
      throw new FheERC3643Error(`${fromOwnerAddress} is not the Trusted Issuers Registry owner`);
    }

    const actualCTROwnerAddress = await ctr.owner();
    if (fromOwnerAddress !== actualCTROwnerAddress && toOwnerAddress !== actualCTROwnerAddress) {
      throw new FheERC3643Error(`${fromOwnerAddress} is not the Claim Topics Registry owner`);
    }

    const actualMCOwnerAddress = await mc.owner();
    if (fromOwnerAddress !== actualMCOwnerAddress && toOwnerAddress !== actualMCOwnerAddress) {
      throw new FheERC3643Error(`${fromOwnerAddress} is not the Modular Compliance owner`);
    }

    if (toOwnerAddress !== actualTokenOwnerAddress) {
      await txWait(token.transferOwnership(toOwner));
    }
    if (toOwnerAddress !== actualIROwnerAddress) {
      await txWait(ir.transferOwnership(toOwner));
    }
    if (toOwnerAddress !== actualTIROwnerAddress) {
      await txWait(tir.transferOwnership(toOwner));
    }
    if (toOwnerAddress !== actualCTROwnerAddress) {
      await txWait(ctr.transferOwnership(toOwner));
    }
    if (toOwnerAddress !== actualMCOwnerAddress) {
      await txWait(mc.transferOwnership(toOwner));
    }
  }
}
