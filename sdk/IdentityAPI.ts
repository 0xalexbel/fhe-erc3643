import { ethers as EthersT } from 'ethers';
import { TxOptions } from './types';
import { ClaimIssuer, Identity, Identity__factory } from './artifacts';
import { txWait } from './utils';
import { ClaimIssuerAPI, SignedClaim } from './ClaimIssuerAPI';
import { FheERC3643Error } from './errors';

export const KEY_PURPOSE_MANAGEMENT = 1;
export const KEY_PURPOSE_ACTION = 2;
export const KEY_PURPOSE_CLAIM = 3;
export const KEY_TYPE_ECDSA = 1;

export class IdentityAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): Identity {
    const contract = Identity__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  public static keyPurposeToString(purpose: number) {
    switch (purpose) {
      case KEY_PURPOSE_MANAGEMENT:
        return 'management';
      case KEY_PURPOSE_ACTION:
        return 'action';
      case KEY_PURPOSE_CLAIM:
        return 'claim';
      default:
        return `purpose=${purpose}`;
    }
  }

  /**
   * Permissions: Public
   */
  static async keyHasPurpose(
    identity: Identity,
    key: EthersT.AddressLike,
    purpose: number,
    runner?: EthersT.ContractRunner,
  ): Promise<boolean> {
    const hash = await this._toKey(key);
    if (hash === EthersT.ZeroHash) {
      throw new FheERC3643Error('Invalid identity key');
    }
    identity = runner ? identity.connect(runner) : identity;
    return await identity.keyHasPurpose(hash, purpose);
  }

  /**
   * - Permissions: Manager.
   * - Adds `key` as a management key in `identity`
   * @throws `Error` if `manager` is not a management key stored in `identity`
   */
  static async addManagementKey(
    identity: Identity,
    key: EthersT.AddressLike,
    manager: EthersT.Signer,
    options: TxOptions,
  ) {
    if (await this.keyHasPurpose(identity, key, KEY_PURPOSE_MANAGEMENT)) {
      throw new FheERC3643Error(`Key ${await EthersT.resolveAddress(key)} is already a management key`);
    }
    return this.addKey(identity, key, KEY_PURPOSE_MANAGEMENT, KEY_TYPE_ECDSA, manager, options);
  }

  /**
   * Permissions: Manager
   * @throws `Error` if `manager` is not a management key stored in `identity`
   */
  static async addClaimKey(identity: Identity, key: EthersT.AddressLike, manager: EthersT.Signer, options: TxOptions) {
    return this.addKey(identity, key, KEY_PURPOSE_CLAIM, KEY_TYPE_ECDSA, manager, options);
  }

  /**
   * Permissions: Manager
   * @throws `Error` if `manager` is not a management key stored in `identity`
   */
  static async addActionKey(identity: Identity, key: EthersT.AddressLike, manager: EthersT.Signer, options: TxOptions) {
    return this.addKey(identity, key, KEY_PURPOSE_ACTION, KEY_TYPE_ECDSA, manager, options);
  }

  /**
   * Permissions: Manager
   * @throws `Error` if `manager` is not a management key stored in `identity`
   * @throws `Error` if `key` is already a key with the same `purpose` stored in `identity`
   */
  static async addKey(
    identity: Identity,
    key: EthersT.AddressLike,
    purpose: number,
    type: number,
    manager: EthersT.Signer,
    options: TxOptions,
  ) {
    const hash = await this._toKey(key);

    if (hash === EthersT.ZeroHash) {
      throw new FheERC3643Error('Invalid identity key');
    }

    if (!(await this.isManager(identity, manager))) {
      throw new FheERC3643Error(
        `Permission error : ${await manager.getAddress()} is not a manager of ${await identity.getAddress()}`,
      );
    }

    if (await this.keyHasPurpose(identity, key, purpose)) {
      const keyAddress = await EthersT.resolveAddress(key);
      throw new FheERC3643Error(`Key ${keyAddress} is already a ${this.keyPurposeToString(purpose)} key`);
    }

    await txWait(identity.connect(manager).addKey(hash, purpose, type), options);

    const ok = await this.keyHasPurpose(identity, key, purpose);
    if (!ok) {
      throw new FheERC3643Error(`Identity addKey has not completed.`);
    }
  }

  /**
   * Permissions: public
   */
  static async toClaimId(issuer: ClaimIssuer, topic: EthersT.BigNumberish) {
    //bytes32 claimId = keccak256(abi.encode(_issuer, _topic));
    return EthersT.keccak256(
      EthersT.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [await issuer.getAddress(), topic]),
    );
  }

  /**
   * Permissions: Manager
   * @throws `Error` if `manager` is not a management key stored in `identity`
   */
  static async addClaim(
    identity: Identity,
    signedClaim: SignedClaim,
    uri: string,
    manager: EthersT.Signer,
    options: TxOptions,
  ) {
    if (!(await this.isManager(identity, manager))) {
      throw new FheERC3643Error(
        `Permission error : ${await manager.getAddress()} is not a manager of ${await identity.getAddress()}`,
      );
    }

    await txWait(
      identity
        .connect(manager)
        .addClaim(
          signedClaim.topic,
          signedClaim.scheme,
          signedClaim.issuer,
          signedClaim.signature,
          signedClaim.data,
          uri,
        ),
      options,
    );

    const claimId = await this.toClaimId(signedClaim.issuer, signedClaim.topic);

    const _claim = await identity.connect(manager).getClaim(claimId);
    if (_claim[2] !== (await signedClaim.issuer.getAddress())) {
      throw new FheERC3643Error(
        `Claim ${claimId} has not been properly added to identity ${await identity.getAddress()}`,
      );
    }

    return claimId;
  }

  /**
   * Permissions: public
   */
  static async getClaim(
    identity: Identity,
    topic: EthersT.BigNumberish,
    issuer: ClaimIssuer,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ) {
    const claimId = await this.toClaimId(issuer, topic);

    const res = await identity.connect(runner).getClaim(claimId);

    return {
      topic: res[0] as bigint,
      scheme: res[1] as bigint,
      issuer: ClaimIssuerAPI.from(res[2], runner),
      signature: res[3] as string,
      data: res[4] as string,
      uri: res[5] as string,
    };
  }

  /**
   * Permissions: public
   */
  static async hasClaim(
    identity: Identity,
    topic: EthersT.BigNumberish,
    issuer: ClaimIssuer,
    runner: EthersT.ContractRunner,
    options?: TxOptions,
  ) {
    const claimId = await this.toClaimId(issuer, topic);

    const res = await identity.connect(runner).getClaim(claimId);

    if (res[2] === EthersT.ZeroAddress) {
      return false;
    }

    if (res[2] !== (await issuer.getAddress())) {
      throw new FheERC3643Error(`Internal error, unexpected claim issuer`);
    }

    return true;
  }

  /**
   * Permissions: public
   */
  static async removeClaim(
    identity: Identity,
    topic: EthersT.BigNumberish,
    issuer: ClaimIssuer,
    manager: EthersT.Signer,
    options: TxOptions,
  ) {
    if (!(await this.isManager(identity, manager))) {
      throw new FheERC3643Error(
        `Permission error : ${await manager.getAddress()} is not a manager of ${await identity.getAddress()}`,
      );
    }

    const claimId = await this.toClaimId(issuer, topic);

    if (!(await this.hasClaim(identity, topic, issuer, manager, options))) {
      // already removed
      return claimId;
    }

    await txWait(identity.connect(manager).removeClaim(claimId), options);

    const _claim = await identity.connect(manager).getClaim(claimId);
    if (_claim[2] !== EthersT.ZeroAddress) {
      throw new FheERC3643Error(
        `Claim id ${claimId} has not been removed from identity ${await identity.getAddress()}`,
      );
    }

    return claimId;
  }

  /**
   * Permissions: Manager
   * @throws `Error` if `manager` is not a management key stored in `identity`
   */
  static async removeKey(
    identity: Identity,
    key: EthersT.AddressLike,
    purpose: number,
    manager: EthersT.Signer,
    options: TxOptions,
  ) {
    const hash = await this._toKey(key);

    if (hash === EthersT.ZeroHash) {
      throw new FheERC3643Error('Invalid identity key');
    }

    if (!(await this.isManager(identity, manager))) {
      throw new FheERC3643Error(
        `Permission error : ${await manager.getAddress()} is not a manager of ${await identity.getAddress()}`,
      );
    }

    if (!(await this.keyHasPurpose(identity, key, purpose))) {
      return;
    }

    await txWait(identity.connect(manager).removeKey(hash, purpose), options);

    const ok = await this.keyHasPurpose(identity, key, purpose);
    if (ok) {
      throw new FheERC3643Error(`Identity removeKey has not completed.`);
    }
  }

  /**
   * Permissions: Public
   * @returns true if `user` is a manager of `identity`
   */
  static async isManager(identity: Identity, user: EthersT.AddressLike) {
    return this.isManagementKey(identity, user);
  }

  /**
   * Permissions: Public
   * @returns true if `key` is a management key of `identity`
   */
  static async isManagementKey(identity: Identity, key: EthersT.AddressLike): Promise<boolean> {
    return this.keyHasPurpose(identity, key, KEY_PURPOSE_MANAGEMENT);
  }

  /**
   * Permissions: Public
   * @returns true if `key` is a claim key of `identity`
   */
  static async isClaimKey(identity: Identity, key: EthersT.AddressLike): Promise<boolean> {
    return this.keyHasPurpose(identity, key, KEY_PURPOSE_CLAIM);
  }

  /**
   * Permissions: Public
   * @returns true if `key` is an action key of `identity`
   */
  static async isActionKey(identity: Identity, key: EthersT.AddressLike): Promise<boolean> {
    return this.keyHasPurpose(identity, key, KEY_PURPOSE_ACTION);
  }

  private static async _toKey(key: EthersT.AddressLike): Promise<EthersT.BytesLike> {
    const keyAddr = await EthersT.resolveAddress(key);
    if (keyAddr === EthersT.ZeroAddress) {
      return EthersT.ZeroHash;
    }
    return EthersT.keccak256(EthersT.AbiCoder.defaultAbiCoder().encode(['address'], [keyAddr]));
  }
}
