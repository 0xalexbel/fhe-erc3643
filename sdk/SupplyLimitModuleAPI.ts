import { ethers as EthersT } from 'ethers';
import { ModularCompliance, SupplyLimitModule, SupplyLimitModule__factory, Token } from './artifacts';
import { CryptEngine, TxOptions } from './types';
import { txWait } from './utils';
import { getLogEventArgs } from '../test/utils';
import { FheERC3643Error } from './errors';
import { TokenAPI } from './TokenAPI';
import { ModularComplianceAPI } from './ModuleComplianceAPI';
import { ModuleAPI } from './ModuleAPI';
import { logStepDeployOK } from './log';

export class SupplyLimitModuleAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): SupplyLimitModule {
    const contract = SupplyLimitModule__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async fromToken(
    token: Token,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ): Promise<{ module: SupplyLimitModule; compliance: ModularCompliance }> {
    const compliance = await TokenAPI.compliance(token, runner);
    const modules = await ModularComplianceAPI.findModulesWithName(compliance, 'SupplyLimitModule', runner, options);
    if (modules.length > 1) {
      throw new FheERC3643Error('Too many supply limit modules.');
    }
    if (modules.length === 0) {
      throw new FheERC3643Error('Compliance does not include any supply limit module.');
    }

    let contract = SupplyLimitModule__factory.connect(await modules[0].getAddress());

    if (runner !== undefined) {
      contract = contract.connect(runner);
    }

    return { module: contract, compliance };
  }

  static async deployNew(
    moduleImplementationOwner: EthersT.Signer,
    compliance: ModularCompliance,
    complianceOwner: EthersT.Signer,
    initialLimit: bigint,
    cryptEngine: CryptEngine,
    runner: EthersT.ContractRunner,
    options: TxOptions,
  ) {
    const imodule = await ModuleAPI.deployNew('SupplyLimitModule', moduleImplementationOwner);
    const supplyLimitModule = SupplyLimitModuleAPI.from(await imodule.getAddress(), runner);
    await ModularComplianceAPI.addModule(compliance, supplyLimitModule, complianceOwner, options);

    await logStepDeployOK('SupplyLimitModule', await supplyLimitModule.getAddress(), options);

    await SupplyLimitModuleAPI.setSupplyLimit(
      supplyLimitModule,
      compliance,
      initialLimit,
      complianceOwner,
      cryptEngine,
      options,
    );

    return supplyLimitModule;
  }

  static async getSupplyLimit(
    module: SupplyLimitModule,
    compliance: ModularCompliance,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ) {
    const encSupplyLimit = await module.connect(runner).getSupplyLimit(compliance);
    return encSupplyLimit;
  }

  static async setSupplyLimit(
    module: SupplyLimitModule,
    compliance: ModularCompliance,
    amount: bigint,
    signer: EthersT.Signer,
    cryptEngine: CryptEngine,
    options: TxOptions,
  ) {
    const encAmount = await cryptEngine.encrypt64(module, compliance, amount);

    const txReceipt = await txWait(
      compliance
        .connect(signer)
        .callModuleFunction(
          new EthersT.Interface(['function setSupplyLimit(bytes32,bytes)']).encodeFunctionData('setSupplyLimit', [
            encAmount.handles[0],
            encAmount.inputProof,
          ]),
          module,
        ),
      options,
    );

    const args = getLogEventArgs(txReceipt, 'SupplyLimitSet', undefined, module);
    if (args.length !== 2) {
      throw new FheERC3643Error(`Failed to set the supply limit`);
    }
    if (args[0] !== (await compliance.getAddress())) {
      throw new FheERC3643Error(`Failed to set the supply limit`);
    }
    if (args[1] !== EthersT.toBigInt(encAmount.handles[0])) {
      throw new FheERC3643Error(`Failed to set the supply limit`);
    }
  }
}
