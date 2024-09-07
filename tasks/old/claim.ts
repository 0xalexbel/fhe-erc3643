import { scope } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import { SCOPE_CLAIM, SCOPE_CLAIM_ADD, SCOPE_CLAIM_GET, SCOPE_CLAIM_REMOVE } from './task-names';
import { bigint, int, string } from 'hardhat/internal/core/params/argumentTypes';
import {
  getHistoryPath,
  loadChainConfig,
  loadWalletArgs,
  loadWalletFromIndexOrAliasOrAddressOrPrivateKey,
  logError,
  logOK,
} from './utils';
import { ClaimIssuerAPI } from '../sdk/ClaimIssuerAPI';
import { IdentityAPI } from '../sdk/IdentityAPI';
import { Progress } from '../sdk/utils';
import { ethers as EthersT } from 'ethers';

const claimScope = scope(SCOPE_CLAIM, 'Manage claims');

////////////////////////////////////////////////////////////////////////////////

//npx hardhat --network fhevm claim add --issuer 0x8464135c8F25Da09e49BC8782676a84730C318bC --wallet foo-university --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef --data "Alice is graduated from Foo University" --topic 10101010000042
claimScope
  .task(SCOPE_CLAIM_ADD)
  .addParam('issuer', 'Claim issuer identity address', undefined, string)
  .addParam('identity', 'Identity address', undefined, string)
  .addParam('data', 'Claim data', undefined, string)
  .addParam('topic', 'Topic code', undefined, bigint)
  .addParam('wallet', 'Claim issuer wallet', undefined, string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    // issuerWallet is also the issuer's management key
    const issuerWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    if (!hre.ethers.isAddress(taskArgs.issuer)) {
      throw new Error(`Invalid claim issuer address: ${taskArgs.issuer}`);
    }

    if (!hre.ethers.isAddress(taskArgs.identity)) {
      throw new Error(`Invalid identity address: ${taskArgs.identity}`);
    }

    const issuer = await ClaimIssuerAPI.fromManager(taskArgs.issuer, issuerWallet);
    const identity = IdentityAPI.from(taskArgs.identity, chainConfig.provider);

    if (!(await IdentityAPI.isManagementKey(identity, issuerWallet))) {
      logError(`Issuer wallet ${issuerWallet.address} is not a management key of identity ${taskArgs.identity}`);
      return;
    }

    const signedClaim = await ClaimIssuerAPI.createSignedClaim(
      issuer,
      issuerWallet,
      identity,
      EthersT.toUtf8Bytes(taskArgs.data),
      taskArgs.topic,
    );

    const claimId = await IdentityAPI.addClaim(
      identity,
      signedClaim.topic,
      signedClaim.scheme,
      signedClaim.issuer,
      signedClaim.signature,
      signedClaim.data,
      '',
      issuerWallet,
      {
        progress: new Progress(1),
        confirms: 1,
        chainConfig,
      },
    );

    console.log({ claimId });

    return claimId;
  });

////////////////////////////////////////////////////////////////////////////////

//npx hardhat --network fhevm claim get --identity 0x406c2b3599da0b3a35044dDb99a4cfe0FA5F6B62 --issuer 0x5C7c905B505f0Cf40Ab6600d05e677F717916F6B --topic 1234
claimScope
  .task(SCOPE_CLAIM_GET)
  .addParam('identity', 'Identity address', undefined, string)
  .addParam('issuer', 'Claim issuer identity address', undefined, string)
  .addParam('topic', 'Topic code', undefined, bigint)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    if (!hre.ethers.isAddress(taskArgs.issuer)) {
      throw new Error(`Invalid claim issuer address: ${taskArgs.issuer}`);
    }

    if (!hre.ethers.isAddress(taskArgs.identity)) {
      throw new Error(`Invalid identity address: ${taskArgs.identity}`);
    }

    const issuer = ClaimIssuerAPI.from(taskArgs.issuer, chainConfig.provider);
    const identity = IdentityAPI.from(taskArgs.identity, chainConfig.provider);

    const signedClaim = await IdentityAPI.getClaim(identity, taskArgs.topic, issuer, chainConfig.provider);

    const output = {
      ...signedClaim,
      issuer: await signedClaim.issuer.getAddress(),
    };

    console.log(output);
  });

////////////////////////////////////////////////////////////////////////////////

//npx hardhat --network fhevm claim add --issuer 0x5C7c905B505f0Cf40Ab6600d05e677F717916F6B --wallet-index 1 --identity 0x406c2b3599da0b3a35044dDb99a4cfe0FA5F6B62 --data "Hello\!" --topic 1234
//npx hardhat --network fhevm claim get --identity 0x406c2b3599da0b3a35044dDb99a4cfe0FA5F6B62 --issuer 0x5C7c905B505f0Cf40Ab6600d05e677F717916F6B --topic 1234
//npx hardhat --network fhevm claim remove --identity 0x406c2b3599da0b3a35044dDb99a4cfe0FA5F6B62 --wallet-index 1 --issuer 0x5C7c905B505f0Cf40Ab6600d05e677F717916F6B --topic 1234
claimScope
  .task(SCOPE_CLAIM_REMOVE)
  .addParam('identity', 'Identity address', undefined, string)
  .addParam('issuer', 'Claim issuer identity address', undefined, string)
  .addParam('topic', 'Topic code', undefined, bigint)
  .addOptionalParam('privateKey', 'Identity manager private key', undefined, string)
  .addOptionalParam('walletIndex', 'Identity manager wallet index', 0, int)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    const managerWallet = loadWalletArgs(chainConfig, taskArgs.walletIndex, taskArgs.privateKey);

    if (!hre.ethers.isAddress(taskArgs.issuer)) {
      throw new Error(`Invalid claim issuer address: ${taskArgs.issuer}`);
    }

    if (!hre.ethers.isAddress(taskArgs.identity)) {
      throw new Error(`Invalid identity address: ${taskArgs.identity}`);
    }

    const issuer = ClaimIssuerAPI.from(taskArgs.issuer, chainConfig.provider);
    const identity = IdentityAPI.from(taskArgs.identity, chainConfig.provider);

    const claimId = await IdentityAPI.removeClaim(identity, taskArgs.topic, issuer, managerWallet, {
      progress: new Progress(1),
      confirms: 1,
      chainConfig,
    });

    logOK(`Claim id ${claimId} has been successfully removed from identity ${taskArgs.identity}`);
  });
