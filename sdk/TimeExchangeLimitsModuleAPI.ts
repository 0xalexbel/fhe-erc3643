import { ethers as EthersT } from 'ethers';
import {
  Identity,
  ModularCompliance,
  TimeExchangeLimitsModule,
  TimeExchangeLimitsModule__factory,
  Token,
} from './artifacts';
import { TxOptions } from './types';
import { txWait } from './utils';
import { ChainConfig } from './ChainConfig';
import { getLogEventArgs } from '../test/utils';
import { FheERC3643Error, throwIfNotOwner } from './errors';
import { TokenAPI } from './TokenAPI';
import { ModularComplianceAPI } from './ModuleComplianceAPI';
import { ModuleAPI } from './ModuleAPI';

export class TimeExchangeLimitsModuleAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): TimeExchangeLimitsModule {
    const contract = TimeExchangeLimitsModule__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async fromToken(
    token: Token,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ): Promise<{ module: TimeExchangeLimitsModule; compliance: ModularCompliance }> {
    const compliance = await TokenAPI.compliance(token, runner);
    const modules = await ModularComplianceAPI.findModulesWithName(
      compliance,
      'TimeExchangeLimitsModule',
      runner,
      options,
    );
    if (modules.length > 1) {
      throw new FheERC3643Error('Too many TimeExchangeLimitsModule.');
    }
    if (modules.length === 0) {
      throw new FheERC3643Error('Compliance does not include any TimeExchangeLimitsModule.');
    }

    let contract = TimeExchangeLimitsModule__factory.connect(await modules[0].getAddress());

    if (runner !== undefined) {
      contract = contract.connect(runner);
    }

    return { module: contract, compliance };
  }

  static async deployNew(
    moduleImplementationOwner: EthersT.Signer,
    compliance: ModularCompliance,
    complianceOwner: EthersT.Signer,
    chainConfig: ChainConfig,
    options?: TxOptions,
  ) {
    const imodule = await ModuleAPI.deployNew('TimeExchangeLimitsModule', moduleImplementationOwner);
    const timeExchangeLimitsModule = TimeExchangeLimitsModuleAPI.from(await imodule.getAddress(), chainConfig.provider);
    await ModularComplianceAPI.addModule(compliance, timeExchangeLimitsModule, complianceOwner);
    if (options?.progress) {
      options.progress.contractDeployed('TimeExchangeLimitsModule', await timeExchangeLimitsModule.getAddress());
    }

    return timeExchangeLimitsModule;
  }

  static async isExchangeID(
    module: TimeExchangeLimitsModule,
    identity: Identity,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ) {
    return await module.connect(runner).isExchangeID(identity);
  }

  static async addExchangeID(
    module: TimeExchangeLimitsModule,
    identity: Identity,
    owner: EthersT.Signer,
    chainConfig: ChainConfig,
    options?: TxOptions,
  ) {
    await throwIfNotOwner('TimeExchangeLimitsModule', chainConfig, module, owner);

    if (await module.connect(owner).isExchangeID(identity)) {
      return;
    }

    const txReceipt = await txWait(module.connect(owner).addExchangeID(identity));

    const args = getLogEventArgs(txReceipt, 'ExchangeIDAdded', undefined, module);
    if (args.length !== 1) {
      throw new FheERC3643Error(`Failed to add exchange ID`);
    }
    if (args[0] !== (await identity.getAddress())) {
      throw new FheERC3643Error(`Failed to add exchange ID`);
    }
    if (!(await module.isExchangeID(identity))) {
      throw new FheERC3643Error(`Failed to add exchange ID (Tx is not completed)`);
    }
  }

  static async removeExchangeID(
    module: TimeExchangeLimitsModule,
    identity: Identity,
    owner: EthersT.Signer,
    chainConfig: ChainConfig,
    options?: TxOptions,
  ) {
    await throwIfNotOwner('TimeExchangeLimitsModule', chainConfig, module, owner);

    if (!(await module.connect(owner).isExchangeID(identity))) {
      return;
    }

    const txReceipt = await txWait(module.connect(owner).removeExchangeID(identity));

    const args = getLogEventArgs(txReceipt, 'ExchangeIDRemoved', undefined, module);
    if (args.length !== 1) {
      throw new FheERC3643Error(`Failed to remove exchange ID`);
    }
    if (args[0] !== (await identity.getAddress())) {
      throw new FheERC3643Error(`Failed to remove exchange ID`);
    }
    if (await module.isExchangeID(identity)) {
      throw new FheERC3643Error(`Failed to remove exchange ID (Tx is not completed)`);
    }
  }
}
