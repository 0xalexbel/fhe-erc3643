import { ethers as EthersT } from 'ethers';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { getContractOwner } from './utils';
import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider';
import { FheERC3643Error, FheERC3643InternalError } from '../sdk/errors';
import { logError } from './log';
import type { HardhatFhevmRuntimeEnvironment as HardhatFhevmRuntimeEnvironmentType } from 'hardhat-fhevm/dist/src/common/HardhatFhevmRuntimeEnvironment';
import type { HardhatFhevmInstance as HardhatFhevmInstanceType } from 'hardhat-fhevm';

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
};

// export type MyHRE = {
//   fhevm: {
//     decrypt64: (handle: bigint) => Promise<bigint>;
//     createEncryptedInput: (contract: EthersT.AddressLike, user: EthersT.AddressLike) => FhevmZKInputType;
//   };
// };

// export type FhevmZKInputType = {
//   add64: (value: number | bigint) => FhevmZKInputType;
//   encrypt: () => {
//     handles: Uint8Array[];
//     inputProof: Uint8Array;
//   };
// };

// export type MyFhevmInstanceType = {
//   createEncryptedInput: (contractAddress: string, userAddress: string) => any;
//   generateKeypair: () => { publicKey: string; privateKey: string };
//   createEIP712: (publicKey: string, contractAddress: string, userAddress?: string) => any;
//   reencrypt: (
//     handle: bigint,
//     privateKey: string,
//     publicKey: string,
//     signature: string,
//     contractAddress: string,
//     userAddress: string,
//   ) => Promise<bigint>;
//   getPublicKey: () => string | null;
// };

//public createEncryptedInput(contractAddress: string, userAddress: string): HardhatFhevmZKInput {
export type CryptEngineConfig = {
  decrypt64: ((handle: bigint) => Promise<bigint>) | undefined;
  encrypt64: (
    contract: EthersT.AddressLike,
    user: EthersT.AddressLike,
    value: number | bigint,
  ) => Promise<{
    handles: Uint8Array[];
    inputProof: Uint8Array;
  }>;
};

export type ChainNetworkConfig = {
  url: string;
  chainId: number;
  name: string;
  accounts: {
    mnemonic: string;
    path: string;
  };
  cryptEngine: CryptEngineConfig | undefined;
  hardhatProvider: HardhatEthersProvider | undefined;
};

export const WALLETS: Array<{ index: number; names: string[] }> = [
  { index: 0, names: ['admin'] },
  { index: 1, names: ['foo-university', 'claim-issuer-1'] },
  { index: 2, names: ['bar-government', 'claim-issuer-2'] },
  { index: 3, names: ['super-bank', 'token-owner'] },
  { index: 4, names: ['token-agent'] },
  { index: 5, names: ['alice'] },
  { index: 6, names: ['bob'] },
  { index: 7, names: ['charlie'] },
  { index: 8, names: ['david'] },
  { index: 9, names: ['eve'] },
];

export class ChainConfig {
  private _historyPath: string | undefined;
  private _chainId: number;
  private _network: string;
  private _url: string;
  private _hardhatProvider: HardhatEthersProvider | undefined;
  private _jsonRpcProvider: EthersT.JsonRpcProvider | undefined;
  private _mnemonicPhrase: string;
  private _walletPath: string;
  private _mnemonic: EthersT.Mnemonic;
  private _rootWallet: EthersT.HDNodeWallet;
  private _idFactories: Array<string>;
  private _trexFactories: Array<string>;
  private _identities: Array<string>;
  private _tokens: Array<string>;
  private _claimIssuers: Array<string>;
  private _cryptEngine: CryptEngineConfig | undefined;
  private _fhevm: HardhatFhevmRuntimeEnvironmentType;
  private _fhevmInstance: HardhatFhevmInstanceType | undefined;

  constructor(
    config: ChainNetworkConfig | undefined,
    path: string | undefined,
    fhevm: HardhatFhevmRuntimeEnvironmentType,
  ) {
    const url = config?.url ?? 'http://localhost:8545';
    const chainId = config?.chainId ?? 9000;
    const name = config?.name ?? 'fhevm';
    const mnemonic = config?.accounts.mnemonic ?? 'test test test test test test test test test test test junk';
    const walletPath = config?.accounts.path ?? "m/44'/60'/0'/0";

    this._fhevm = fhevm;
    this._chainId = chainId;
    this._network = name;
    this._hardhatProvider = config?.hardhatProvider;
    this._jsonRpcProvider = config?.hardhatProvider ? undefined : new EthersT.JsonRpcProvider(url, { chainId, name });
    this._mnemonicPhrase = mnemonic;
    this._walletPath = walletPath;
    this._mnemonic = EthersT.Mnemonic.fromPhrase(this._mnemonicPhrase);
    this._rootWallet = EthersT.HDNodeWallet.fromMnemonic(this._mnemonic, this._walletPath);
    this._idFactories = [];
    this._trexFactories = [];
    this._identities = [];
    this._claimIssuers = [];
    this._tokens = [];
    this._historyPath = path;
    this._url = url;
    this._cryptEngine = config?.cryptEngine;
  }

  public get historyPath() {
    return this._historyPath;
  }

  public get networkName() {
    return this._network;
  }

  public static async load(
    config: ChainNetworkConfig | undefined,
    historyPath: string | undefined,
    fhevm: HardhatFhevmRuntimeEnvironmentType,
  ): Promise<ChainConfig> {
    const c = new ChainConfig(config, historyPath, fhevm);

    if (c._historyPath && fs.existsSync(c._historyPath)) {
      const h = (await this._readDeployHistoryFile(c._historyPath)) as ChainConfigJSON;
      if (h?.chain.id === c._chainId && h?.chain.name === c._network) {
        if (h.idFactories) {
          c._idFactories = [...h.idFactories];
        }
        if (h.trexFactories) {
          c._trexFactories = [...h.trexFactories];
        }
        if (h.tokens) {
          c._tokens = [...h.tokens];
        }
        if (h.identities) {
          c._identities = [...h.identities];
        }
        if (h.claimIssuers) {
          c._claimIssuers = [...h.claimIssuers];
        }
      }
    }

    return c;
  }

  public get provider() {
    if (this._jsonRpcProvider) {
      return this._jsonRpcProvider;
    }
    if (this._hardhatProvider) {
      return this._hardhatProvider;
    }
    throw new FheERC3643InternalError(`No provider`);
  }

  public get mnemonic() {
    return this._mnemonic;
  }

  public get url() {
    return this._url;
  }

  public async getAccounts() {
    let accounts: string[];
    accounts = await this.provider.send('eth_accounts', []);
    return accounts;
  }

  public async getBalance(account: string) {
    const hex = await this.provider.send('eth_getBalance', [account, 'latest']);
    return EthersT.getBigInt(hex);
  }
  public getWalletIndexFromName(name: string): number | undefined {
    for (let i = 0; i < WALLETS.length; ++i) {
      if (WALLETS[i].names.includes(name)) {
        return WALLETS[i].index;
      }
    }
    return undefined;
  }

  public getWalletNamesAt(index: number): Array<string> {
    if (index < 0 || index > WALLETS.length) {
      return [];
    }
    try {
      return WALLETS[index].names;
    } catch {
      return [];
    }
  }

  public getAllWalletsAddress(provider?: EthersT.Provider | null | undefined): string[] {
    return WALLETS.map(v => this.getWalletAt(v.index).address);
  }

  public getWalletAt(index: number, provider?: EthersT.Provider | null | undefined): EthersT.HDNodeWallet {
    if (provider === undefined) {
      return this._rootWallet.deriveChild(index).connect(this.provider);
    }
    return this._rootWallet.deriveChild(index).connect(provider);
  }

  public getWalletFromName(name: string, provider?: EthersT.Provider | null | undefined): EthersT.HDNodeWallet {
    let index: number | undefined = this.getWalletIndexFromName(name);
    if (index === undefined) {
      throw new FheERC3643Error(`Unknown wallet name ${name}`);
    }
    return this.getWalletAt(index, provider);
  }

  public async getOwnerWallet(address: string): Promise<EthersT.HDNodeWallet> {
    const owner = await getContractOwner(address, this.provider);
    if (!owner) {
      throw new FheERC3643Error(`Unable to determine owner of contract: ${address}`);
    }
    return this.getWalletFromAddress(owner, this.provider);
  }

  public getWalletFromAddress(address: string, provider?: EthersT.Provider | null | undefined): EthersT.HDNodeWallet {
    for (let i = 0; i < 10; ++i) {
      const w = this.getWalletAt(i, provider);
      if (address === w.address) {
        return w;
      }
    }
    throw new FheERC3643Error(`Unable to retreive wallet from address ${address}`);
  }

  public getWalletIndexFromAddress(
    address: string,
    provider?: EthersT.Provider | null | undefined,
  ): number | undefined {
    for (let i = 0; i < 10; ++i) {
      const w = this.getWalletAt(i, provider);
      if (address === w.address) {
        return i;
      }
    }
    return undefined;
  }

  public getWalletNamesFromAddress(address: string, provider?: EthersT.Provider | null | undefined): string[] {
    const index = this.getWalletIndexFromAddress(address, provider);
    if (index === undefined) {
      return [];
    }
    return this.getWalletNamesAt(index);
  }

  public toWalletStringFromAddress(address: string, provider?: EthersT.Provider | null | undefined): string {
    const index = this.getWalletIndexFromAddress(address, provider);
    if (index === undefined) {
      return address;
    }
    return '[' + this.getWalletNamesAt(index).join(',') + ']';
  }

  public getWallets(provider?: EthersT.Provider | null | undefined): EthersT.HDNodeWallet[] {
    const wallets = [];
    for (let i = 0; i < 10; ++i) {
      wallets.push(this.getWalletAt(i, provider));
    }
    return wallets;
  }

  public walletFromPrivateKey(
    key: string | EthersT.SigningKey,
    provider?: EthersT.Provider | null | undefined,
  ): EthersT.Wallet {
    return new EthersT.Wallet(key, provider === undefined ? this.provider : provider);
  }

  public loadWalletFromIndexOrAliasOrAddressOrPrivateKey(
    wallet: number | string,
    provider?: EthersT.Provider | null | undefined,
  ) {
    if (typeof wallet === 'number') {
      return this.getWalletAt(wallet, provider);
    }

    if (!EthersT.isHexString(wallet)) {
      const index = Number.parseInt(wallet, 10);
      if (Number.isNaN(index)) {
        return this.getWalletFromName(wallet, provider);
      }
      return this.getWalletAt(index, provider);
    }

    if (EthersT.isAddress(wallet)) {
      return this.getWalletFromAddress(EthersT.getAddress(wallet), provider);
    }
    try {
      return this.walletFromPrivateKey(wallet);
    } catch (e) {
      throw new Error('Missing wallet arguments. Expecting private key or wallet index or wallet address');
    }
  }

  public loadAddressFromWalletIndexOrAliasOrAddress(
    wallet: string | number,
    provider?: EthersT.Provider | null | undefined,
  ): string {
    if (typeof wallet === 'number') {
      return this.getWalletAt(wallet, provider).address;
    }

    try {
      return EthersT.getAddress(wallet);
    } catch (e) {
      const index = Number.parseInt(wallet, 10);
      if (Number.isNaN(index)) {
        return this.getWalletFromName(wallet, provider).address;
      }
      return this.getWalletAt(index, provider).address;
    }
  }

  public async saveIdFactory(idFactory: string) {
    if (!this._idFactories.includes(idFactory)) {
      this._idFactories.push(idFactory);

      await this.save();
    }
  }

  public async saveIdentity(identity: string) {
    if (!this._identities.includes(identity)) {
      this._identities.push(identity);

      await this.save();
    }
  }

  public async saveClaimIssuer(claimIssuer: string) {
    if (!this._claimIssuers.includes(claimIssuer)) {
      this._claimIssuers.push(claimIssuer);

      await this.save();
    }
  }

  public async saveToken(token: string) {
    if (!this._tokens.includes(token)) {
      this._tokens.push(token);

      await this.save();
    }
  }

  public async saveTREXFactory(trexFactory: string) {
    if (!this._trexFactories.includes(trexFactory)) {
      this._trexFactories.push(trexFactory);

      await this.save();
    }
  }

  public toJSON(): ChainConfigJSON {
    return {
      chain: {
        id: this._chainId,
        name: this._network,
        url: this._url,
      },
      idFactories: [...this._idFactories],
      trexFactories: [...this._trexFactories],
      identities: [...this._identities],
      claimIssuers: [...this._claimIssuers],
      tokens: [...this._tokens],
    };
  }

  public async save() {
    if (!this._historyPath) {
      return;
    }

    await this._writeDeployHistoryFile(this._historyPath);
  }

  private async _writeDeployHistoryFile(path: string) {
    try {
      const json = this.toJSON();
      const s = JSON.stringify(json, null, 2);
      await fsPromises.writeFile(path, s, { encoding: 'utf8' });
    } catch (e) {
      logError(`Save deploy history failed (${path})`);
    }
  }

  private static async _readDeployHistoryFile(path: string) {
    try {
      const s = fs.readFileSync(path, { encoding: 'utf8' });
      return JSON.parse(s);
    } catch (e) {}
    return undefined;
  }

  async decrypt64(handle: EthersT.BigNumberish | Uint8Array): Promise<bigint> {
    // if (!this._cryptEngine || !this._cryptEngine.decrypt64) {
    //   throw new FheERC3643Error(`Chain config does not support FHEVM handle decryption`);
    // }
    // const bn = EthersT.toBigInt(handle);
    // if (bn === 0n) {
    //   return 0n;
    // }
    // return await this._cryptEngine.decrypt64(bn);

    const bn = EthersT.toBigInt(handle);
    if (bn === 0n) {
      return 0n;
    }

    const clear = await this._fhevm.decrypt64(bn);
    return clear;
  }

  async encrypt64(contract: EthersT.AddressLike, user: EthersT.AddressLike, value: number | bigint) {
    if (typeof value !== 'number' && typeof value !== 'bigint') {
      throw new FheERC3643Error('Invalid value to encrypt type= ' + typeof value);
    }
    // if (!this._cryptEngine || !this._cryptEngine.encrypt64) {
    //   throw new FheERC3643Error(`Chain config does not support FHEVM handle encryption`);
    // }

    if (this._fhevmInstance === undefined) {
      this._fhevmInstance = await this._fhevm.createInstance();
    }
    const contractAddr = await EthersT.resolveAddress(contract);
    const userAddr = await EthersT.resolveAddress(user);
    const input = this._fhevmInstance.createEncryptedInput(contractAddr, userAddr);
    input.add64(value);
    return input.encrypt();

    //return this._cryptEngine.encrypt64(contract, user, value);
  }

  /*
  //0x092e3462d81a26fb16296badcec4bf674b801f0b1552ac3a39d061c8a8322def
          const instance = await hre.fhevm.createInstance();
          const contractAddr = await hre.ethers.resolveAddress(contract);
          const userAddr = await hre.ethers.resolveAddress(user);
          const input = instance.createEncryptedInput(contractAddr, userAddr);
          input.add64(value);
          return input.encrypt();

  */
}
