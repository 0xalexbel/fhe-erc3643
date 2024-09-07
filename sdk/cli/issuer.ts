import { ClaimIssuer } from '../artifacts';
import { ChainConfig } from '../ChainConfig';
import { ClaimIssuerAPI } from '../ClaimIssuerAPI';
import { TxOptions } from '../types';
import { defaultTxOptions } from '../utils';

export async function cmdNewClaimIssuer(
  wallet: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
): Promise<ClaimIssuer> {
  options = options ?? defaultTxOptions(1);

  const ownerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(wallet);

  const claimIssuer = await ClaimIssuerAPI.deployNewClaimIssuer(ownerWallet, ownerWallet, chainConfig, options);

  return claimIssuer;
}
