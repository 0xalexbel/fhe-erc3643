import { ethers as EthersT } from 'ethers';
import { TxOptions } from './types';
import { ClaimIssuer, ClaimIssuer__factory, Identity, ITREXFactory } from './artifacts';
import { IdentityAPI } from './IdentityAPI';

//////////////////////////////////////////////////////////////////////////////////

// uint256
export type ClaimTopic = string;

export function toClaimTopic(data: EthersT.BigNumberish): ClaimTopic {
  if (typeof data === 'string') {
    if (data.endsWith('n')) {
      data = data.substring(0, data.length - 1);
    }
  }
  return EthersT.AbiCoder.defaultAbiCoder().encode(['uint256'], [data]);
}

export function toClaimTopicAsBigInt(data: EthersT.BigNumberish): bigint {
  return EthersT.getBigInt(toClaimTopic(data));
}

export class ClaimDetails {
  private _topicsUint256: ClaimTopic[];
  private _issuers: Map<string, ClaimTopic[]>;

  constructor() {
    this._topicsUint256 = [];
    this._issuers = new Map();
  }

  private _addTopic(topic: EthersT.BigNumberish): ClaimTopic {
    const t = toClaimTopic(topic);
    if (!this._topicsUint256.includes(t)) {
      this._topicsUint256.push(t);
    }
    return t;
  }

  public addTopic(topic: EthersT.BigNumberish) {
    return this._addTopic(topic);
  }

  public async addIssuer(issuer: ClaimIssuer, topics: Array<EthersT.BigNumberish>) {
    const _topics: ClaimTopic[] = [];
    for (let i = 0; i < topics.length; ++i) {
      let t = toClaimTopic(topics[i]);
      _topics.push(t);
    }
    const addr = await issuer.getAddress();
    if (this._issuers.has(addr)) {
      throw new Error('Issuer already added');
    }
    this._issuers.set(addr, _topics);
  }

  public toTREXClaimDetailsStruct(): ITREXFactory.ClaimDetailsStruct {
    return {
      claimTopics: [...this._topicsUint256],
      issuers: [...this._issuers.keys()],
      issuerClaims: [...this._issuers.values()],
    };
  }
}

export class ClaimIssuerAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): ClaimIssuer {
    const contract = ClaimIssuer__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  /**
   * Permission: public
   */
  static async createSignedClaim(
    issuer: ClaimIssuer,
    issuerKey: EthersT.Signer,
    identity: Identity,
    data: Uint8Array,
    topic: EthersT.BigNumberish,
  ) {
    const claim = {
      data: EthersT.hexlify(data),
      issuer: issuer,
      topic,
      scheme: 1,
      identity: await identity.getAddress(),
      signature: '',
    };

    claim.signature = await issuerKey.signMessage(
      EthersT.getBytes(
        EthersT.keccak256(
          EthersT.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'bytes'],
            [claim.identity, claim.topic, claim.data],
          ),
        ),
      ),
    );

    return claim;
  }

  /**
   * Permission: public
   */
  static async fromManager(address: string, manager: EthersT.Signer) {
    const issuer = ClaimIssuer__factory.connect(address, manager);

    const ok = await IdentityAPI.isManagementKey(issuer, manager);
    if (!ok) {
      throw new Error(`ClaimIssuer deployer should be a Management key.`);
    }

    return issuer;
  }

  /**
   * Permission: public
   */
  static async deployNewClaimIssuer(
    initialManagementKey: EthersT.AddressLike,
    deployer: EthersT.Signer,
    options?: TxOptions,
  ) {
    const initialManagementKeyAddress = await EthersT.resolveAddress(initialManagementKey);
    if (initialManagementKeyAddress === EthersT.ZeroAddress) {
      throw new Error(`Invalid management key ${initialManagementKeyAddress}`);
    }

    const factory = new ClaimIssuer__factory();

    const issuer: ClaimIssuer = await factory.connect(deployer).deploy(initialManagementKey);
    await issuer.waitForDeployment();

    const ok = await IdentityAPI.isManagementKey(issuer, initialManagementKey);
    if (!ok) {
      throw new Error(`key ${initialManagementKeyAddress} is not a Management key.`);
    }

    if (options) {
      const issuerAddress = await issuer.getAddress();

      if (options.progress) {
        options.progress.contractDeployed('ClaimIssuer', issuerAddress);
      }

      if (options.chainConfig) {
        await options.chainConfig.saveClaimIssuer(issuerAddress);
      }
    }

    return issuer;
  }
}
