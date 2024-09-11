import { scope } from 'hardhat/config';
import { ethers as EthersT } from 'ethers';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadChainConfig } from './utils';
import { SCOPE_CLAIM_ISSUER, SCOPE_CLAIM_ISSUER_LIST, SCOPE_CLAIM_ISSUER_NEW } from './task-names';
import { logInfo, logMsg } from '../sdk/log';
import { importCliModule } from './internal/imp';

const issuerScope = scope(SCOPE_CLAIM_ISSUER, 'Manage claim issuers');

//npx hardhat --network fhevm issuer list
issuerScope.task(SCOPE_CLAIM_ISSUER_LIST).setAction(async ({}, hre: HardhatRuntimeEnvironment) => {
  const chainConfig = await loadChainConfig(hre);

  const p = chainConfig.historyPath;
  if (!p) {
    logMsg(`No claim issuers on network '${chainConfig.networkName}'`);
    return;
  }

  const claimIssuers = chainConfig.toJSON().claimIssuers;

  logInfo(`History file: ${p}`);
  if (claimIssuers.length > 0) {
    logMsg('List of all claim issuers:');
    claimIssuers.forEach(v => logMsg(v, { indent: '  ' }));
  } else {
    logMsg(`No claim issuers saved on network '${chainConfig.networkName}' history file`);
  }

  return claimIssuers;
});

//npx hardhat --network fhevm issuer new --wallet foo-university
issuerScope
  .task(SCOPE_CLAIM_ISSUER_NEW)
  .setDescription('Creates new claim issuer with specified owner')
  .addOptionalParam('wallet', 'Claim issuer owner wallet (index/alias/address/private key)', '1', string)
  .setAction(async ({ wallet }: { wallet: string }, hre: HardhatRuntimeEnvironment) => {
    const cmds = await importCliModule('issuer', hre);
    const chainConfig = await loadChainConfig(hre);

    const claimIssuer: EthersT.AddressLike = await cmds.cmdNewClaimIssuer(wallet, chainConfig);

    //await logStepDeployOK('Claim issuer', claimIssuer);

    return claimIssuer;
  });
