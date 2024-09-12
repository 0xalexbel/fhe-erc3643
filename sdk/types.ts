import { ethers as EthersT } from 'ethers';
import { Progress } from './log';
import type { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider';

export interface TxOptions {
  confirms?: number;
  progress?: Progress;
  gasLimit?: number;
  noProgress?: boolean;
}

export interface TREXConfig {
  idFactory?: string;
  authority?: string;
  factory?: string;
}

export type ChainConfigJSON = {
  chain: {
    url: string;
    id: number;
    name: string;
  };
  idFactories: string[];
  trexFactories: string[];
  identities: string[];
  tokens: string[];
  claimIssuers: string[];
  dvaTransferManagers: string[];
};

export interface CryptEngine {
  decrypt64: ((handle: bigint) => Promise<bigint>) | undefined;
  encrypt64: (
    contract: EthersT.AddressLike,
    user: EthersT.AddressLike,
    value: number | bigint,
  ) => Promise<{
    handles: Uint8Array[];
    inputProof: Uint8Array;
  }>;
}

export interface History {
  saveContract: (address: string, contractName: string) => Promise<void>;
}

export interface WalletResolver {
  getWalletAt(index: number, provider?: EthersT.Provider | null | undefined): EthersT.HDNodeWallet;
  getWalletNamesAt(index: number): Array<string>;
  toWalletStringFromAddress(address: string, provider?: EthersT.Provider | null | undefined): string;
  loadAddressFromWalletIndexOrAliasOrAddress(
    wallet: string | number,
    provider?: EthersT.Provider | null | undefined,
  ): string;
}

export type ChainNetworkConfig = {
  url: string;
  chainId: number;
  name: string;
  accounts: {
    mnemonic: string;
    path: string;
  };
  //cryptEngine: CryptEngineConfig | undefined;
  hardhatProvider: HardhatEthersProvider | undefined;
};
