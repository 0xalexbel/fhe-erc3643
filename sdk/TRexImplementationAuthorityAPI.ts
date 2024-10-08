import { ethers as EthersT } from 'ethers';
import {
  ClaimTopicsRegistry,
  ClaimTopicsRegistry__factory,
  IdentityRegistry,
  IdentityRegistry__factory,
  IdentityRegistryStorage,
  IdentityRegistryStorage__factory,
  IdFactory,
  ITREXImplementationAuthority,
  ModularCompliance,
  ModularCompliance__factory,
  Token,
  Token__factory,
  TREXFactory,
  TREXFactory__factory,
  TREXImplementationAuthority,
  TREXImplementationAuthority__factory,
  TrustedIssuersRegistry,
  TrustedIssuersRegistry__factory,
} from './artifacts';
import { History, TREXConfig, TxOptions } from './types';
import { isDeployed, txWait } from './utils';
import { IdentityImplementationAuthorityAPI } from './IdentityImplementationAuthorityAPI';
import { TREXFactoryAPI } from './TREXFactoryAPI';
import { IdFactoryAPI } from './IdFactoryAPI';
import { FheERC3643Error } from './errors';
import { logStepDeployOK } from './log';

////////////////////////////////////////////////////////////////////////////////

// Token
async function _deployNewToken(deployer: EthersT.Signer, options?: TxOptions): Promise<Token> {
  const tokenFactory = new Token__factory();
  const token: Token = await tokenFactory.connect(deployer).deploy();
  await token.waitForDeployment();

  await logStepDeployOK('Token', await token.getAddress(), options);

  return token;
}

////////////////////////////////////////////////////////////////////////////////

// ClaimTopicsRegistry
async function _deployNewClaimTopicsRegistry(
  deployer: EthersT.Signer,
  options?: TxOptions,
): Promise<ClaimTopicsRegistry> {
  const registryFactory = new ClaimTopicsRegistry__factory();
  const registry: ClaimTopicsRegistry = await registryFactory.connect(deployer).deploy();
  await registry.waitForDeployment();

  await logStepDeployOK('ClaimTopicsRegistry', await registry.getAddress(), options);

  return registry;
}

////////////////////////////////////////////////////////////////////////////////

// IdentityRegistry
async function _deployNewIdentityRegistry(deployer: EthersT.Signer, options?: TxOptions): Promise<IdentityRegistry> {
  const registryFactory = new IdentityRegistry__factory();
  const registry: IdentityRegistry = await registryFactory.connect(deployer).deploy();
  await registry.waitForDeployment();

  await logStepDeployOK('IdentityRegistry', await registry.getAddress(), options);

  return registry;
}

////////////////////////////////////////////////////////////////////////////////

// IdentityRegistryStorage
async function _deployNewIdentityRegistryStorage(
  deployer: EthersT.Signer,
  options?: TxOptions,
): Promise<IdentityRegistryStorage> {
  const registryFactory = new IdentityRegistryStorage__factory();
  const registry: IdentityRegistryStorage = await registryFactory.connect(deployer).deploy();
  await registry.waitForDeployment();

  await logStepDeployOK('IdentityRegistryStorage', await registry.getAddress(), options);

  return registry;
}

////////////////////////////////////////////////////////////////////////////////

// TrustedIssuersRegistry
async function _deployNewTrustedIssuersRegistry(
  deployer: EthersT.Signer,
  options?: TxOptions,
): Promise<TrustedIssuersRegistry> {
  const registryFactory = new TrustedIssuersRegistry__factory();
  const registry: TrustedIssuersRegistry = await registryFactory.connect(deployer).deploy();
  await registry.waitForDeployment();

  await logStepDeployOK('TrustedIssuersRegistry', await registry.getAddress(), options);

  return registry;
}

////////////////////////////////////////////////////////////////////////////////

// ModularCompliance
async function _deployNewModularCompliance(deployer: EthersT.Signer, options?: TxOptions): Promise<ModularCompliance> {
  const factory = new ModularCompliance__factory();
  const contract: ModularCompliance = await factory.connect(deployer).deploy();
  await contract.waitForDeployment();

  await logStepDeployOK('ModularCompliance', await contract.getAddress(), options);

  return contract;
}

////////////////////////////////////////////////////////////////////////////////

export class TREXImplementationAuthorityAPI {
  static async fromWithOwner(address: string, owner: EthersT.Signer) {
    const authority = TREXImplementationAuthority__factory.connect(address, owner);

    if ((await authority.owner()) !== (await owner.getAddress())) {
      throw new FheERC3643Error('signer is not the owner of TREXImplementationAuthority.owner');
    }

    return authority;
  }

  static async loadOrDeployNewMain(authority: string | null | undefined, owner: EthersT.Signer, options: TxOptions) {
    if (authority) {
      return TREXImplementationAuthorityAPI.fromWithOwner(authority, owner);
    } else {
      return TREXImplementationAuthorityAPI.deployNewMain({ major: 4, minor: 0, patch: 0 }, {}, owner, options);
    }
  }

  static async deployNewMain(
    version: { major: number; minor: number; patch: number },
    contracts: {
      tokenImplementation?: Token;
      claimTopicsRegistryImplementation?: ClaimTopicsRegistry;
      identityRegistryImplementation?: IdentityRegistry;
      identityRegistryStorageImplementation?: IdentityRegistryStorage;
      trustedIssuersRegistryImplementation?: TrustedIssuersRegistry;
      modularComplianceImplementation?: ModularCompliance;
    },
    deployer: EthersT.Signer,
    options: TxOptions,
  ): Promise<TREXImplementationAuthority> {
    const factory = new TREXImplementationAuthority__factory();

    const authority: TREXImplementationAuthority = await factory
      .connect(deployer)
      .deploy(true, EthersT.ZeroAddress, EthersT.ZeroAddress);

    await authority.waitForDeployment();

    await logStepDeployOK('TREXImplementationAuthority', await authority.getAddress(), options);

    let tokenImplementation = contracts.tokenImplementation;
    let ctrImplementation = contracts.claimTopicsRegistryImplementation;
    let irImplementation = contracts.identityRegistryImplementation;
    let irsImplementation = contracts.identityRegistryStorageImplementation;
    let tirImplementation = contracts.trustedIssuersRegistryImplementation;
    let mcImplementation = contracts.modularComplianceImplementation;

    if (!tokenImplementation) {
      tokenImplementation = await _deployNewToken(deployer, options);
      if (!tokenImplementation) {
        throw new FheERC3643Error('Deploy ModularCompliance failed.');
      }
    }

    if (!ctrImplementation) {
      ctrImplementation = await _deployNewClaimTopicsRegistry(deployer, options);
      if (!ctrImplementation) {
        throw new FheERC3643Error('Deploy ModularCompliance failed.');
      }
    }

    if (!irImplementation) {
      irImplementation = await _deployNewIdentityRegistry(deployer, options);
      if (!irImplementation) {
        throw new FheERC3643Error('Deploy ModularCompliance failed.');
      }
    }

    if (!irsImplementation) {
      irsImplementation = await _deployNewIdentityRegistryStorage(deployer, options);
      if (!irsImplementation) {
        throw new FheERC3643Error('Deploy ModularCompliance failed.');
      }
    }

    if (!tirImplementation) {
      tirImplementation = await _deployNewTrustedIssuersRegistry(deployer, options);
      if (!tirImplementation) {
        throw new FheERC3643Error('Deploy ModularCompliance failed.');
      }
    }

    if (!mcImplementation) {
      mcImplementation = await _deployNewModularCompliance(deployer, options);
      if (!mcImplementation) {
        throw new FheERC3643Error('Deploy ModularCompliance failed.');
      }
    }

    const cstr: ITREXImplementationAuthority.TREXContractsStruct = {
      tokenImplementation,
      tirImplementation,
      mcImplementation,
      irImplementation,
      irsImplementation,
      ctrImplementation,
    };

    await txWait(authority.connect(deployer).addAndUseTREXVersion(version, cstr), options);

    await logStepDeployOK('TREXImplementationAuthority', await authority.getAddress(), options);

    return authority;
  }

  static async deployNewTRexFactory(
    authority: TREXImplementationAuthority | undefined,
    idFactory: IdFactory | undefined,
    deployer: EthersT.Signer,
    history: History,
    options: TxOptions,
  ) {
    if (!authority) {
      authority = await this.deployNewMain({ major: 4, minor: 0, patch: 0 }, {}, deployer, options);
    }

    if (!idFactory) {
      const o = await IdentityImplementationAuthorityAPI.deployNewIdFactory(deployer, history, options);
      idFactory = o.idFactory;
    }

    //Deploy TREXFactory
    const factory = new TREXFactory__factory();
    const TRexFactory: TREXFactory = await factory.connect(deployer).deploy(authority, idFactory);
    await TRexFactory.waitForDeployment();

    // Link new TREX Factory to identity factory
    await txWait(idFactory.connect(deployer).addTokenFactory(TRexFactory), options);

    const TRexFactoryAddress = await TRexFactory.getAddress();

    await logStepDeployOK('TREXFactory', TRexFactoryAddress, options);
    await history.saveContract(TRexFactoryAddress, 'TREXFactory');

    return TRexFactory;
  }

  static async loadOrDeployTREXConfig(config: TREXConfig, owner: EthersT.Signer, history: History, options: TxOptions) {
    let idFactory: IdFactory;
    let authority: TREXImplementationAuthority;
    let factory: TREXFactory;

    config.factory = await isDeployed(owner.provider!, config.factory);
    config.authority = await isDeployed(owner.provider!, config.authority);
    config.idFactory = await isDeployed(owner.provider!, config.idFactory);

    if (config.factory) {
      factory = await TREXFactoryAPI.fromWithOwner(config.factory, owner);

      const _authority = await factory.getImplementationAuthority();

      if (config.authority && config.authority !== _authority) {
        throw new FheERC3643Error('Incompatible TREX Implementation Anthority');
      }

      authority = await TREXImplementationAuthorityAPI.fromWithOwner(_authority, owner);

      const _idFactory = await factory.getIdFactory();

      if (config.idFactory && config.idFactory !== _idFactory) {
        throw new FheERC3643Error('Incompatible TREX Identity Factory');
      }

      idFactory = (await IdFactoryAPI.fromWithOwner(_idFactory, owner)).idFactory;

      factory = await TREXFactoryAPI.fromWithOwner(config.factory, owner);
    } else {
      idFactory = await IdentityImplementationAuthorityAPI.loadOrDeployIdFactory(
        config.idFactory,
        owner,
        history,
        options,
      );

      authority = await this.loadOrDeployNewMain(config.authority, owner, options);

      factory = await TREXImplementationAuthorityAPI.deployNewTRexFactory(
        authority,
        idFactory,
        owner,
        history,
        options,
      );
    }

    return {
      idFactory,
      authority,
      factory,
    };
  }
}

////////////////////////////////////////////////////////////////////////////////
