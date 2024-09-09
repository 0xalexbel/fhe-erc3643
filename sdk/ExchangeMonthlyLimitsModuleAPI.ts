import { ethers as EthersT } from 'ethers';
import {
  Identity,
  ModularCompliance,
  ExchangeMonthlyLimitsModule,
  ExchangeMonthlyLimitsModule__factory,
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

export class ExchangeMonthlyLimitsModuleAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): ExchangeMonthlyLimitsModule {
    const contract = ExchangeMonthlyLimitsModule__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async fromToken(
    token: Token,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ): Promise<{ module: ExchangeMonthlyLimitsModule; compliance: ModularCompliance }> {
    const compliance = await TokenAPI.compliance(token, runner);
    const modules = await ModularComplianceAPI.findModulesWithName(
      compliance,
      'ExchangeMonthlyLimitsModule',
      runner,
      options,
    );
    if (modules.length > 1) {
      throw new FheERC3643Error('Too many ExchangeMonthlyLimitsModule.');
    }
    if (modules.length === 0) {
      throw new FheERC3643Error('Compliance does not include any ExchangeMonthlyLimitsModule.');
    }

    let contract = ExchangeMonthlyLimitsModule__factory.connect(await modules[0].getAddress());

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
    options: TxOptions,
  ) {
    const imodule = await ModuleAPI.deployNew('ExchangeMonthlyLimitsModule', moduleImplementationOwner);
    const exchangeMonthlyLimitsModule = ExchangeMonthlyLimitsModuleAPI.from(
      await imodule.getAddress(),
      chainConfig.provider,
    );
    await ModularComplianceAPI.addModule(compliance, exchangeMonthlyLimitsModule, complianceOwner, options);
    if (options?.progress) {
      options.progress.contractDeployed('ExchangeMonthlyLimitsModule', await exchangeMonthlyLimitsModule.getAddress());
    }

    return exchangeMonthlyLimitsModule;
  }

  static async isExchangeID(
    module: ExchangeMonthlyLimitsModule,
    identity: Identity,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ) {
    return await module.connect(runner).isExchangeID(identity);
  }

  static async addExchangeID(
    module: ExchangeMonthlyLimitsModule,
    identity: Identity,
    owner: EthersT.Signer,
    chainConfig: ChainConfig,
    options: TxOptions,
  ) {
    await throwIfNotOwner('ExchangeMonthlyLimitsModule', chainConfig, module, owner);

    if (await module.connect(owner).isExchangeID(identity)) {
      return;
    }

    const txReceipt = await txWait(module.connect(owner).addExchangeID(identity), options);

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
    module: ExchangeMonthlyLimitsModule,
    identity: Identity,
    owner: EthersT.Signer,
    chainConfig: ChainConfig,
    options: TxOptions,
  ) {
    await throwIfNotOwner('ExchangeMonthlyLimitsModule', chainConfig, module, owner);

    if (!(await module.connect(owner).isExchangeID(identity))) {
      return;
    }

    const txReceipt = await txWait(module.connect(owner).removeExchangeID(identity), options);

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
  /*
              await context.suite.compliance.callModuleFunction(
                new ethers.Interface([
                  'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
                ]).encodeFunctionData('setExchangeMonthlyLimit', [exchangeID, 100]),
                context.suite.complianceModule,
              );

*/
  /*
    function setExchangeMonthlyLimit(
        address _exchangeID,
        uint256 _newExchangeMonthlyLimit

*/

  static async setExchangeMonthlyLimit(
    module: ExchangeMonthlyLimitsModule,
    compliance: ModularCompliance,
    exchangeId: Identity,
    newExchangeMonthlyLimit: bigint,
    signer: EthersT.Signer,
    chainConfig: ChainConfig,
    options: TxOptions,
  ) {
    const exchangeIdAddress = await exchangeId.getAddress();
    const txReceipt = await txWait(
      compliance.connect(signer).callModuleFunction(
        ExchangeMonthlyLimitsModule__factory.createInterface().encodeFunctionData('setExchangeMonthlyLimit', [
          exchangeIdAddress,
          newExchangeMonthlyLimit,
        ]),
        // ExchangeMonthlyLimitsModule__factory.createInterface().encodeFunctionData(
        //   'setExchangeMonthlyLimit(address,uint32,bytes32,bytes)',
        //   [identityAddress, timeLimit, encValueLimit.handles[0], encValueLimit.inputProof],
        // ),
        module,
      ),
      options,
    );

    const args = getLogEventArgs(txReceipt, 'ExchangeMonthlyLimitUpdated', undefined, module);
    if (args.length !== 3) {
      throw new FheERC3643Error(`Failed to set the monthly limit`);
    }
    if (args[0] !== (await compliance.getAddress())) {
      throw new FheERC3643Error(`Failed to set the monthly limit`);
    }
    if (args[1] !== (await exchangeId.getAddress())) {
      throw new FheERC3643Error(`Failed to set the monthly limit`);
    }
    if (EthersT.toBigInt(args[2]) !== newExchangeMonthlyLimit) {
      throw new FheERC3643Error(`Failed to set the monthly limit`);
    }
  }

  //   static async getExchangeLimits(
  //     module: ExchangeMonthlyLimitsModule,
  //     compliance: ModularCompliance,
  //     identity: Identity,
  //     chainConfig: ChainConfig,
  //     options?: TxOptions,
  //   ) {
  //     const res = await module.connect(chainConfig.provider).getExchangeLimits(compliance, identity);

  //     const output: Array<{ timeLimit: bigint; valueLimitFhevmHandle: bigint }> = [];
  //     for (let i = 0; i < res.length; ++i) {
  //       output.push({
  //         timeLimit: res[i][0],
  //         valueLimitFhevmHandle: res[i][1],
  //       });
  //     }

  //     return output;
  //   }
}
