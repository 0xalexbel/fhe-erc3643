import { ClaimIssuer, Token } from '../artifacts';
import { ChainConfig } from '../ChainConfig';
import { ClaimIssuerAPI } from '../ClaimIssuerAPI';
import { IdentityAPI } from '../IdentityAPI';
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

export async function cmdClaimIssuerShow(
  managementWalletAlias: string,
  tokenAddressOrSaltOrNameOrSymbol: string | undefined,
  chainConfig: ChainConfig,
  options: TxOptions,
) {
  const managementWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(managementWalletAlias);

  let token: Token | undefined;
  if (tokenAddressOrSaltOrNameOrSymbol) {
    token = await chainConfig.tryResolveToken(tokenAddressOrSaltOrNameOrSymbol);
  }

  const ci = await chainConfig.resolveClaimIssuer(managementWallet.address, token);

  const [version, address] = await Promise.all([ci.version(), ci.getAddress()]);

  const keys = await IdentityAPI.getIdentityInfosNoCheck(address, chainConfig.provider);

  return {
    version,
    address,
    ...keys,
    ...(token ? { token: { address: await token.getAddress(), name: await token.name() } } : undefined),
  };
}
