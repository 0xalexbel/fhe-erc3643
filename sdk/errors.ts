import { ethers as EthersT } from 'ethers';

import { NomicLabsHardhatPluginError } from 'hardhat/plugins';
import { getContractOwner, isDeployed } from './utils';
import { ChainConfig } from './ChainConfig';
import { WalletResolver } from './types';
import { AgentRole, AgentRole__factory } from '../types';

export class FheERC3643Error extends NomicLabsHardhatPluginError {
  constructor(message: string, parent?: Error) {
    super('fhe-erc3643', message, parent);
  }
}

export class FheERC3643InternalError extends NomicLabsHardhatPluginError {
  constructor(message: string, parent?: Error) {
    super('fhe-erc3643-internal', message, parent);
  }
}

export function throwIfInvalidAddress(address: string) {
  if (!EthersT.isAddress(address)) {
    throw new FheERC3643Error(`Invalid address: ${address}`);
  }
}

export function throwIfNoProvider(signer: EthersT.Signer) {
  if (!signer.provider) {
    throw new FheERC3643Error(`Missing Ethereum provider`);
  }
  return signer.provider;
}

export function throwIfInvalidUint32(value: number) {
  try {
    const bn = EthersT.getUint(value);
    const max = EthersT.getUint('0xFFFFFFFF');
    if (bn > max) {
      throw new Error();
    }
  } catch {
    throw new FheERC3643Error(`Invalid positive integer: ${value}`);
  }
}

export async function throwIfNotDeployed(name: string, provider: EthersT.Provider, address: string | undefined) {
  if (!(await isDeployed(provider, address))) {
    throw new FheERC3643Error(`${name} is not deployed (address: ${address})`);
  }
}

export async function throwIfNotAgent(
  agent: EthersT.AddressLike,
  agentRoleName: string,
  agentRoleAddress: EthersT.AddressLike,
  provider: EthersT.Provider,
  walletResolver: WalletResolver,
) {
  const arAddr = await EthersT.resolveAddress(agentRoleAddress, provider);
  const agentRole = AgentRole__factory.connect(arAddr);

  if (!(await agentRole.connect(provider).isAgent(agent))) {
    const agentAddress = await EthersT.resolveAddress(agent, provider);
    const agentAddressName = walletResolver.toWalletStringFromAddress(agentAddress);

    throw new FheERC3643Error(`${agentAddressName} is not an agent of ${agentRoleName}`);
  }
}

export async function throwIfNotOwner(
  name: string,
  contract: EthersT.AddressLike,
  owner: EthersT.AddressLike,
  provider: EthersT.Provider,
  walletResolver: WalletResolver,
) {
  const addr = await EthersT.resolveAddress(contract, provider);
  const ownerAddr = await EthersT.resolveAddress(owner, provider);
  const o = await getContractOwner(addr, provider);
  if (o !== ownerAddr) {
    if (!o) {
      throw new FheERC3643Error(`contract ${name} does not have a owner!`);
    }
    const nameStr = walletResolver.toWalletStringFromAddress(o);
    const ownerStr = walletResolver.toWalletStringFromAddress(ownerAddr);

    throw new FheERC3643Error(`${ownerStr} is not the owner of ${name}. The actual owner is ${nameStr}`);
  }
}
