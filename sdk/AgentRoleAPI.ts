import { ethers as EthersT } from 'ethers';
import { AgentRole, AgentRole__factory } from './artifacts';
import { TxOptions, WalletResolver } from './types';
import { txWait } from './utils';

export class AgentRoleAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): AgentRole {
    const contract = AgentRole__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async fromWithOwner(address: string, owner: EthersT.Signer) {
    const contract = AgentRole__factory.connect(address, owner);

    const contractOwnerAddress = await contract.owner();
    const ownerAddress = await owner.getAddress();
    if (contractOwnerAddress !== ownerAddress) {
      throw new Error(
        `owner ${ownerAddress} is not the owner of contract ${address}, the actual owner is ${contractOwnerAddress}`,
      );
    }

    return contract;
  }

  /**
   * Permissions: must be owner of the token's identity registry (usually == token's owner, see deploy suite func)
   */
  static async addAgent(
    agentRole: AgentRole,
    newAgent: EthersT.AddressLike,
    owner: EthersT.Signer,
    options: TxOptions,
  ) {
    if (await agentRole.connect(owner).isAgent(newAgent)) {
      return;
    }
    await txWait(agentRole.connect(owner).addAgent(newAgent), options);
  }

  /**
   * Permissions: must be owner of the token's identity registry (usually == token's owner, see deploy suite func)
   */
  static async removeAgent(
    agentRole: AgentRole,
    newAgent: EthersT.AddressLike,
    owner: EthersT.Signer,
    options: TxOptions,
  ) {
    if (!(await agentRole.connect(owner).isAgent(newAgent))) {
      return;
    }
    await txWait(agentRole.connect(owner).removeAgent(newAgent), options);
  }

  static async searchAgents(agentRole: AgentRole, walletResolver: WalletResolver) {
    const res: Array<{ address: string; alias: { index: number; names: string[] } }> = [];
    for (let i = 0; i < 10; ++i) {
      const address = walletResolver.getWalletAt(i, null).address;
      if (await agentRole.isAgent(address)) {
        res.push({ address, alias: { index: i, names: walletResolver.getWalletNamesAt(i) } });
      }
    }
    return res;
  }
}
