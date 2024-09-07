import { ethers as EthersT } from 'ethers';
import {
  ModularCompliance,
  SupplyLimitModule,
  SupplyLimitModule__factory,
  Token,
  TransferRestrictModule,
  TransferRestrictModule__factory,
} from './artifacts';
import { TxOptions } from './types';
import { txWait } from './utils';
import { ChainConfig } from './ChainConfig';
import { getLogEventArgs } from '../test/utils';
import { FheERC3643Error } from './errors';
import { logStepMsg } from './log';
import { TokenAPI } from './TokenAPI';
import { ModularComplianceAPI } from './ModuleComplianceAPI';
import { ModuleAPI } from './ModuleAPI';

export class TransferRestrictModuleAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): TransferRestrictModule {
    const contract = TransferRestrictModule__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async fromToken(
    token: Token,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ): Promise<{ module: TransferRestrictModule; compliance: ModularCompliance }> {
    const compliance = await TokenAPI.compliance(token, runner);
    const modules = await ModularComplianceAPI.findModulesWithName(
      compliance,
      'TransferRestrictModule',
      runner,
      options,
    );
    if (modules.length > 1) {
      throw new FheERC3643Error('Too many TransferRestrictModule modules.');
    }
    if (modules.length === 0) {
      throw new FheERC3643Error('Compliance does not include any TransferRestrictModule.');
    }

    let contract = TransferRestrictModule__factory.connect(await modules[0].getAddress());

    if (runner !== undefined) {
      contract = contract.connect(runner);
    }

    return { module: contract, compliance };
  }

  static async deployNew(
    moduleImplementationOwner: EthersT.Signer,
    compliance: ModularCompliance,
    complianceOwner: EthersT.Signer,
    allowedAddresses: Array<EthersT.AddressLike>,
    chainConfig: ChainConfig,
    options?: TxOptions,
  ) {
    const imodule = await ModuleAPI.deployNew('TransferRestrictModule', moduleImplementationOwner);
    const transferRestrictModule = TransferRestrictModuleAPI.from(await imodule.getAddress(), chainConfig.provider);
    await ModularComplianceAPI.addModule(compliance, transferRestrictModule, complianceOwner);
    if (options?.progress) {
      options.progress.contractDeployed('TransferRestrictModule', await transferRestrictModule.getAddress());
    }
    await TransferRestrictModuleAPI.batchAllow(
      transferRestrictModule,
      compliance,
      allowedAddresses,
      complianceOwner,
      options,
    );

    return transferRestrictModule;
  }

  // compliance call
  static async batchAllow(
    module: TransferRestrictModule,
    compliance: ModularCompliance,
    allowedAddresses: EthersT.AddressLike[],
    signer: EthersT.Signer,
    options?: TxOptions,
  ) {
    const txReceipt = await txWait(
      compliance
        .connect(signer)
        .callModuleFunction(
          TransferRestrictModule__factory.createInterface().encodeFunctionData('batchAllowUsers', [allowedAddresses]),
          module,
        ),
    );
    return txReceipt;
  }
}
