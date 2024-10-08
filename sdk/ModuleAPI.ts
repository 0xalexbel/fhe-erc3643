import { ethers as EthersT } from 'ethers';
import {
  ClaimTopicsRegistry,
  ConditionalTransferModule__factory,
  IModule,
  IModule__factory,
  ModuleProxy__factory,
} from './artifacts';
import { TxOptions } from './types';
import path from 'path';
import { txWait } from './utils';

async function importModuleArtifactFromName(name: string) {
  const p = `artifacts/contracts/fhe-trex/compliance/modular/modules/${name}.sol/${name}.json`;
  return import(path.join('..', p));
}

export class ModuleAPI {
  /**
   * Permissions: public.
   */
  static from(address: string, runner?: EthersT.ContractRunner | null): IModule {
    const contract = IModule__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  /**
   * Permissions: public.
   */
  static async deployNew(moduleContractName: string, moduleImplementationOwner: EthersT.Signer, options?: TxOptions) {
    const artifact = await importModuleArtifactFromName(moduleContractName);

    const factory = new EthersT.ContractFactory(artifact.abi, artifact.bytecode);
    const moduleImplementaton = await factory.connect(moduleImplementationOwner).deploy();
    await moduleImplementaton.waitForDeployment();
    const moduleImplementatonAddress = await moduleImplementaton.getAddress();

    if (options) {
      if (options.progress) {
        options.progress.logStepDeployed(moduleContractName, moduleImplementatonAddress);
      }
    }

    const dataArg = moduleImplementaton.interface.encodeFunctionData('initialize');

    const proxyFactory = new ModuleProxy__factory();
    const proxy = await proxyFactory.connect(moduleImplementationOwner).deploy(moduleImplementaton, dataArg);
    await proxy.waitForDeployment();

    const proxyAddress = await proxy.getAddress();

    if (options) {
      if (options.progress) {
        options.progress.logStepDeployed('ModuleProxy', proxyAddress);
      }
    }

    return IModule__factory.connect(proxyAddress, moduleImplementationOwner);
  }

  static async deployNewConditionalTransferModule(moduleImplementationOwner: EthersT.Signer, options?: TxOptions) {
    const imodule = await this.deployNew('ConditionalTransferModule', moduleImplementationOwner, options);
    const addr = await imodule.getAddress();
    return ConditionalTransferModule__factory.connect(addr, moduleImplementationOwner);
  }
}
