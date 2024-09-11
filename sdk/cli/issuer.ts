import { ClaimIssuer } from '../artifacts';
import { ChainConfig } from '../ChainConfig';
import { ClaimIssuerAPI } from '../ClaimIssuerAPI';
import { TxOptions } from '../types';

export async function cmdNewClaimIssuer(
  wallet: string,
  chainConfig: ChainConfig,
  options: TxOptions,
): Promise<ClaimIssuer> {
  const ownerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(wallet);

  const claimIssuer = await ClaimIssuerAPI.deployNewClaimIssuer(ownerWallet, ownerWallet, chainConfig, options);

  return claimIssuer;
}
