import { ethers as EthersT } from 'ethers';
import { IdFactory, IdFactory__factory, ImplementationAuthority, ImplementationAuthority__factory } from './artifacts';
import { TxOptions } from './types';
import { IdentityImplementationAuthorityAPI } from './IdentityImplementationAuthorityAPI';
import { isDeployed } from './utils';

export class IdFactoryAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): IdFactory {
    const contract = IdFactory__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static fromSafe(address: string, runner: EthersT.ContractRunner): IdFactory {
    if (!runner.provider) {
      throw new Error('ContractRunner has no provider');
    }

    const contract = IdFactory__factory.connect(address);

    if (!isDeployed(runner.provider, address)) {
      throw new Error(`IdFactory ${address} is not deployed`);
    }

    return contract.connect(runner);
  }

  // Public
  static async deployNewIdentity(
    idFactory: IdFactory,
    initialManagementKey: EthersT.AddressLike,
    deployer: EthersT.Signer,
    options?: TxOptions,
  ) {
    const implementationAuthorityAddress = await idFactory.connect(deployer).implementationAuthority();
    const implementationAuthority = ImplementationAuthority__factory.connect(implementationAuthorityAddress);
    return IdentityImplementationAuthorityAPI.deployNewIdentity(
      implementationAuthority,
      initialManagementKey,
      deployer,
      options,
    );
  }

  static async fromWithOwner(address: string, owner: EthersT.Signer) {
    const idFactory = this.from(address, owner);
    const implementationAuthorityAddress = await idFactory.implementationAuthority();
    const implementationAuthority: ImplementationAuthority = ImplementationAuthority__factory.connect(
      implementationAuthorityAddress,
      owner,
    );

    if ((await idFactory.owner()) !== (await owner.getAddress())) {
      throw new Error('signer is not the owner of idFactory.owner');
    }

    if ((await implementationAuthority.owner()) !== (await owner.getAddress())) {
      throw new Error('signer is not the owner of idFactory.implementationAuthority.owner');
    }

    return {
      idFactory,
      implementationAuthority,
    };
  }
}
