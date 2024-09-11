import { ethers as EthersT } from 'ethers';
import { History, TxOptions } from './types';
import {
  Identity,
  Identity__factory,
  IdentityProxy__factory,
  IdFactory,
  IdFactory__factory,
  ImplementationAuthority,
  ImplementationAuthority__factory,
} from './artifacts';
import { IdentityAPI } from './IdentityAPI';
import { IdFactoryAPI } from './IdFactoryAPI';
import { logStepDeployOK } from './log';

////////////////////////////////////////////////////////////////////////////////

export class IdentityImplementationAuthorityAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): ImplementationAuthority {
    const contract = ImplementationAuthority__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  // Public
  static async deployNewIdentity(
    authority: ImplementationAuthority,
    initialManagementKey: EthersT.AddressLike,
    deployer: EthersT.Signer,
    history: History,
    options?: TxOptions,
  ) {
    const proxyFactory = new IdentityProxy__factory();
    const proxy = await proxyFactory.connect(deployer).deploy(authority, initialManagementKey);
    await proxy.waitForDeployment();

    const identityAddress = await proxy.getAddress();

    await logStepDeployOK('IdentityProxy', identityAddress, options);
    await history.saveContract(identityAddress, 'IdentityProxy');

    const newIdentity = IdentityAPI.from(identityAddress, deployer);

    return newIdentity;
  }

  static async loadOrDeployIdFactory(
    idFactory: string | null | undefined,
    owner: EthersT.Signer,
    history: History,
    options?: TxOptions,
  ) {
    if (idFactory) {
      return (await IdFactoryAPI.fromWithOwner(idFactory, owner)).idFactory;
    } else {
      return (await this.deployNewIdFactory(owner, history, options)).idFactory;
    }
  }

  static async deployNewIdFactory(deployer: EthersT.Signer, history: History, options?: TxOptions) {
    const { implementationAuthority, identityImplementation } = await this.deployNewIdentityImplementationAuthority(
      deployer,
      options,
    );
    const idFactoryFactory = new IdFactory__factory();
    const idFactory: IdFactory = await idFactoryFactory.connect(deployer).deploy(implementationAuthority);
    await idFactory.waitForDeployment();

    const idFactoryAddress = await idFactory.getAddress();
    await logStepDeployOK('IdFactory', idFactoryAddress, options);
    await history.saveContract(idFactoryAddress, 'IdFactory');

    return {
      idFactory,
      implementationAuthority,
      identityImplementation,
    };
  }

  static async deployNewIdentityImplementationAuthority(deployer: EthersT.Signer, options?: TxOptions) {
    const identityFactory = new Identity__factory();

    const identityImplementation: Identity = await identityFactory.connect(deployer).deploy(deployer, true);
    await identityImplementation.waitForDeployment();

    await logStepDeployOK('Identity', await identityImplementation.getAddress(), options);

    // deploy a new ImplementationAuthority that owns the official Identity bytecode
    const implementationAuthorityFactory = new ImplementationAuthority__factory();
    const implementationAuthority: ImplementationAuthority = await implementationAuthorityFactory
      .connect(deployer)
      .deploy(identityImplementation);
    await implementationAuthority.waitForDeployment();

    const impl = await implementationAuthority.getImplementation();
    if (impl !== (await identityImplementation.getAddress())) {
      throw new Error('ImplementationAuthority deployement failed.');
    }

    await logStepDeployOK('ImplementationAuthority', await implementationAuthority.getAddress(), options);

    return {
      implementationAuthority,
      identityImplementation,
    };
  }
}
