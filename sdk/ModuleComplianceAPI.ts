import { ethers as EthersT } from 'ethers';
import {
  ClaimTopicsRegistry,
  ClaimTopicsRegistry__factory,
  IModule,
  IModule__factory,
  ModularCompliance,
  ModularCompliance__factory,
} from './artifacts';
import { TxOptions } from './types';
import { txWait } from './utils';

export class ModularComplianceAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): ModularCompliance {
    const contract = ModularCompliance__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async fromWithOwner(address: string, owner: EthersT.Signer) {
    const contract = ModularCompliance__factory.connect(address, owner);

    const contractOwnerAddress = await contract.owner();
    const ownerAddress = await owner.getAddress();
    if (contractOwnerAddress !== ownerAddress) {
      throw new Error(
        `owner ${ownerAddress} is not the owner of the ModularCompliance ${address}, the actual owner is ${contractOwnerAddress}`,
      );
    }

    return contract;
  }

  /**
   * Requirements:
   * - ModularCompliance.owner === owner
   */
  static async addModule(compliance: ModularCompliance, module: IModule, owner: EthersT.Signer, options?: TxOptions) {
    const moduleAddress = await module.getAddress();
    if (moduleAddress === EthersT.ZeroAddress) {
      throw new Error(`Invalid module address ${moduleAddress}`);
    }

    const hasModule = await this.hasModule(compliance, module, owner, options);
    if (hasModule) {
      // already added
      return;
    }

    const isPlugAndPlay = await module.isPlugAndPlay();
    if (!isPlugAndPlay) {
      const canComplianceBind = await module.canComplianceBind(compliance);
      if (!canComplianceBind) {
        throw new Error(
          `compliance ${await compliance.getAddress()} is not suitable for binding to the module ${moduleAddress}`,
        );
      }
    }

    await txWait(compliance.connect(owner).addModule(module), options);
  }

  static async hasModule(
    compliance: ModularCompliance,
    module: IModule,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ) {
    return compliance.connect(runner).isModuleBound(module);
  }

  /**
   * Permission: public
   */
  static async findModulesWithName(
    compliance: ModularCompliance,
    name: string,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ) {
    const moduleAddresses = await compliance.getModules();

    const imodules: IModule[] = [];
    for (let i = 0; i < moduleAddresses.length; ++i) {
      const imodule = IModule__factory.connect(moduleAddresses[i]).connect(runner);
      const _name = await imodule.name();
      if (name === _name) {
        imodules.push(imodule);
      }
    }

    return imodules;
  }
}
