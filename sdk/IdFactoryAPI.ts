import { ethers as EthersT } from 'ethers';
import {
  IdFactory,
  IdFactory__factory,
  ImplementationAuthority,
  ImplementationAuthority__factory,
  Token,
} from './artifacts';
import { History, TxOptions, WalletResolver } from './types';
import { IdentityImplementationAuthorityAPI } from './IdentityImplementationAuthorityAPI';
import { isDeployed, txWait } from './utils';
import { FheERC3643Error, FheERC3643InternalError, throwIfInvalidAddress, throwIfNotOwner } from './errors';
import { getLogEventArgs } from '../test/utils';

export class IdFactoryAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): IdFactory {
    const contract = IdFactory__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async fromSafe(address: string, runner: EthersT.ContractRunner): Promise<IdFactory> {
    if (!runner.provider) {
      throw new FheERC3643InternalError('ContractRunner has no provider');
    }

    const contract = IdFactory__factory.connect(address);

    if (!(await isDeployed(runner.provider, address))) {
      throw new FheERC3643Error(`IdFactory ${address} is not deployed`);
    }

    return contract.connect(runner);
  }

  // Public
  static async deployNewIdentity(
    idFactory: IdFactory,
    initialManagementKey: EthersT.AddressLike,
    deployer: EthersT.Signer,
    history: History,
    options?: TxOptions,
  ) {
    const implementationAuthorityAddress = await idFactory.connect(deployer).implementationAuthority();
    const implementationAuthority = ImplementationAuthority__factory.connect(implementationAuthorityAddress);
    return IdentityImplementationAuthorityAPI.deployNewIdentity(
      implementationAuthority,
      initialManagementKey,
      deployer,
      history,
      options,
    );
  }

  static async createTokenIdentity(
    idFactory: IdFactory,
    idFactoryOwner: EthersT.Signer,
    token: Token,
    currentTokenOwner: EthersT.Signer,
    futureTokenOwner: EthersT.AddressLike,
    futureTokenSalt: string,
    provider: EthersT.Provider,
    walletResolver: WalletResolver,
    options: TxOptions,
  ) {
    await throwIfNotOwner('IdFactory', idFactory, idFactoryOwner, provider, walletResolver);

    let txReceipt = await txWait(
      idFactory
        .connect(idFactoryOwner)
        .createTokenIdentity(token, futureTokenOwner, futureTokenSalt, { gasLimit: options?.gasLimit }),
      options,
    );
    let args = getLogEventArgs(txReceipt, 'TokenLinked', undefined, idFactory);
    if (args.length !== 2 || args[0] !== (await token.getAddress())) {
      throw new FheERC3643Error(`Create token identity failed`);
    }
    const tokenIDAddress = args[1];
    throwIfInvalidAddress(tokenIDAddress);

    txReceipt = await txWait(
      token.connect(currentTokenOwner).setOnchainID(tokenIDAddress, { gasLimit: options?.gasLimit }),
      options,
    );

    //emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenDecimals, _TOKEN_VERSION, _tokenOnchainID);
    args = getLogEventArgs(txReceipt, 'UpdatedTokenInformation', undefined, token);
    if (args.length !== 5 || args[4] !== tokenIDAddress) {
      throw new FheERC3643Error(`Create token identity failed`);
    }
  }

  static async fromWithOwner(address: string, owner: EthersT.Signer) {
    const idFactory = this.from(address, owner);
    const implementationAuthorityAddress = await idFactory.implementationAuthority();
    const implementationAuthority: ImplementationAuthority = ImplementationAuthority__factory.connect(
      implementationAuthorityAddress,
      owner,
    );

    if ((await idFactory.owner()) !== (await owner.getAddress())) {
      throw new FheERC3643Error('signer is not the owner of idFactory.owner');
    }

    if ((await implementationAuthority.owner()) !== (await owner.getAddress())) {
      throw new FheERC3643Error('signer is not the owner of idFactory.implementationAuthority.owner');
    }

    return {
      idFactory,
      implementationAuthority,
    };
  }
}
