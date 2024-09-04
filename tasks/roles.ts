import { scope } from 'hardhat/config';
import { string, int } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import {
  getHistoryPath,
  loadAddressFromWalletIndexOrAliasOrAddress,
  loadChainConfig,
  loadWalletArgs,
  loadWalletFromIndexOrAliasOrAddressOrPrivateKey,
  logInfo,
  logOK,
} from './utils';
import { SCOPE_ROLES, SCOPE_ROLES_ADD_AGENT, SCOPE_ROLES_LIST_AGENTS, SCOPE_ROLES_REMOVE_AGENT } from './task-names';
import { AgentRoleAPI } from '../sdk/AgentRoleAPI';

const rolesScope = scope(SCOPE_ROLES, 'Manage roles');

//npx hardhat --network fhevm roles add-agent --target 0x28E26Af9bE48753Fea9341d89C5390df09333ab4 --wallet 0x90F79bf6EB2c4f870365E785982E1f101E93b906 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
//npx hardhat --network fhevm roles add-agent --target 0x28E26Af9bE48753Fea9341d89C5390df09333ab4 --wallet 3 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
//npx hardhat --network fhevm roles add-agent --target 0x28E26Af9bE48753Fea9341d89C5390df09333ab4 --wallet 3 3
//npx hardhat --network fhevm roles add-agent --target 0x28E26Af9bE48753Fea9341d89C5390df09333ab4 --wallet auto 3
//npx hardhat --network fhevm roles add-agent --target 0x28E26Af9bE48753Fea9341d89C5390df09333ab4 3
//npx hardhat --network fhevm roles add-agent --target 0x28E26Af9bE48753Fea9341d89C5390df09333ab4 4
//npx hardhat --network fhevm roles add-agent --target 0x28E26Af9bE48753Fea9341d89C5390df09333ab4 alice
//npx hardhat --network fhevm roles add-agent --target 0x28E26Af9bE48753Fea9341d89C5390df09333ab4 --wallet alice alice
rolesScope
  .task(SCOPE_ROLES_ADD_AGENT)
  .addPositionalParam('address', 'The address or wallet index of the future agent', undefined, string)
  .addParam('target', 'The contract accepting agents', undefined, string)
  .addOptionalParam('wallet', 'The target owner wallet', 'auto', string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const address = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.address);

    const agentRoleOwner =
      taskArgs.wallet === 'auto'
        ? await chainConfig.getOwnerWallet(taskArgs.target)
        : loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    const agentRole = await AgentRoleAPI.fromWithOwner(taskArgs.target, agentRoleOwner);

    if (await agentRole.isAgent(address)) {
      logInfo(`Address '${taskArgs.address}' is already an agent of '${taskArgs.target}'`);
      return;
    }

    await AgentRoleAPI.addAgent(agentRole, address, agentRoleOwner);

    logOK(`Address '${taskArgs.address}' has been added to the agent list of '${taskArgs.target}'`);
  });

//npx hardhat --network fhevm roles remove-agent --target 0x7bdbbF093a6eB6Decf21243473cfFf7BD10989Ab --wallet super-bank admin
rolesScope
  .task(SCOPE_ROLES_REMOVE_AGENT)
  .addPositionalParam('address', 'The address or wallet index of the agent to be removed', undefined, string)
  .addParam('target', 'The contract accepting agents', undefined, string)
  .addOptionalParam('wallet', 'The target owner wallet', 'auto', string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const address = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.address);

    const agentRoleOwner =
      taskArgs.wallet === 'auto'
        ? await chainConfig.getOwnerWallet(taskArgs.target)
        : loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    const agentRole = await AgentRoleAPI.fromWithOwner(taskArgs.target, agentRoleOwner);

    if (!(await agentRole.isAgent(address))) {
      logInfo(`Address '${taskArgs.address}' is not an agent of '${taskArgs.target}'`);
      return;
    }

    await AgentRoleAPI.removeAgent(agentRole, address, agentRoleOwner);

    logOK(`Address '${taskArgs.address}' has been removed from the agent list of '${taskArgs.target}'`);
  });

//npx hardhat --network fhevm roles list-agents 0x7bdbbF093a6eB6Decf21243473cfFf7BD10989Ab
rolesScope
  .task(SCOPE_ROLES_LIST_AGENTS)
  .addPositionalParam('address', 'The contract accepting agents', undefined, string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const address = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.address);
    const agentRole = AgentRoleAPI.from(address, chainConfig.provider);
    const agents = await AgentRoleAPI.searchAgentsInAgentRole(agentRole, chainConfig);

    console.log(agents);
  });
