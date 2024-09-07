import { ethers as EthersT } from 'ethers';

import { NomicLabsHardhatPluginError } from 'hardhat/plugins';
import { getContractOwner, isDeployed } from './utils';
import { ChainConfig } from './ChainConfig';

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

export async function throwIfNotDeployed(name: string, provider: EthersT.Provider, address: string | undefined) {
  if (!(await isDeployed(provider, address))) {
    throw new FheERC3643Error(`${name} is not deployed (address: ${address})`);
  }
}

export async function throwIfNotOwner(
  name: string,
  chainConfig: ChainConfig,
  contract: EthersT.AddressLike,
  owner: EthersT.AddressLike,
) {
  const addr = await EthersT.resolveAddress(contract);
  const ownerAddr = await EthersT.resolveAddress(owner);
  const o = await getContractOwner(addr, chainConfig.provider);
  if (o !== ownerAddr) {
    if (!o) {
      throw new FheERC3643Error(`contract ${name} does not have a owner!`);
    }
    const nameStr = chainConfig.toWalletStringFromAddress(o);
    const ownerStr = chainConfig.toWalletStringFromAddress(ownerAddr);

    throw new FheERC3643Error(`${ownerStr} is not the owner of ${name}. The actual owner is ${nameStr}`);
  }
}
