import { ethers as EthersT } from 'ethers';
import {
  ClaimTopicsRegistry,
  ClaimTopicsRegistry__factory,
  ClaimTopicsRegistryProxy__factory,
  Identity,
  IdentityRegistry,
  IdentityRegistry__factory,
  IdentityRegistryProxy__factory,
  IdentityRegistryStorage,
  IdentityRegistryStorage__factory,
  IdentityRegistryStorageProxy__factory,
  TREXImplementationAuthority,
  TrustedIssuersRegistry,
  TrustedIssuersRegistry__factory,
  TrustedIssuersRegistryProxy__factory,
} from './artifacts';
import { IdentityRegistryStorageAPI } from './IdentityRegistryStorageAPI';
import { ClaimTopicsRegistryAPI } from './ClaimTopicsRegistryAPI';
import { TrustedIssuersRegistryAPI } from './TrustedIssuersRegistryAPI';
import { IdentityAPI } from './IdentityAPI';
import { TxOptions } from './types';
import { logDeployOK, logStepOK } from './log';
import { txWait } from './utils';

export class IdentityRegistryAPI {
  static from(address: string, runner?: EthersT.ContractRunner | null): IdentityRegistry {
    const contract = IdentityRegistry__factory.connect(address);
    if (runner !== undefined) {
      return contract.connect(runner);
    }
    return contract;
  }

  static async identityRegistryStorage(
    ir: IdentityRegistry,
    runner?: EthersT.ContractRunner | null,
  ): Promise<IdentityRegistryStorage> {
    return IdentityRegistryStorageAPI.from(await ir.identityStorage(), runner);
  }

  static async claimTopicsRegistry(
    ir: IdentityRegistry,
    runner?: EthersT.ContractRunner | null,
  ): Promise<ClaimTopicsRegistry> {
    return ClaimTopicsRegistryAPI.from(await ir.topicsRegistry(), runner);
  }

  static async trustedIssuersRegistry(
    ir: IdentityRegistry,
    runner?: EthersT.ContractRunner | null,
  ): Promise<TrustedIssuersRegistry> {
    return TrustedIssuersRegistryAPI.from(await ir.issuersRegistry(), runner);
  }

  static async identity(
    ir: IdentityRegistry,
    user: EthersT.AddressLike,
    runner?: EthersT.ContractRunner | null,
  ): Promise<Identity | undefined> {
    const addr = await ir.identity(user);
    if (addr === EthersT.ZeroAddress) {
      return undefined;
    }
    return IdentityAPI.from(addr, runner);
  }

  static async deployNew(
    trexImplementationAuthority: TREXImplementationAuthority,
    deployer: EthersT.Signer,
    options: TxOptions,
  ) {
    // ClaimTopicsRegistryProxy
    const ctr_factory = new ClaimTopicsRegistryProxy__factory().connect(deployer);
    const ctr_proxy = await ctr_factory.deploy(trexImplementationAuthority);
    await ctr_proxy.waitForDeployment();
    const ctr = ClaimTopicsRegistry__factory.connect(await ctr_proxy.getAddress()).connect(deployer);
    await logDeployOK('ClaimTopicsRegistryProxy', ctr);

    // TrustedIssuersRegistryProxy
    const tir_factory = new TrustedIssuersRegistryProxy__factory().connect(deployer);
    const tir_proxy = await tir_factory.deploy(trexImplementationAuthority);
    await tir_proxy.waitForDeployment();
    const tir = TrustedIssuersRegistry__factory.connect(await tir_proxy.getAddress()).connect(deployer);
    await logDeployOK('TrustedIssuersRegistryProxy', tir);

    // IdentityRegistryStorageProxy
    const irs_factory = new IdentityRegistryStorageProxy__factory().connect(deployer);
    const irs_proxy = await irs_factory.deploy(trexImplementationAuthority);
    await irs_proxy.waitForDeployment();
    const irs = IdentityRegistryStorage__factory.connect(await irs_proxy.getAddress()).connect(deployer);
    await logDeployOK('IdentityRegistryStorageProxy', irs);

    // IdentityRegistryProxy
    const ir_factory = new IdentityRegistryProxy__factory().connect(deployer);
    const ir_proxy = await ir_factory.deploy(trexImplementationAuthority, tir, ctr, irs);
    await ir_proxy.waitForDeployment();
    const ir = IdentityRegistry__factory.connect(await ir_proxy.getAddress()).connect(deployer);
    await logDeployOK('IdentityRegistryProxy', ir);

    await txWait(irs.connect(deployer).bindIdentityRegistry(ir), options);

    // proxy = await hre.ethers.deployContract('ClaimTopicsRegistryProxy', [trexImplementationAuthority], deployer);
    // await proxy.waitForDeployment();
    // const claimTopicsRegistry = await hre.ethers.getContractAt('ClaimTopicsRegistry', proxy);
    // progress.logContractStep('ClaimTopicsRegistry', await claimTopicsRegistry.getAddress());

    // TrustedIssuersRegistryProxy
    // proxy = await hre.ethers.deployContract('TrustedIssuersRegistryProxy', [trexImplementationAuthority], deployer);
    // await proxy.waitForDeployment();
    // const trustedIssuersRegistry = await hre.ethers.getContractAt('TrustedIssuersRegistry', proxy);
    // progress.logContractStep('TrustedIssuersRegistry', await trustedIssuersRegistry.getAddress());

    // // IdentityRegistryStorageProxy
    // proxy = await hre.ethers.deployContract('IdentityRegistryStorageProxy', [trexImplementationAuthority], deployer);
    // await proxy.waitForDeployment();
    // const identityRegistryStorage = await hre.ethers.getContractAt('IdentityRegistryStorage', proxy);
    // progress.logContractStep('IdentityRegistryStorage', await identityRegistryStorage.getAddress());

    // // IdentityRegistryProxy
    // proxy = await hre.ethers.deployContract(
    //   'IdentityRegistryProxy',
    //   [trexImplementationAuthority, trustedIssuersRegistry, claimTopicsRegistry, identityRegistryStorage],
    //   deployer,
    // );
    // await proxy.waitForDeployment();
    // // const identityRegistry = await hre.ethers.getContractAt('IdentityRegistry', proxy);
    // progress.logContractStep('IdentityRegistry', await identityRegistry.getAddress());

    // Binding
    //await txWait(identityRegistryStorage.connect(deployer).bindIdentityRegistry(identityRegistry));

    return {
      claimTopicsRegistry: ctr,
      trustedIssuersRegistry: tir,
      identityRegistryStorage: irs,
      identityRegistry: ir,
    };
  }
}
