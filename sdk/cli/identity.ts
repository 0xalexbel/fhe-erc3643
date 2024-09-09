import assert from 'assert';
import { Identity } from '../artifacts';
import { ChainConfig } from '../ChainConfig';
import { FheERC3643Error, throwIfInvalidAddress, throwIfNotDeployed } from '../errors';
import { IdentityAPI } from '../IdentityAPI';
import { IdFactoryAPI } from '../IdFactoryAPI';
import { logStepOK } from '../log';
import { TREXFactoryAPI } from '../TREXFactory';
import { TxOptions } from '../types';
import { defaultTxOptions } from '../utils';

export async function cmdIdentityNew(
  managementWalletAlias: string,
  factorySourceAddress: string,
  factoryType: 'id' | 'trex',
  chainConfig: ChainConfig,
  options?: TxOptions,
): Promise<Identity> {
  options = options ?? defaultTxOptions(1);

  const managementWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(managementWalletAlias);

  if (factoryType !== 'trex') {
    factoryType = 'id';
  }

  throwIfInvalidAddress(factorySourceAddress);
  await throwIfNotDeployed('Identity factory', chainConfig.provider, factorySourceAddress);

  let idFactoryAddress;
  if (factoryType === 'trex') {
    const f = TREXFactoryAPI.from(factorySourceAddress, chainConfig.provider);
    idFactoryAddress = await f.getIdFactory();
  } else {
    idFactoryAddress = factorySourceAddress;
  }

  const idFactory = await IdFactoryAPI.fromSafe(idFactoryAddress, managementWallet);

  // The newly create identity is always created with it's wallet as the initial management key
  const initialManagementKey = managementWallet;

  options.progress?.pause();
  const identity = await IdFactoryAPI.deployNewIdentity(
    idFactory,
    initialManagementKey,
    managementWallet,
    chainConfig,
    options,
  );
  options.progress?.unpause();

  // Make sure the management wallet is actually the management key
  const ok = await IdentityAPI.isManagementKey(identity, managementWallet);
  if (!ok) {
    throw new FheERC3643Error(`Identity deployement failed. Invalid management key.`);
  }

  logStepOK(
    `Identity of ${managementWalletAlias} has been successfully deployed at ${await identity.getAddress()} with the specified managment key ${managementWallet.address} in ${factoryType} factory ${idFactoryAddress}.`,
    options,
  );

  return identity;
}
