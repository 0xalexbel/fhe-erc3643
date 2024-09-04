import { scope } from 'hardhat/config';
import { SCOPE_MODULE, SCOPE_MODULE_ADD, SCOPE_MODULE_NEW } from './task-names';
import { string, int } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import { Progress } from '../sdk/utils';
import {
  getHistoryPath,
  loadChainConfig,
  loadWalletFromIndexOrAliasOrAddressOrPrivateKey,
  logOK,
  throwIfInvalidAddress,
} from './utils';
import { ModuleAPI } from '../sdk/ModuleAPI';
import { ModularComplianceAPI } from '../sdk/ModuleComplianceAPI';
import { TokenAPI } from '../sdk/TokenAPI';

const moduleScope = scope(SCOPE_MODULE, 'Manage compliance modules');

//npx hardhat --network fhevm module new --name 'ConditionalTransferModule' --wallet admin (0x0B306BF915C4d645ff596e518fAf3F9669b97016)
//npx hardhat --network fhevm module new --name 'CountryRestrictModule' --wallet admin (0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE)
moduleScope
  .task(SCOPE_MODULE_NEW)
  .addParam('name', 'Module name (Ex: ConditionalTransferModule)', undefined, string)
  .addParam('wallet', 'Module implementation owner wallet', undefined, string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const implementationOwnerWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    const imodule = await ModuleAPI.deployNew(taskArgs.name, implementationOwnerWallet);

    logOK(`New '${taskArgs.name}' has been successfully deployed at ${await imodule.getAddress()}`);
  });

//npx hardhat --network fhevm module add --module 0xD0141E899a65C95a556fE2B27e5982A6DE7fDD7A --token 0xF421B91230B79e83972dA88A5EF5a583dc889649 --wallet token-agent
moduleScope
  .task(SCOPE_MODULE_ADD)
  .setDescription('Add a compliance module to an existing compliance registry or a token compliance registry.')
  .addParam('module', 'Address of the module to add', undefined, string)
  .addOptionalParam('compliance', 'Address of the compliance where the module will be added', undefined, string)
  .addOptionalParam('token', 'Address of the token where the module will be added', undefined, string)
  .addParam('wallet', 'Compliance owner wallet (usually equal to the token owner)', 'auto', string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    throwIfInvalidAddress(taskArgs.module, hre);

    let complianceAddress: string;
    if (taskArgs.token) {
      throwIfInvalidAddress(taskArgs.token, hre);

      const token = TokenAPI.from(taskArgs.token, chainConfig.provider);
      complianceAddress = await token.compliance();
    } else if (taskArgs.compliance) {
      throwIfInvalidAddress(taskArgs.compliance, hre);

      complianceAddress = taskArgs.compliance;
    } else {
      throw new Error(`Missing compliance, please specify either the --compliance or the --token parameter.`);
    }

    const complianceOwnerWallet =
      taskArgs.wallet === 'auto'
        ? await chainConfig.getOwnerWallet(complianceAddress)
        : loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    const compliance = await ModularComplianceAPI.fromWithOwner(complianceAddress, complianceOwnerWallet);
    const imodule = ModuleAPI.from(taskArgs.module, chainConfig.provider);

    await ModularComplianceAPI.addModule(compliance, imodule, complianceOwnerWallet, {
      progress: new Progress(1),
      confirms: 1,
      chainConfig,
    });

    logOK(`Module '${taskArgs.module}' has been successfully added to compliance ${await compliance.getAddress()}`);
  });

/*
A module a no owner!
A module proxy has a owner!

    // ConditionalTransferModule: ownable
    const moduleImplementaton = await ethers.deployContract('ConditionalTransferModule');
//0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1) and
bytes32(uint256(keccak256('eip1967.proxy.admin')) - 1) respectively.

await provider.getStorageAt(address, slot);

    // ModuleProxy: no owner!
    const proxy = await ethers.deployContract('ModuleProxy', [
      module,
      module.interface.encodeFunctionData('initialize'),
    ]);

    const conditionalTransferModule = await ethers.getContractAt('ConditionalTransferModule', proxy);



  compliance.addModule(m)

  m.bindCompliance(compliance)

  compliance est bindé au module
  un module peut etre connecte a plusieurs compliances differentes

  ne peut etre appele que par le owner du compliance!
  batchAllowCountries doit etre appele par une compliance!! pour se faire on a CallModuleFunction
  le compliance autorise une liste de countries!
  
  A compliance has a owner
  Only the compliance owner can add a module

  // module.bindCompliance(address(this));
  // le sender doit etre binder " bindCompliance"

    const context = await deployComplianceFixture();
    const { compliance } = context.suite;

    const module = await ethers.deployContract('ConditionalTransferModule');
    const proxy = await ethers.deployContract('ModuleProxy', [
      module,
      module.interface.encodeFunctionData('initialize'),
    ]);
    const conditionalTransferModule = await ethers.getContractAt('ConditionalTransferModule', proxy);

    await compliance.addModule(conditionalTransferModule);

    const mockContract = await ethers.deployContract('MockContract');

    await compliance.bindToken(mockContract);

    return { ...context, suite: { ...context.suite, conditionalTransferModule, mockContract } };

  */
