import assert from 'assert';
import { ethers as EthersT } from 'ethers';
import { ITREXFactory, Token, TREXFactory, TREXFactory__factory, TREXImplementationAuthority } from '../types';
import { IdFactoryAPI } from './IdFactoryAPI';
import { TokenAPI } from './TokenAPI';
import { History, TxOptions, WalletResolver } from './types';
import { isDeployed, txWait } from './utils';
import { IdentityRegistryAPI } from './IdentityRegistryAPI';
import { TREXImplementationAuthorityAPI } from './TRexImplementationAuthorityAPI';
import { FheERC3643Error, throwIfInvalidAddress, throwIfNoProvider, throwIfNotOwner } from './errors';
import { ModularComplianceAPI } from './ModuleComplianceAPI';
import { NewTokenResult } from './cli/token';
import { logStepDeployOK } from './log';

export class TREXFactoryAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): TREXFactory {
    const contract = TREXFactory__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async fromSafe(address: string, runner: EthersT.ContractRunner): Promise<TREXFactory> {
    throwIfInvalidAddress(address);

    if (!runner.provider) {
      throw new FheERC3643Error('ContractRunner has no provider');
    }

    const contract = TREXFactory__factory.connect(address);

    if (!(await isDeployed(runner.provider, address))) {
      throw new FheERC3643Error(`TREX Factory ${address} is not deployed`);
    }

    if (!(await TREXFactoryAPI.isTREXFactory(address, runner))) {
      throw new FheERC3643Error(`Address ${address} is not a TREX Factory, it's probably something else...`);
    }

    return contract.connect(runner);
  }

  static async isTREXFactory(address: string, runner: EthersT.ContractRunner): Promise<boolean> {
    if (!runner.provider) {
      throw new FheERC3643Error('ContractRunner has no provider');
    }
    try {
      const token = TREXFactoryAPI.from(address, runner);
      const result = await Promise.all([token.getImplementationAuthority(), token.getIdFactory()]);
      if (!EthersT.isAddress(result[0]) || result[0] === EthersT.ZeroAddress) {
        return false;
      }
      if (!EthersT.isAddress(result[1]) || result[1] === EthersT.ZeroAddress) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
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

    const token = await TokenAPI.fromSafe(tokenAddress, tokenOwner);
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
   * Permissions: factory owner
   */
  static async deployTREXSuite(
    factory: TREXFactory,
    salt: string,
    tokenDetails: ITREXFactory.TokenDetailsStruct,
    claimDetails: ITREXFactory.ClaimDetailsStruct,
    factoryOwner: EthersT.Signer,
    history: History,
    options: TxOptions,
  ) {
    const runner = throwIfNoProvider(factoryOwner);

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

    const token = await TREXFactoryAPI.tokenFromSalt(factory, salt, runner);
    if ((await token?.getAddress()) !== tokenAddress) {
      throw new FheERC3643Error('Deploy TREXSuite failed! New token is not stored in the TREXFactory.');
    }

    await logStepDeployOK('Token', tokenAddress, options);
    await history.saveContract(tokenAddress, 'Token');

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

  //////////////////////////////////////////////////////////////////////////////

  static async transferTokenOwnership(
    token: Token,
    fromOwner: EthersT.Signer,
    toOwner: EthersT.Signer,
    walletResolver: WalletResolver,
    options: TxOptions,
  ) {
    const provider = throwIfNoProvider(fromOwner);
    const fromOwnerAddress = await fromOwner.getAddress();
    const toOwnerAddress = await toOwner.getAddress();
    if (fromOwnerAddress === toOwnerAddress) {
      return;
    }

    const tokenAddress = await token.getAddress();
    if (tokenAddress === EthersT.ZeroAddress) {
      return null;
    }

    token = token.connect(fromOwner);
    throwIfNotOwner('Token', token, fromOwner, provider, walletResolver);

    const ir = await TokenAPI.identityRegistry(token, fromOwner);

    const tir = await IdentityRegistryAPI.trustedIssuersRegistry(ir, fromOwner);
    const ctr = await IdentityRegistryAPI.claimTopicsRegistry(ir, fromOwner);
    const mc = await TokenAPI.compliance(token, fromOwner);

    const actualTokenOwnerAddress = await token.owner();
    const actualMCOwnerAddress = await mc.owner();
    const actualIROwnerAddress = await ir.owner();
    const actualTIROwnerAddress = await tir.owner();
    const actualCTROwnerAddress = await ctr.owner();

    throwIfNotOwner('Token', token, fromOwnerAddress, provider, walletResolver);
    throwIfNotOwner('IdentityRegistry', ir, fromOwnerAddress, provider, walletResolver);
    throwIfNotOwner('TrustedIssuersRegistry', tir, fromOwnerAddress, provider, walletResolver);
    throwIfNotOwner('ClaimTopicsRegistry', ctr, fromOwnerAddress, provider, walletResolver);
    throwIfNotOwner('ModularCompliance', mc, fromOwnerAddress, provider, walletResolver);

    if (toOwnerAddress !== actualTokenOwnerAddress) {
      await txWait(token.transferOwnership(toOwner), options);
    }
    if (toOwnerAddress !== actualIROwnerAddress) {
      await txWait(ir.connect(fromOwner).transferOwnership(toOwner), options);
    }
    if (toOwnerAddress !== actualTIROwnerAddress) {
      await txWait(tir.connect(fromOwner).transferOwnership(toOwner), options);
    }
    if (toOwnerAddress !== actualCTROwnerAddress) {
      await txWait(ctr.connect(fromOwner).transferOwnership(toOwner), options);
    }
    if (toOwnerAddress !== actualMCOwnerAddress) {
      await txWait(mc.connect(fromOwner).transferOwnership(toOwner), options);
    }
  }

  //////////////////////////////////////////////////////////////////////////////

  static async deployTREXSuiteManual(
    factory: TREXFactory,
    salt: string,
    tokenDetails: ITREXFactory.TokenDetailsStruct,
    claimDetails: ITREXFactory.ClaimDetailsStruct,
    tokenOwner: EthersT.Signer,
    factoryOwner: EthersT.Signer,
    walletResolver: WalletResolver,
    options: TxOptions,
  ): Promise<NewTokenResult> {
    if (tokenDetails.owner !== (await tokenOwner.getAddress())) {
      throw new FheERC3643Error(`Invalid token owner.`);
    }

    const trexImplementationAuthorityAddress = await factory.connect(factoryOwner).getImplementationAuthority();
    const trexImplementationAuthority = await TREXImplementationAuthorityAPI.fromWithOwner(
      trexImplementationAuthorityAddress,
      factoryOwner,
    );

    //Deploy IdentityRegistry
    const { identityRegistry, identityRegistryStorage, trustedIssuersRegistry, claimTopicsRegistry } =
      await IdentityRegistryAPI.deployNew(trexImplementationAuthority, factoryOwner, options);

    // Deploy compliance
    const compliance = await ModularComplianceAPI.deployNew(factory, factoryOwner, options);

    // Deploy token
    const token = await TokenAPI.deployNew(
      factory,
      factoryOwner,
      factoryOwner,
      identityRegistry,
      compliance,
      salt,
      tokenDetails,
      walletResolver,
      options,
    );

    //Claim detials
    for (let i = 0; i < claimDetails.claimTopics.length; ++i) {
      await txWait(claimTopicsRegistry.addClaimTopic(claimDetails.claimTopics[i]), options);
    }
    for (let i = 0; i < claimDetails.issuers.length; ++i) {
      await txWait(
        trustedIssuersRegistry.addTrustedIssuer(claimDetails.issuers[i], claimDetails.issuerClaims[i]),
        options,
      );
    }

    // Transfer ownership
    await TREXFactoryAPI.transferTokenOwnership(token, factoryOwner, tokenOwner, walletResolver, options);

    return {
      token: await token.getAddress(),
      ir: await identityRegistry.getAddress(),
      ctr: await claimTopicsRegistry.getAddress(),
      irs: await identityRegistryStorage.getAddress(),
      tir: await trustedIssuersRegistry.getAddress(),
      mc: await compliance.getAddress(),
      saltHash: EthersT.ZeroHash,
    };
  }
}
