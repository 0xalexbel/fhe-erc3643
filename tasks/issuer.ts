import { scope } from 'hardhat/config';
import { ethers as EthersT } from 'ethers';
import { string } from 'hardhat/internal/core/params/argumentTypes';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadChainConfig } from './utils';
import {
  SCOPE_CLAIM_ISSUER,
  SCOPE_CLAIM_ISSUER_LIST,
  SCOPE_CLAIM_ISSUER_NEW,
  SCOPE_CLAIM_ISSUER_SHOW,
} from './task-names';
import { defaultTxOptions, logInfo, logJSONResult, logMsg, logOK, LogOptions } from '../sdk/log';
import { importCliModule, importTypes } from './internal/imp';

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

issuerScope
  .task(SCOPE_CLAIM_ISSUER_SHOW)
  .setDescription('Tries to resolve a claim issuer address given a wallet address')
  .addParam('wallet', 'The wallet of an identity manager', undefined, string)
  .addFlag('json', 'Output in json format')
  .addOptionalParam('token', 'A token where the claim issuer should be registered', undefined, string)
  .setAction(
    async (
      { wallet, token, json }: { wallet: string; token: string; json: boolean },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/issuer');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(1);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdClaimIssuerShow(wallet, token, chainConfig, options);

      if (json) {
        logJSONResult(res);
      } else {
        logOK(`address          : ${res.address}`, lo);
        logOK(`version          : ${res.version}`, lo);
      }

      return res;
    },
  );
