import assert from 'assert';
import { ethers as EthersT } from 'ethers';
import {
  ITREXFactory,
  ModularCompliance__factory,
  Token,
  TREXFactory,
  TREXFactory__factory,
  TREXImplementationAuthority,
} from '../types';
import { IdFactoryAPI } from './IdFactoryAPI';
import { TokenAPI } from './TokenAPI';
import { ClaimDetails } from './ClaimIssuerAPI';
import { TxOptions } from './types';
import { txWait } from './utils';
import { IdentityRegistryAPI } from './IdentityRegistryAPI';
import { TREXImplementationAuthorityAPI } from './TRexImplementationAuthorityAPI';
import { FheERC3643Error, throwIfNotOwner } from './errors';
import { ChainConfig } from './ChainConfig';
import { ModularComplianceAPI } from './ModuleComplianceAPI';
import { IdentityAPI } from './IdentityAPI';
import { IdentityImplementationAuthorityAPI } from './IdentityImplementationAuthorityAPI';
import { NewTokenResult } from './cli/token';
import { ClaimTopicsRegistryAPI } from './ClaimTopicsRegistryAPI';

export class TREXFactoryAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): TREXFactory {
    const contract = TREXFactory__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  /**
   * Requirements:
   * - TREXFactory.owner === owner
   * - TREXFactory.implementationAuthority.owner === owner
   */
  static async fromWithOwner(address: string, owner: EthersT.Signer) {
    const factory: TREXFactory = TREXFactory__factory.connect(address, owner);

    const factoryOwnerAddress = await factory.owner();
    const ownerAddress = await owner.getAddress();
    if (factoryOwnerAddress !== ownerAddress) {
      throw new FheERC3643Error(
        `owner ${ownerAddress} is not the owner of TREXFactory ${address}, the actual owner is ${factoryOwnerAddress}`,
      );
    }

    const authorityAddress = await factory.getImplementationAuthority();

    const authority: TREXImplementationAuthority = await TREXImplementationAuthorityAPI.fromWithOwner(
      authorityAddress,
      owner,
    );

    const { major, minor, patch } = await authority.getCurrentVersion();
    if (major !== 4n || minor !== 0n || patch !== 0n) {
      throw new FheERC3643Error('Unexpected TREX version number');
    }

    const idFactory = IdFactoryAPI.from(await factory.getIdFactory(), owner);
    const isTokenFactory = await idFactory.isTokenFactory(factory);
    if (!isTokenFactory) {
      throw new FheERC3643Error('TREXFactory is not linked to its identity factory');
    }

    return factory;
  }

  /**
   * Permissions: public.
   */
  static async tokenFromSalt(
    factory: TREXFactory,
    salt: string,
    runner: EthersT.ContractRunner,
  ): Promise<Token | null> {
    const tokenAddress = await factory.getToken(salt);
    if (tokenAddress === EthersT.ZeroAddress) {
      return null;
    }

    return TokenAPI.from(tokenAddress, runner);
  }

  /**
   * Permissions: public.
   */
  static async tokenFromSaltWithOwner(
    factory: TREXFactory,
    salt: string,
    tokenOwner: EthersT.Signer,
  ): Promise<Token | null> {
    const tokenAddress = await factory.getToken(salt);
    if (tokenAddress === EthersT.ZeroAddress) {
      return null;
    }

    const token = TokenAPI.from(tokenAddress, tokenOwner);
    const actualOwnerAddress = await token.owner();
    const expectedOwnerAddress = await tokenOwner.getAddress();
    if (actualOwnerAddress !== expectedOwnerAddress) {
      throw new FheERC3643Error(
        `${expectedOwnerAddress} is not the token owner, the actual token owner is ${actualOwnerAddress}`,
      );
    }

    return token;
  }

  // /**
  //  * Permissions: ???
  //  */
  // static async createNewToken(
  //   factory: TREXFactory,
  //   salt: string,
  //   tokenOwner: EthersT.AddressLike,
  //   claimDetails: ClaimDetails,
  //   irAgent: EthersT.AddressLike,
  //   deployer: EthersT.Signer,
  //   chainConfig: ChainConfig,
  //   options: TxOptions,
  // ) {
  //   let tokenDetails: ITREXFactory.TokenDetailsStruct = {
  //     owner: tokenOwner, //will be token management key
  //     name: 'TREXDINO',
  //     symbol: 'TREX',
  //     decimals: 0n,
  //     irs: EthersT.ZeroAddress, //created by the suite
  //     ONCHAINID: EthersT.ZeroAddress, // created by the suite owner is management key
  //     irAgents: [irAgent], //ir.AddAgent(...)
  //     tokenAgents: [], //token.AddAgent(...) agentManager
  //     complianceModules: [],
  //     complianceSettings: [],
  //   };

  //   const token = await this.deployTREXSuite(
  //     factory,
  //     salt,
  //     tokenDetails,
  //     claimDetails.toTREXClaimDetailsStruct(),
  //     deployer,
  //     chainConfig,
  //     options,
  //   );

  //   return token;
  // }

  /**
   * Permissions: factory owner
   */
  static async deployTREXSuite(
    factory: TREXFactory,
    salt: string,
    tokenDetails: ITREXFactory.TokenDetailsStruct,
    claimDetails: ITREXFactory.ClaimDetailsStruct,
    factoryOwner: EthersT.Signer,
    chainConfig: ChainConfig,
    options: TxOptions,
  ) {
    const existingToken = await TREXFactoryAPI.tokenFromSalt(factory, salt, factoryOwner);
    if (existingToken) {
      throw new FheERC3643Error(
        `Token with salt '${salt}' already exists in TREX factory ${await factory.getAddress()}`,
      );
    }

    const txReceipt = await txWait(
      factory.connect(factoryOwner).deployTREXSuite(salt, tokenDetails, claimDetails),
      options,
    );

    if (!txReceipt) {
      throw new FheERC3643Error('Deploy TREXSuite failed!');
    }

    if (options?.progress) {
      options.progress.contractDeployed('TREXFactory', await factory.getAddress());
    }

    const log = txReceipt.logs.find(log => 'eventName' in log && log.eventName === 'TREXSuiteDeployed');
    if (!log) {
      throw new FheERC3643Error('Deploy TREXSuite failed!');
    }
    assert(log);
    assert('args' in log);

    //   address indexed _token,
    //   address _ir, identityRegistry
    //   address _irs, identityRegistryStorage
    //   address _tir, trust
    //   address _ctr, claimTopics
    //   address _mc, modularCompliance
    //   string indexed _salt
    const tokenAddress = log.args[0];

    const token = await TREXFactoryAPI.tokenFromSalt(factory, salt, chainConfig.provider);
    if ((await token?.getAddress()) !== tokenAddress) {
      throw new FheERC3643Error('Deploy TREXSuite failed! New token is not stored in the TREXFactory.');
    }

    await chainConfig.saveToken(tokenAddress);

    return {
      token: tokenAddress,
      ir: log.args[1],
      irs: log.args[2],
      tir: log.args[3],
      ctr: log.args[4],
      mc: log.args[5],
      saltHash: log.args[6].hash,
    };
  }

  //////////////////////////////////////////////////////////////////////////////

  static async transferTokenOwnership(
    token: Token,
    fromOwner: EthersT.Signer,
    toOwner: EthersT.Signer,
    chainConfig: ChainConfig,
    options: TxOptions,
  ) {
    const fromOwnerAddress = await fromOwner.getAddress();
    const toOwnerAddress = await toOwner.getAddress();
    if (fromOwnerAddress === toOwnerAddress) {
      return;
    }

    const tokenAddress = await token.getAddress();
    if (tokenAddress === EthersT.ZeroAddress) {
      return null;
    }

    token = token.connect(fromOwner);
    throwIfNotOwner('Token', chainConfig, token, fromOwner);

    const ir = await TokenAPI.identityRegistry(token, fromOwner);

    const tir = await IdentityRegistryAPI.trustedIssuersRegistry(ir, fromOwner);
    const ctr = await IdentityRegistryAPI.claimTopicsRegistry(ir, fromOwner);
    const mc = await TokenAPI.compliance(token, fromOwner);

    const actualTokenOwnerAddress = await token.owner();
    const actualMCOwnerAddress = await mc.owner();
    const actualIROwnerAddress = await ir.owner();
    const actualTIROwnerAddress = await tir.owner();
    const actualCTROwnerAddress = await ctr.owner();

    throwIfNotOwner('Token', chainConfig, token, fromOwnerAddress);
    throwIfNotOwner('IdentityRegistry', chainConfig, ir, fromOwnerAddress);
    throwIfNotOwner('TrustedIssuersRegistry', chainConfig, tir, fromOwnerAddress);
    throwIfNotOwner('ClaimTopicsRegistry', chainConfig, ctr, fromOwnerAddress);
    throwIfNotOwner('ModularCompliance', chainConfig, mc, fromOwnerAddress);

    if (toOwnerAddress !== actualTokenOwnerAddress) {
      await txWait(token.transferOwnership(toOwner), options);
    }
    if (toOwnerAddress !== actualIROwnerAddress) {
      await txWait(ir.connect(fromOwner).transferOwnership(toOwner), options);
    }
    if (toOwnerAddress !== actualTIROwnerAddress) {
      await txWait(tir.connect(fromOwner).transferOwnership(toOwner), options);
    }
    if (toOwnerAddress !== actualCTROwnerAddress) {
      await txWait(ctr.connect(fromOwner).transferOwnership(toOwner), options);
    }
    if (toOwnerAddress !== actualMCOwnerAddress) {
      await txWait(mc.connect(fromOwner).transferOwnership(toOwner), options);
    }
  }

  //////////////////////////////////////////////////////////////////////////////

  static async deployTREXSuiteManual(
    factory: TREXFactory,
    salt: string,
    tokenDetails: ITREXFactory.TokenDetailsStruct,
    claimDetails: ITREXFactory.ClaimDetailsStruct,
    tokenOwner: EthersT.Signer,
    factoryOwner: EthersT.Signer,
    chainConfig: ChainConfig,
    options: TxOptions,
  ): Promise<NewTokenResult> {
    if (tokenDetails.owner !== (await tokenOwner.getAddress())) {
      throw new FheERC3643Error(`Invalid token owner.`);
    }

    const trexImplementationAuthorityAddress = await factory.connect(factoryOwner).getImplementationAuthority();
    const trexImplementationAuthority = await TREXImplementationAuthorityAPI.fromWithOwner(
      trexImplementationAuthorityAddress,
      factoryOwner,
    );

    //Deploy IdentityRegistry
    const { identityRegistry, identityRegistryStorage, trustedIssuersRegistry, claimTopicsRegistry } =
      await IdentityRegistryAPI.deployNew(trexImplementationAuthority, factoryOwner, options);

    // Deploy compliance
    const compliance = await ModularComplianceAPI.deployNew(factory, factoryOwner, options);

    // Deploy token
    const token = await TokenAPI.deployNew(
      factory,
      factoryOwner,
      factoryOwner,
      identityRegistry,
      compliance,
      salt,
      tokenDetails,
      chainConfig,
      options,
    );

    //Claim detials
    for (let i = 0; i < claimDetails.claimTopics.length; ++i) {
      await txWait(claimTopicsRegistry.addClaimTopic(claimDetails.claimTopics[i]), options);
    }
    for (let i = 0; i < claimDetails.issuers.length; ++i) {
      await txWait(
        trustedIssuersRegistry.addTrustedIssuer(claimDetails.issuers[i], claimDetails.issuerClaims[i]),
        options,
      );
    }

    // Transfer ownership
    await TREXFactoryAPI.transferTokenOwnership(token, factoryOwner, tokenOwner, chainConfig, options);

    return {
      token: await token.getAddress(),
      ir: await identityRegistry.getAddress(),
      ctr: await claimTopicsRegistry.getAddress(),
      irs: await identityRegistryStorage.getAddress(),
      tir: await trustedIssuersRegistry.getAddress(),
      mc: await compliance.getAddress(),
      saltHash: EthersT.ZeroHash,
    };

    //        AgentRole(address(ir)).addAgent(address(token));

    // IdentityImplementationAuthorityAPI.deployNewIdentity()
    // const tokenOID = await IdentityAPI(
    //   identityImplementationAuthority,
    //   managementKey,
    //   deployer,
    //   `token: ${tokenName}`,
    //   progress,
    // );

    //ITrustedIssuersRegistry tir = ITrustedIssuersRegistry(_deployTIR(_salt, _implementationAuthority));
    /*

  //Deploy Compliance
  const defaultCompliance = await hre.ethers.deployContract('DefaultCompliance', deployer);
  await defaultCompliance.waitForDeployment();
  progress.logContractStep('DefaultCompliance', await defaultCompliance.getAddress());

  const { token, tokenOID, agentManager } = await deployTRexToken(
    'TREXDINO',
    'TREX',
    0n,
    identityImplementationAuthority,
    trexImplementationAuthority,
    tokenIssuer.address,
    identityRegistry,
    defaultCompliance,
    tokenAgent,
    deployer,
    progress,
  );

    */
  }

  /*
        require(_tokenDeployed[_salt] == address(0), "token already deployed");
        require((_claimDetails.issuers).length == (_claimDetails.issuerClaims).length, "claim pattern not valid");
        require((_claimDetails.issuers).length <= 5, "max 5 claim issuers at deployment");
        require((_claimDetails.claimTopics).length <= 5, "max 5 claim topics at deployment");
        require(
            (_tokenDetails.irAgents).length <= 5 && (_tokenDetails.tokenAgents).length <= 5,
            "max 5 agents at deployment"
        );
        require((_tokenDetails.complianceModules).length <= 30, "max 30 module actions at deployment");
        require(
            (_tokenDetails.complianceModules).length >= (_tokenDetails.complianceSettings).length,
            "invalid compliance pattern"
        );

        ITrustedIssuersRegistry tir = ITrustedIssuersRegistry(_deployTIR(_salt, _implementationAuthority));
        IClaimTopicsRegistry ctr = IClaimTopicsRegistry(_deployCTR(_salt, _implementationAuthority));
        IModularCompliance mc = IModularCompliance(_deployMC(_salt, _implementationAuthority));
        IIdentityRegistryStorage irs;
        if (_tokenDetails.irs == address(0)) {
            irs = IIdentityRegistryStorage(_deployIRS(_salt, _implementationAuthority));
        } else {
            irs = IIdentityRegistryStorage(_tokenDetails.irs);
        }
        IIdentityRegistry ir = IIdentityRegistry(
            _deployIR(_salt, _implementationAuthority, address(tir), address(ctr), address(irs))
        );
        IToken token = IToken(
            _deployToken(
                _salt,
                _implementationAuthority,
                address(ir),
                address(mc),
                _tokenDetails.name,
                _tokenDetails.symbol,
                _tokenDetails.decimals,
                _tokenDetails.ONCHAINID
            )
        );
        if (_tokenDetails.ONCHAINID == address(0)) {
            address _tokenID = IIdFactory(_idFactory).createTokenIdentity(address(token), _tokenDetails.owner, _salt);
            token.setOnchainID(_tokenID);
        }
        for (uint256 i = 0; i < (_claimDetails.claimTopics).length; i++) {
            ctr.addClaimTopic(_claimDetails.claimTopics[i]);
        }
        for (uint256 i = 0; i < (_claimDetails.issuers).length; i++) {
            tir.addTrustedIssuer(IClaimIssuer((_claimDetails).issuers[i]), _claimDetails.issuerClaims[i]);
        }
        irs.bindIdentityRegistry(address(ir));
        AgentRole(address(ir)).addAgent(address(token));
        for (uint256 i = 0; i < (_tokenDetails.irAgents).length; i++) {
            AgentRole(address(ir)).addAgent(_tokenDetails.irAgents[i]);
        }
        for (uint256 i = 0; i < (_tokenDetails.tokenAgents).length; i++) {
            AgentRole(address(token)).addAgent(_tokenDetails.tokenAgents[i]);
        }
        for (uint256 i = 0; i < (_tokenDetails.complianceModules).length; i++) {
            if (!mc.isModuleBound(_tokenDetails.complianceModules[i])) {
                mc.addModule(_tokenDetails.complianceModules[i]);
            }
            if (i < (_tokenDetails.complianceSettings).length) {
                mc.callModuleFunction(_tokenDetails.complianceSettings[i], _tokenDetails.complianceModules[i]);
            }
        }
        _tokenDeployed[_salt] = address(token);
        (Ownable(address(token))).transferOwnership(_tokenDetails.owner);
        (Ownable(address(ir))).transferOwnership(_tokenDetails.owner);
        (Ownable(address(tir))).transferOwnership(_tokenDetails.owner);
        (Ownable(address(ctr))).transferOwnership(_tokenDetails.owner);
        (Ownable(address(mc))).transferOwnership(_tokenDetails.owner);
        emit TREXSuiteDeployed(
            address(token),
            address(ir),
            address(irs),
            address(tir),
            address(ctr),
            address(mc),
            _salt
        );

  */
}
