import { ethers as EthersT } from 'ethers';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { getContractOwner } from './utils';
import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider';
import { FheERC3643Error, FheERC3643InternalError, throwIfNoProvider } from '../sdk/errors';
import { logError } from './log';
import type { HardhatFhevmRuntimeEnvironment as HardhatFhevmRuntimeEnvironmentType } from 'hardhat-fhevm/dist/src/common/HardhatFhevmRuntimeEnvironment';
import type { HardhatFhevmInstance as HardhatFhevmInstanceType } from 'hardhat-fhevm';
import { Identity, Token, TREXFactory } from './artifacts';
import { ChainConfigJSON, ChainNetworkConfig, CryptEngine, History, WalletResolver } from './types';

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

export class ChainConfig implements CryptEngine, History, WalletResolver {
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
  private _dvaTransferManagers: Array<string>;
  //private _cryptEngine: CryptEngineConfig | undefined;
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
    this._dvaTransferManagers = [];
    this._tokens = [];
    this._historyPath = path;
    this._url = url;
    //this._cryptEngine = config?.cryptEngine;
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
        if (h.dvaTransferManagers) {
          c._dvaTransferManagers = [...h.dvaTransferManagers];
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

  public async saveContract(address: string, contractName: string) {
    switch (contractName) {
      case 'ClaimIssuer':
        return this._saveClaimIssuer(address);
      case 'IdFactory':
        return this._saveIdFactory(address);
      case 'Identity':
        return this._saveIdentity(address);
      case 'Token':
        return this._saveToken(address);
      case 'TREXFactory':
        return this._saveTREXFactory(address);
      case 'DVATransferManager':
        return this._saveDVATransferManager(address);
      default:
        break;
    }
  }

  private async _saveDVATransferManager(dvaTransferManager: string) {
    if (!this._dvaTransferManagers.includes(dvaTransferManager)) {
      this._dvaTransferManagers.push(dvaTransferManager);

      await this.save();
    }
  }

  private async _saveIdFactory(idFactory: string) {
    if (!this._idFactories.includes(idFactory)) {
      this._idFactories.push(idFactory);

      await this.save();
    }
  }

  private async _saveIdentity(identity: string) {
    if (!this._identities.includes(identity)) {
      this._identities.push(identity);

      await this.save();
    }
  }

  private async _saveClaimIssuer(claimIssuer: string) {
    if (!this._claimIssuers.includes(claimIssuer)) {
      this._claimIssuers.push(claimIssuer);

      await this.save();
    }
  }

  private async _saveToken(token: string) {
    if (!this._tokens.includes(token)) {
      this._tokens.push(token);

      await this.save();
    }
  }

  private async _saveTREXFactory(trexFactory: string) {
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
      dvaTransferManagers: [...this._dvaTransferManagers],
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
    const contractAddr = await EthersT.resolveAddress(contract, this.provider);
    const userAddr = await EthersT.resolveAddress(user, this.provider);
    const input = this._fhevmInstance.createEncryptedInput(contractAddr, userAddr);
    input.add64(value);
    return input.encrypt();

    //return this._cryptEngine.encrypt64(contract, user, value);
  }

  private async _resolveTREXFactoryAddress(trexFactory?: EthersT.AddressLike): Promise<string> {
    if (!trexFactory) {
      if (this._trexFactories.length === 0) {
        throw new FheERC3643Error(`Unable to resolve TREX factory.`);
      }
      return this._trexFactories[this._trexFactories.length - 1];
    }
    return await EthersT.resolveAddress(trexFactory, this.provider);
  }

  private async _resolveLastTokenAddress(
    runner?: EthersT.ContractRunner,
    orAndFilter?: Array<{ name?: string; symbol?: string }>,
  ): Promise<string> {
    if (this._tokens.length === 0) {
      throw new FheERC3643Error(`Unable to resolve TREX Token. No address stored in the history.`);
    }

    let theToken: string | undefined = undefined;
    let garbageTokens = 0;
    for (let i = this._tokens.length - 1; i >= 0; --i) {
      const t = this._tokens[i];

      // Must use dynamic import to avoid hardhat.config.ts issues
      const imp = await import('./TokenAPI');

      const infos = await imp.TokenAPI.getTokenInfosNoCheck(t, runner ?? this.provider);
      if (!infos) {
        // History may be full of garbage
        this._tokens[i] = EthersT.ZeroAddress;
        garbageTokens++;
        continue;
      }

      if (!orAndFilter) {
        theToken = t;
      } else {
        for (let j = 0; j < orAndFilter.length; ++j) {
          const and = orAndFilter[j];
          if (and.name && and.name !== infos.name) {
            continue;
          }
          if (and.symbol && and.symbol !== infos.symbol) {
            continue;
          }
          theToken = t;
          break;
        }
      }

      if (theToken) {
        break;
      }
    }

    if (garbageTokens > 0) {
      // delete
      const cleanTokens = this._tokens.filter(t => t !== EthersT.ZeroAddress);
      this._tokens = cleanTokens;
      await this.save();
    }

    if (theToken) {
      return theToken;
    }

    throw new FheERC3643Error(`Unable to resolve TREX Token.`);
  }

  private async _resolveLastIdAddress(
    managementKey: string,
    tokenAddress: string,
    runner?: EthersT.ContractRunner,
  ): Promise<string> {
    if (this._identities.length === 0) {
      throw new FheERC3643Error(`Unable to resolve Identity. No address stored in the history.`);
    }

    let token;
    try {
      if (tokenAddress !== EthersT.ZeroAddress) {
        // Must use dynamic import to avoid hardhat.config.ts issues
        const imp = await import('./TokenAPI');
        token = await imp.TokenAPI.fromSafe(tokenAddress, runner ?? this.provider);
      }
    } catch {
      throw new FheERC3643Error(`Unable to resolve Identity. Token ${tokenAddress} is not available.`);
    }

    let theId: string | undefined = undefined;
    let garbageIds = 0;
    for (let i = this._identities.length - 1; i >= 0; --i) {
      const id = this._identities[i];

      // Must use dynamic import to avoid hardhat.config.ts issues
      const imp = await import('./IdentityAPI');

      const infos = await imp.IdentityAPI.getIdentityInfosNoCheck(id, runner ?? this.provider);
      if (!infos) {
        // History may be full of garbage
        this._identities[i] = EthersT.ZeroAddress;
        garbageIds++;
        continue;
      }

      const hash = await imp.IdentityAPI.toKey(managementKey, runner ?? this.provider);
      const hashHex = EthersT.hexlify(hash);
      if (infos.managementKeys.includes(hashHex)) {
        if (token) {
          const imp = await import('./TokenAPI');
          const identity = await imp.TokenAPI.userToIdentity(token, managementKey, runner ?? this.provider);
          if (!identity) {
            continue;
          }
          // is it the right identity ?
          if ((await identity.getAddress()) !== id) {
            continue;
          }
        }
        theId = id;
        break;
      }
    }

    if (garbageIds > 0) {
      // delete
      const cleanIds = this._identities.filter(t => t !== EthersT.ZeroAddress);
      this._identities = cleanIds;
      await this.save();
    }

    if (theId) {
      return theId;
    }

    if (token) {
      throw new FheERC3643Error(
        `Unable to resolve Identity with management key ${managementKey} and token ${await token.name()}`,
      );
    } else {
      throw new FheERC3643Error(`Unable to resolve Identity with management key ${managementKey}`);
    }
  }

  private async _resolveLastClaimIssuerAddress(
    managerAddress: string,
    tokenAddress: string,
    runner?: EthersT.ContractRunner,
  ): Promise<string> {
    let token;
    try {
      if (tokenAddress !== EthersT.ZeroAddress) {
        // Must use dynamic import to avoid hardhat.config.ts issues
        const imp = await import('./TokenAPI');
        token = await imp.TokenAPI.fromSafe(tokenAddress, runner ?? this.provider);
      }
    } catch {
      throw new FheERC3643Error(`Unable to resolve Claim Issuer. Token ${tokenAddress} is not available.`);
    }

    let theCi: string | undefined = undefined;

    if (token) {
      const t_imp = await import('./TokenAPI');
      const cis = await t_imp.TokenAPI.trustedIssuersFromManagerAddress(token, managerAddress);
      if (cis.length > 1) {
        throw new FheERC3643Error(
          `Unable to resolve Claim Issuer with management key ${managerAddress} in token ${await token.name()} because ${cis.length} distinct Claim Issuers are sharing the same management key`,
        );
      }
      if (cis.length === 1) {
        theCi = await cis[0].getAddress();
        return theCi;
      }
    }

    let garbageCis = 0;
    for (let i = this._claimIssuers.length - 1; i >= 0; --i) {
      const ci = this._claimIssuers[i];

      const ci_imp = await import('./ClaimIssuerAPI');
      try {
        // Check if ci is realy a ClaimIssuer contract
        const _ci = await ci_imp.ClaimIssuerAPI.fromSafe(ci, this.provider);
      } catch {
        this._claimIssuers[i] = EthersT.ZeroAddress;
        garbageCis++;
        continue;
      }

      // Must use dynamic import to avoid hardhat.config.ts issues
      const imp = await import('./IdentityAPI');

      // ClaimIssuer is also an Identity
      const infos = await imp.IdentityAPI.getIdentityInfosNoCheck(ci, runner ?? this.provider);
      if (!infos) {
        // History may be full of garbage
        this._claimIssuers[i] = EthersT.ZeroAddress;
        garbageCis++;
        continue;
      }

      const hash = await imp.IdentityAPI.toKey(managerAddress, runner ?? this.provider);
      const hashHex = EthersT.hexlify(hash);
      if (infos.managementKeys.includes(hashHex)) {
        if (token) {
          const t_imp = await import('./TokenAPI');
          if (!(await t_imp.TokenAPI.isTrustedIssuer(token, ci))) {
            continue;
          }
        }
        theCi = ci;
        break;
      }
    }

    if (garbageCis > 0) {
      // delete
      const cleanCis = this._claimIssuers.filter(t => t !== EthersT.ZeroAddress);
      this._claimIssuers = cleanCis;
      await this.save();
    }

    if (theCi) {
      return theCi;
    }

    if (token) {
      throw new FheERC3643Error(
        `Unable to resolve Claim Issuer with management key ${managerAddress} in token ${await token.name()}`,
      );
    } else {
      throw new FheERC3643Error(`Unable to resolve Claim Issuer with management key ${managerAddress}`);
    }
  }

  public async resolveTREXFactory(
    runner?: EthersT.ContractRunner,
    options?: { trexFactoryAddress?: EthersT.AddressLike },
  ): Promise<TREXFactory> {
    const { trexFactoryAddress } = { ...options };
    const addr = await this._resolveTREXFactoryAddress(trexFactoryAddress);
    // Must use dynamic import to avoid hardhat.config.ts issues
    const imp = await import('./TREXFactoryAPI');
    return imp.TREXFactoryAPI.fromSafe(addr, runner ?? this.provider);
  }

  public async tryResolveToken(
    addressOrSaltOrNameOrSymbol?:
      | string
      | EthersT.AddressLike
      | { salt?: string; trexFactoryAddress?: EthersT.AddressLike },
    runner?: EthersT.ContractRunner,
  ): Promise<Token> {
    // If no argument
    if (!addressOrSaltOrNameOrSymbol) {
      const t = await this.resolveToken(runner);
      return t;
    }

    // If argument is an address
    if (EthersT.isAddress(addressOrSaltOrNameOrSymbol)) {
      const imp = await import('./TokenAPI');
      const t = await imp.TokenAPI.fromSafe(addressOrSaltOrNameOrSymbol, runner ?? this.provider);
      return t;
    }

    // If argument is addressable
    if (EthersT.isAddressable(addressOrSaltOrNameOrSymbol)) {
      const imp = await import('./TokenAPI');
      const t = await imp.TokenAPI.fromSafe(await addressOrSaltOrNameOrSymbol.getAddress(), runner ?? this.provider);
      return t;
    }

    // If argument is a promise, try addresslike (ens)
    if (addressOrSaltOrNameOrSymbol instanceof Promise) {
      try {
        const addr = await EthersT.resolveAddress(addressOrSaltOrNameOrSymbol, this.provider);
        const imp = await import('./TokenAPI');
        const t = await imp.TokenAPI.fromSafe(addr, runner ?? this.provider);
        return t;
      } catch {}
    }

    // If argument is an object
    if (typeof addressOrSaltOrNameOrSymbol === 'object') {
      if ('trexFactoryAddress' in addressOrSaltOrNameOrSymbol || 'salt' in addressOrSaltOrNameOrSymbol) {
        const t = await this.resolveToken(runner, addressOrSaltOrNameOrSymbol);
        return t;
      }

      throw new FheERC3643Error('Unable to resolve TREX Token address');
    }

    // try name or symbol or salt (only)
    if (typeof addressOrSaltOrNameOrSymbol === 'string') {
      try {
        // First try name or symbol
        const t = await this.resolveToken(runner, {
          orAndfilter: [{ name: addressOrSaltOrNameOrSymbol }, { symbol: addressOrSaltOrNameOrSymbol }],
        });
        return t;
      } catch {}

      try {
        // then try salt
        const t = await this.resolveToken(runner, { salt: addressOrSaltOrNameOrSymbol });
        return t;
      } catch {}

      throw new FheERC3643Error(
        `Unable to resolve TREX Token address with symbol/name/salt ${addressOrSaltOrNameOrSymbol}`,
      );
    }

    // Unrecognized argument
    throw new FheERC3643Error('Unable to resolve TREX Token address');
  }

  public async resolveToken(
    runner?: EthersT.ContractRunner,
    options?: {
      orAndfilter?: Array<{ name?: string; symbol?: string }>;
      salt?: string;
      trexFactoryAddress?: EthersT.AddressLike;
    },
  ): Promise<Token> {
    const { salt, trexFactoryAddress, orAndfilter } = { ...options };

    if (!salt) {
      if (trexFactoryAddress) {
        throw new FheERC3643Error(
          `Unable to resolve token address from TREX factory ${trexFactoryAddress} because no salt was specified`,
        );
      }
      // No salt, take the last deployed token
      const addr = await this._resolveLastTokenAddress(runner, orAndfilter);
      const imp = await import('./TokenAPI');
      return imp.TokenAPI.fromSafe(addr, runner ?? this.provider);
    }

    const trexFactory = await this.resolveTREXFactory(runner, { trexFactoryAddress });
    const imp = await import('./TREXFactoryAPI');
    const t = await imp.TREXFactoryAPI.tokenFromSalt(trexFactory, salt, runner ?? this.provider);
    if (!t) {
      throw new FheERC3643Error(
        `Unable to resolve token address with salt ${salt} in TREX factory ${await trexFactory.getAddress()}`,
      );
    }
    return t;
  }

  public async resolveIdentity(
    walletAddress: string,
    token?: EthersT.AddressLike,
    runner?: EthersT.ContractRunner,
  ): Promise<Identity> {
    let tokenAddress = EthersT.ZeroAddress;
    if (token) {
      tokenAddress = await EthersT.resolveAddress(token, this.provider);
    }

    const addr = await this._resolveLastIdAddress(walletAddress, tokenAddress, runner);

    const imp = await import('./IdentityAPI');
    const id = await imp.IdentityAPI.fromSafe(addr, runner ?? this.provider);

    return id;
  }

  public async resolveClaimIssuer(
    walletAddress: string,
    token?: EthersT.AddressLike,
    runner?: EthersT.ContractRunner,
  ): Promise<Identity> {
    let tokenAddress = EthersT.ZeroAddress;
    if (token) {
      tokenAddress = await EthersT.resolveAddress(token, this.provider);
    }

    const addr = await this._resolveLastClaimIssuerAddress(walletAddress, tokenAddress, runner);

    const imp = await import('./ClaimIssuerAPI');
    const ci = await imp.ClaimIssuerAPI.fromSafe(addr, runner ?? this.provider);

    return ci;
  }

  async findDVATransferManagerAddress(token: Token, dvaAddressOrAlias: string) {
    // Try dva address first
    for (let i = this._dvaTransferManagers.length - 1; i >= 0; --i) {
      const dva = this._dvaTransferManagers[i];
      if (dva.toLowerCase() === dvaAddressOrAlias.toLowerCase()) {
        return dva;
      }
    }
    // Try user address instead
    const userAddress = this.loadAddressFromWalletIndexOrAliasOrAddress(dvaAddressOrAlias);
    const imp = await import('./TokenAPI');
    const userId = await imp.TokenAPI.userToIdentity(token, userAddress, this.provider);
    if (!userId) {
      return null;
    }
    const userIdAddress = await userId?.getAddress();
    for (let i = this._dvaTransferManagers.length - 1; i >= 0; --i) {
      const dva = this._dvaTransferManagers[i];
      const id = await imp.TokenAPI.userToIdentity(token, dva, this.provider);
      if (!id) {
        continue;
      }
      if (userIdAddress === (await id.getAddress())) {
        return dva;
      }
    }
    return null;
  }

  async resolveTokenFactory(token: Token) {
    const provider = throwIfNoProvider(token.runner);
    const t_imp = await import('./TokenAPI');
    const f_imp = await import('./TREXFactoryAPI');
    const factories = [];
    for (let i = 0; i < this._trexFactories.length; ++i) {
      const factory = await f_imp.TREXFactoryAPI.fromSafe(this._trexFactories[i], provider);
      const ok = await t_imp.TokenAPI.hasSameAuthorityAsFactory(token, factory);
      if (ok) {
        factories.push(factory);
      }
    }
    if (factories.length > 1) {
      throw new FheERC3643Error(`Multiple TREXFactories are sharing the same ImplementationAuthority`);
    }
    if (factories.length === 0) {
      throw new FheERC3643Error(`Unable to retreive the TREXFactory associated with token ${await token.getAddress()}`);
    }
    return factories[0];
  }
}

// static async searchOwnerInAgentRole(agentRole: EthersT.AddressLike, chainConfig: ChainConfig) {
//   const agentRoleAddress = await EthersT.resolveAddress(agentRole);
//   const agentRoleContract = AgentRole__factory.connect(agentRoleAddress).connect(chainConfig.provider);
//   const ownerAddress = await agentRoleContract.owner();
//   for (let i = 0; i < 10; ++i) {
//     const address = chainConfig.getWalletAt(i, null).address;
//     if (address == ownerAddress) {
//       return { address, index: i, names: chainConfig.getWalletNamesAt(i) };
//     }
//   }
//   return undefined;
// }

// static async searchPurposeKeys(identity: Identity, purpose: number, chainConfig: ChainConfig) {
//   const res: Array<{ address: string; index: number | undefined }> = [];
//   for (let i = 0; i < 10; ++i) {
//     const address = chainConfig.getWalletAt(i, null).address;
//     if (await this.keyHasPurpose(identity, address, purpose)) {
//       res.push({ address, index: i });
//     }
//   }
//   return res;
// }
