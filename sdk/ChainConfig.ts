import { ethers as EthersT } from 'ethers';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { getContractOwner } from './utils';

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

export type ChainNetworkConfig = {
  url: string;
  chainId: number;
  name: string;
  accounts: {
    mnemonic: string;
    path: string;
  };
};

export class ChainConfig {
  private _filePath: string | undefined;
  private _chainId: number;
  private _network: string;
  private _url: string;
  private _jsonRpcProvider: EthersT.JsonRpcProvider;
  private _mnemonicPhrase: string;
  private _walletPath: string;
  private _mnemonic: EthersT.Mnemonic;
  private _rootWallet: EthersT.HDNodeWallet;
  private _idFactories: Array<string>;
  private _trexFactories: Array<string>;
  private _identities: Array<string>;
  private _tokens: Array<string>;
  private _claimIssuers: Array<string>;

  constructor(config?: ChainNetworkConfig, path?: string) {
    const url = config?.url ?? 'http://localhost:8545';
    const chainId = config?.chainId ?? 9000;
    const name = config?.name ?? 'fhevm';
    const mnemonic = config?.accounts.mnemonic ?? 'test test test test test test test test test test test junk';
    const walletPath = config?.accounts.path ?? "m/44'/60'/0'/0";

    this._chainId = chainId;
    this._network = name;
    this._jsonRpcProvider = new EthersT.JsonRpcProvider(url, { chainId, name });
    this._mnemonicPhrase = mnemonic;
    this._walletPath = walletPath;
    this._mnemonic = EthersT.Mnemonic.fromPhrase(this._mnemonicPhrase);
    this._rootWallet = EthersT.HDNodeWallet.fromMnemonic(this._mnemonic, this._walletPath);
    this._idFactories = [];
    this._trexFactories = [];
    this._identities = [];
    this._claimIssuers = [];
    this._tokens = [];
    this._filePath = path;
    this._url = url;
  }

  public static async load(config: ChainNetworkConfig | undefined, historyPath: string): Promise<ChainConfig> {
    const c = new ChainConfig(config, historyPath);

    if (c._filePath && fs.existsSync(c._filePath)) {
      const h = (await this._readDeployHistoryFile(c._filePath)) as ChainConfigJSON;
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
    return this._jsonRpcProvider;
  }

  public get mnemonic() {
    return this._mnemonic;
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

  public getWalletAt(index: number, provider: EthersT.Provider | null): EthersT.HDNodeWallet {
    return this._rootWallet.deriveChild(index).connect(provider);
  }

  public getWalletFromName(name: string, provider: EthersT.Provider | null): EthersT.HDNodeWallet {
    let index: number;
    switch (name) {
      case 'admin':
        index = 0;
        break;
      case 'foo-university':
      case 'claim-issuer-1':
        index = 1;
        break;
      case 'bar-government':
      case 'claim-issuer-2':
        index = 2;
        break;
      case 'super-bank':
      case 'token-owner':
        index = 3;
        break;
      case 'token-agent':
        index = 4;
        break;
      case 'alice':
        index = 5;
        break;
      case 'bob':
        index = 6;
        break;
      case 'charlie':
        index = 7;
        break;
      case 'david':
        index = 8;
        break;
      case 'eve':
        index = 9;
        break;
      default:
        throw new Error(`Unknown wallet name ${name}`);
    }
    return this._rootWallet.deriveChild(index).connect(provider);
  }

  public async getOwnerWallet(address: string): Promise<EthersT.HDNodeWallet> {
    const owner = await getContractOwner(address, this.provider);
    if (!owner) {
      throw new Error(`Unable to determine owner of contract: ${address}`);
    }
    return this.getWalletFromAddress(owner, this.provider);
  }

  public getWalletFromAddress(address: string, provider: EthersT.Provider | null): EthersT.HDNodeWallet {
    for (let i = 0; i < 10; ++i) {
      const w = this.getWalletAt(i, provider);
      if (address === w.address) {
        return w;
      }
    }
    throw new Error(`Unable to retreive wallet from address ${address}`);
  }

  public getWallets(): EthersT.HDNodeWallet[] {
    const wallets = [];
    for (let i = 0; i < 10; ++i) {
      wallets.push(this.getWalletAt(i, this.provider));
    }
    return wallets;
  }

  public walletFromPrivateKey(key: string | EthersT.SigningKey): EthersT.Wallet {
    return new EthersT.Wallet(key, this.provider);
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
    if (!this._filePath) {
      return;
    }

    await this._writeDeployHistoryFile(this._filePath);
  }

  private async _writeDeployHistoryFile(path: string) {
    try {
      const json = this.toJSON();
      const s = JSON.stringify(json, null, 2);
      await fsPromises.writeFile(path, s, { encoding: 'utf8' });
    } catch (e) {
      console.log(`Save deploy history failed (${path})`);
    }
  }

  private static async _readDeployHistoryFile(path: string) {
    try {
      const s = fs.readFileSync(path, { encoding: 'utf8' });
      return JSON.parse(s);
    } catch (e) {}
    return undefined;
  }
}
