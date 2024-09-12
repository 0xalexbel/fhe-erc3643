import { ethers as EthersT } from 'ethers';
import {
  Identity,
  ModularCompliance,
  TimeExchangeLimitsModule,
  TimeExchangeLimitsModule__factory,
  Token,
} from './artifacts';
import { CryptEngine, TxOptions, WalletResolver } from './types';
import { queryLogEventArgs, txWait } from './utils';
import { FheERC3643Error, throwIfNotOwner } from './errors';
import { TokenAPI } from './TokenAPI';
import { ModularComplianceAPI } from './ModuleComplianceAPI';
import { ModuleAPI } from './ModuleAPI';
import { logStepDeployOK } from './log';

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
    runner: EthersT.ContractRunner,
    options: TxOptions,
  ) {
    const imodule = await ModuleAPI.deployNew('TimeExchangeLimitsModule', moduleImplementationOwner);
    const timeExchangeLimitsModule = TimeExchangeLimitsModuleAPI.from(await imodule.getAddress(), runner);
    await ModularComplianceAPI.addModule(compliance, timeExchangeLimitsModule, complianceOwner, options);

    await logStepDeployOK('TimeExchangeLimitsModule', await timeExchangeLimitsModule.getAddress(), options);

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
    provider: EthersT.Provider,
    walletResolver: WalletResolver,
    options: TxOptions,
  ) {
    await throwIfNotOwner('TimeExchangeLimitsModule', module, owner, provider, walletResolver);

    if (await module.connect(owner).isExchangeID(identity)) {
      return;
    }

    const txReceipt = await txWait(module.connect(owner).addExchangeID(identity), options);

    const args = queryLogEventArgs(txReceipt, 'ExchangeIDAdded', module.interface);
    if (!args || args.length !== 1) {
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
    provider: EthersT.Provider,
    walletResolver: WalletResolver,
    options: TxOptions,
  ) {
    await throwIfNotOwner('TimeExchangeLimitsModule', module, owner, provider, walletResolver);

    if (!(await module.connect(owner).isExchangeID(identity))) {
      return;
    }

    const txReceipt = await txWait(module.connect(owner).removeExchangeID(identity), options);

    const args = queryLogEventArgs(txReceipt, 'ExchangeIDRemoved', module.interface);
    if (!args || args.length !== 1) {
      throw new FheERC3643Error(`Failed to remove exchange ID`);
    }
    if (args[0] !== (await identity.getAddress())) {
      throw new FheERC3643Error(`Failed to remove exchange ID`);
    }
    if (await module.isExchangeID(identity)) {
      throw new FheERC3643Error(`Failed to remove exchange ID (Tx is not completed)`);
    }
  }

  static async setExchangeLimits(
    module: TimeExchangeLimitsModule,
    compliance: ModularCompliance,
    identity: Identity,
    timeLimit: number,
    valueLimit: bigint,
    signer: EthersT.Signer,
    cryptEngine: CryptEngine,
    options: TxOptions,
  ) {
    const encValueLimit = await cryptEngine.encrypt64(module, compliance, valueLimit);

    const identityAddress = await identity.getAddress();
    const txReceipt = await txWait(
      compliance
        .connect(signer)
        .callModuleFunction(
          TimeExchangeLimitsModule__factory.createInterface().encodeFunctionData(
            'setExchangeLimit(address,uint32,bytes32,bytes)',
            [identityAddress, timeLimit, encValueLimit.handles[0], encValueLimit.inputProof],
          ),
          module,
        ),
      options,
    );

    const args = queryLogEventArgs(txReceipt, 'ExchangeLimitUpdated', module.interface);
    if (!args || args.length !== 4) {
      throw new FheERC3643Error(`Failed to set the supply limit`);
    }
    if (args[0] !== (await compliance.getAddress())) {
      throw new FheERC3643Error(`Failed to set the supply limit`);
    }
    if (args[1] !== (await identity.getAddress())) {
      throw new FheERC3643Error(`Failed to set the supply limit`);
    }
    if (args[2] !== EthersT.toBigInt(encValueLimit.handles[0])) {
      throw new FheERC3643Error(`Failed to set the supply limit`);
    }
    if (EthersT.toBigInt(args[3]) !== EthersT.toBigInt(timeLimit)) {
      throw new FheERC3643Error(`Failed to set the supply limit`);
    }
  }

  static async getExchangeLimits(
    module: TimeExchangeLimitsModule,
    compliance: ModularCompliance,
    identity: Identity,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ) {
    const res = await module.connect(runner).getExchangeLimits(compliance, identity);

    const output: Array<{ timeLimit: bigint; valueLimitFhevmHandle: bigint }> = [];
    for (let i = 0; i < res.length; ++i) {
      output.push({
        timeLimit: res[i][0],
        valueLimitFhevmHandle: res[i][1],
      });
    }

    return output;
  }
}
