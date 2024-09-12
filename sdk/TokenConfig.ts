import { ethers as EthersT } from 'ethers';
import fs from 'fs';
import { ClaimTopic, toClaimTopic } from './ClaimIssuerAPI';
import { ChainConfig } from './ChainConfig';
import { TREXFactoryAPI } from './TREXFactoryAPI';
import { TokenAPI } from './TokenAPI';
import { ModularComplianceAPI } from './ModuleComplianceAPI';
import { IdentityRegistryAPI } from './IdentityRegistryAPI';
import { ITREXFactory } from './artifacts';

export interface TREXTokenUserConfig {
  salt: string;
  token: TokenUserConfig;
  claims: TokenClaimsUserConfig;
}

export interface TokenUserConfig {
  owner: string;
  name: string;
  symbol: string;
  decimals: bigint;
  identityRegistryStorage: string;
  identity: string;
  identityRegistryAgents: Array<string>;
  tokenAgents: Array<string>;
  complianceModules: Array<string>;
  complianceSettings: Array<string>;
}

export interface TokenClaimsUserConfig {
  topics: Array<ClaimTopic>;
  issuers: Record<string, { topics: Array<ClaimTopic> }>;
}

export class TREXTokenUserConfigBuilder implements TREXTokenUserConfig {
  private _salt: string = '';
  private _token: TokenUserConfigBuilder = new TokenUserConfigBuilder();
  private _claims: TokenClaimsUserConfigBuilder = new TokenClaimsUserConfigBuilder();

  constructor() {}

  get salt() {
    return this._salt;
  }
  withSalt(value: string): TREXTokenUserConfigBuilder {
    this._salt = value;
    return this;
  }

  get token() {
    return this._token;
  }

  get claims() {
    return this._claims;
  }
}

export class TokenClaimsUserConfigBuilder implements TokenClaimsUserConfig {
  private _topics: string[] = [];
  private _issuers: Record<string, { topics: Array<ClaimTopic> }> = {};

  get topics() {
    return this._topics;
  }
  withTopics(value: EthersT.BigNumberish[]): TokenClaimsUserConfigBuilder {
    this._topics = value.map(v => toClaimTopic(v));
    return this;
  }

  get issuers() {
    return this._issuers;
  }
  withIssuer(issuer: string, topics: EthersT.BigNumberish[]): TokenClaimsUserConfigBuilder {
    if (issuer in this._issuers) {
      throw new Error(`issuer ${issuer} already set.`);
    }
    this._issuers[issuer] = { topics: topics.map(v => toClaimTopic(v)) };
    return this;
  }
}

export class TokenUserConfigBuilder implements TokenUserConfig {
  private _owner: string = EthersT.ZeroAddress;
  private _name: string = '';
  private _symbol: string = '';
  private _decimals: bigint = 0n;
  private _identityRegistryStorage: string = EthersT.ZeroAddress;
  private _identity: string = EthersT.ZeroAddress;
  private _identityRegistryAgents: Array<string> = [];
  private _tokenAgents: Array<string> = [];
  private _complianceModules: Array<string> = [];
  private _complianceSettings: Array<string> = [];

  constructor() {}

  get owner() {
    return this._owner;
  }
  withOwner(value: string): TokenUserConfigBuilder {
    this._owner = EthersT.getAddress(value);
    return this;
  }

  get name() {
    return this._name;
  }
  withName(value: string): TokenUserConfigBuilder {
    this._name = value;
    return this;
  }

  get symbol() {
    return this._symbol;
  }
  withSymbol(value: string): TokenUserConfigBuilder {
    this._symbol = value;
    return this;
  }

  get decimals() {
    return this._decimals;
  }
  withDecimals(value: EthersT.BigNumberish): TokenUserConfigBuilder {
    this._decimals = EthersT.toBigInt(value);
    return this;
  }

  get identityRegistryStorage() {
    return this._identityRegistryStorage;
  }
  withIdentityRegistryStorage(value: string): TokenUserConfigBuilder {
    this._identityRegistryStorage = EthersT.getAddress(value);
    return this;
  }

  get identity() {
    return this._identity;
  }
  withIdentity(value: string): TokenUserConfigBuilder {
    this._identity = EthersT.getAddress(value);
    return this;
  }

  get identityRegistryAgents() {
    return this._identityRegistryAgents;
  }
  withIdentityRegistryAgents(value: string[]): TokenUserConfigBuilder {
    this._identityRegistryAgents = value.map(v => EthersT.getAddress(v));
    return this;
  }

  get tokenAgents() {
    return this._tokenAgents;
  }
  withTokenAgents(value: string[]): TokenUserConfigBuilder {
    this._tokenAgents = value.map(v => EthersT.getAddress(v));
    return this;
  }

  get complianceModules() {
    return this._complianceModules;
  }
  withComplianceModules(value: string[]): TokenUserConfigBuilder {
    this._complianceModules = value.map(v => EthersT.getAddress(v));
    return this;
  }

  get complianceSettings() {
    return this._complianceSettings;
  }
  withComplianceSettings(value: string[]): TokenUserConfigBuilder {
    this._complianceSettings = [...value];
    return this;
  }
}

export class TokenConfig {
  public static ZeroConfig() {
    const config: TREXTokenUserConfig = {
      salt: '',
      token: {
        owner: EthersT.ZeroAddress,
        name: '',
        symbol: '',
        decimals: 0n,
        identityRegistryStorage: EthersT.ZeroAddress,
        identity: EthersT.ZeroAddress,
        identityRegistryAgents: [],
        tokenAgents: [],
        complianceModules: [],
        complianceSettings: [],
      },
      claims: {
        topics: [],
        issuers: {},
      },
    };
    return config;
  }

  public static async loadAny(c: any, chainConfig: ChainConfig) {
    const config: TREXTokenUserConfig = this.ZeroConfig();

    config.salt = this._validateSalt(c?.salt);
    config.token.owner = this._validateAddress(c?.token.salt, true, 'owner', chainConfig);
    config.token.name = this._validateName(c?.token?.name);
    config.token.symbol = this._validateSymbol(c?.token?.symbol);
    config.token.decimals = this._validateBigInt(c.token.decimals, 'decimals', chainConfig);
    config.token.identityRegistryStorage = this._validateAddress(
      c?.token?.identityRegistryStorage,
      true,
      'identityRegistryStorage',
      chainConfig,
    );
    config.token.identity = this._validateAddress(c?.token?.identity, true, 'identity', chainConfig);
    config.token.identityRegistryAgents = this._validateAddressArray(
      c?.token?.identityRegistryAgents,
      true,
      'identityRegistryAgents',
      chainConfig,
    );
    config.token.tokenAgents = this._validateAddressArray(c?.token?.tokenAgents, true, 'tokenAgents', chainConfig);
    config.token.complianceModules = this._validateAddressArray(
      c?.token?.complianceModules,
      true,
      'complianceModules',
      chainConfig,
    );
    config.token.complianceSettings = this._validateComplianceSettings(c?.token?.complianceSettings, true);
    config.claims.topics = this._validateTopics(c?.claims?.topics, true, 'topics');
    config.claims.issuers = this._validateIssuers(c?.claims?.issuers, true, 'issuers', chainConfig);

    return config;
  }

  public static async loadFile(path: string, chainConfig: ChainConfig) {
    const c = await this._readFile(path);
    if (!c) {
      throw new Error(`Unable to load token config file ${path}`);
    }
    return TokenConfig.loadAny(c, chainConfig);
  }

  private static _validateSalt(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Invalid salt property');
  }

  private static _validateName(value: unknown) {
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Invalid name property');
  }

  private static _validateSymbol(value: unknown) {
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Invalid symbol property');
  }

  private static _validateBigInt(value: unknown, name: string, chainConfig: ChainConfig): bigint {
    if (!value) {
      return 0n;
    }
    if (typeof value === 'string' || typeof value === 'bigint' || typeof value === 'number') {
      return EthersT.getBigInt(value);
    }
    throw new Error(`Invalid ${name} property`);
  }

  private static _validateAddress(value: unknown, optional: boolean, name: string, chainConfig: ChainConfig): string {
    if (optional && !value) {
      return EthersT.ZeroAddress;
    }

    if (value === EthersT.ZeroAddress) {
      if (!optional) {
        throw new Error(`Invalid ${name} property, got Zero address!`);
      }
      return value;
    }

    try {
      if (typeof value === 'number' || typeof value === 'string') {
        return chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(value);
      }
    } catch (e) {}

    throw new Error(`Invalid ${name} property`);
  }

  private static _validateAddressArray(
    value: unknown,
    optional: boolean,
    name: string,
    chainConfig: ChainConfig,
  ): Array<string> {
    if (optional && !value) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new Error(`Invalid ${name} property`);
    }
    const res: Array<string> = [];
    for (let i = 0; i < value.length; ++i) {
      const a = this._validateAddress(value[i], true, `${name}[${i}]`, chainConfig);
      if (a === EthersT.ZeroAddress) {
        continue;
      }
      if (!res.includes(a)) {
        res.push(a);
      }
    }

    return res;
  }

  private static _validateComplianceSettings(value: unknown, optional: boolean): Array<string> {
    if (optional && !value) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new Error(`Invalid complianceSettings property`);
    }

    if (value.length === 0) {
      return [];
    }

    throw new Error(`property complianceSettings is not yet supported`);
  }

  private static _validateTopics(value: unknown, optional: boolean, name: string): Array<ClaimTopic> {
    if (optional && !value) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new Error(`Invalid ${name} property`);
    }

    if (value.length === 0) {
      return [];
    }

    const topics: Array<ClaimTopic> = [];
    for (let i = 0; i < value.length; ++i) {
      let t;
      try {
        t = toClaimTopic(value[i]);
        topics.push(t);
      } catch (e) {
        throw new Error(`Invalid topic value ${name}[${i}] = ${value[i]}`);
      }
    }

    return topics;
  }

  private static _validateIssuers(
    value: unknown,
    optional: boolean,
    name: string,
    chainConfig: ChainConfig,
  ): Record<string, { topics: Array<string> }> {
    if (optional && !value) {
      return {};
    }

    const keys = Object.keys(value as object);
    if (keys.length === 0) {
      return {};
    }

    const newIssuers: Record<string, { topics: Array<string> }> = {};
    const issuers: Array<string> = [];
    for (let i = 0; i < keys.length; ++i) {
      // claimIssuers

      const a = this._validateAddress(keys[i], false, `${name}["${keys[i]}"]`, chainConfig);
      if (a === EthersT.ZeroAddress) {
        continue;
      }
      const k = keys[i];
      newIssuers[a] = { topics: this._validateTopics((value as any)[k].topics, false, `${name}["${keys[i]}.topics`) };
      issuers.push(a);
    }

    return newIssuers;
  }

  private static async _readFile(path: string) {
    try {
      const s = fs.readFileSync(path, { encoding: 'utf8' });
      return JSON.parse(s);
    } catch (e) {}
    return undefined;
  }

  public async readFromChain(tokenSalt: string, TREXFactoryAddress: string, chain: ChainConfig) {
    const trexFactory = TREXFactoryAPI.from(TREXFactoryAddress, chain.provider);
    const tokenAddress = await trexFactory.getToken(tokenSalt);
    if (tokenAddress === EthersT.ZeroAddress) {
      return null;
    }

    const token = await TokenAPI.fromSafe(tokenAddress, chain.provider);

    const c = TokenConfig.ZeroConfig();
    c.salt = tokenSalt;

    c.token.name = await token.name();
    c.token.symbol = await token.symbol();
    c.token.decimals = await token.decimals();
    const ir = await TokenAPI.identityRegistry(token, chain.provider);
    c.token.identityRegistryStorage = await (
      await TokenAPI.identityRegistryStorage(token, chain.provider)
    ).getAddress();
    c.token.identity = await token.onchainID();
    const mc = ModularComplianceAPI.from(await token.compliance(), chain.provider);

    const modules = await mc.getModules();
    c.token.complianceModules = modules;

    const ctr = await IdentityRegistryAPI.claimTopicsRegistry(ir, chain.provider);
    const topics = await ctr.getClaimTopics();
    c.claims.topics = topics.map(t => t.toString(10));

    const tir = await IdentityRegistryAPI.trustedIssuersRegistry(ir, chain.provider);
    const issuers = await tir.getTrustedIssuers();

    const issuersObj: Record<string, { topics: Array<ClaimTopic> }> = {};
    for (let i = 0; i < issuers.length; ++i) {
      const ti = issuers[i];
      const topics = await tir.getTrustedIssuerClaimTopics(ti);
      issuersObj[ti] = { topics: topics.map(t => t.toString(10)) };
    }

    c.claims.issuers = issuersObj;

    return c;
  }

  static toCallParams(config: TREXTokenUserConfig) {
    const issuerClaims = Object.entries(config.claims.issuers).map(
      ([, value]) => value.topics as EthersT.BigNumberish[],
    );
    const issuers = Object.keys(config.claims.issuers);
    const tokenDetails: ITREXFactory.TokenDetailsStruct = {
      owner: config.token.owner,
      name: config.token.name,
      symbol: config.token.symbol,
      decimals: config.token.decimals,
      irs: config.token.identityRegistryStorage,
      ONCHAINID: config.token.identity,
      irAgents: [...config.token.identityRegistryAgents],
      tokenAgents: [...config.token.tokenAgents],
      complianceModules: [...config.token.complianceModules],
      complianceSettings: [...config.token.complianceSettings],
    };

    const claimDetails: ITREXFactory.ClaimDetailsStruct = {
      claimTopics: [...config.claims.topics],
      issuers,
      issuerClaims,
    };

    return { salt: config.salt, tokenDetails, claimDetails };
  }
}
