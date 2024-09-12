import { scope } from 'hardhat/config';
import {
  SCOPE_TRANSFER_MANAGER,
  SCOPE_TRANSFER_MANAGER_CALCULATE_TRANSFER_ID,
  SCOPE_TRANSFER_MANAGER_CREATE,
  SCOPE_TRANSFER_MANAGER_SIGN_DELEGATE_APPROVE,
  SCOPE_TRANSFER_MANAGER_GET_TRANSFER,
  SCOPE_TRANSFER_MANAGER_INITIATE,
  SCOPE_TRANSFER_MANAGER_SET_APPROVAL_CRITERIA,
  SCOPE_TRANSFER_MANAGER_APPROVE,
} from './task-names';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { bigint, string } from 'hardhat/internal/core/params/argumentTypes';
import { importTypes } from './internal/imp';
import { loadChainConfig } from './utils';
import { defaultTxOptions, logJSONResult, logOK, LogOptions } from '../sdk/log';

const transferManagerScope = scope(SCOPE_TRANSFER_MANAGER, 'Transfer manager related commands (DVA)');

//npx hardhat --network fhevm transfer-manager new --token MEGALODON
transferManagerScope
  .task(SCOPE_TRANSFER_MANAGER_CREATE)
  .setDescription('Creates new transfer manager attached to the specified verified identity')
  .addParam('identity', 'A verified identity', undefined, string)
  .addParam('agent', 'A token identity registry agent', undefined, string)
  .addOptionalParam('country', 'The transfer manager country', '0', bigint)
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .addFlag('json', 'Output result in json format')
  .setAction(
    async (
      {
        token,
        identity,
        agent,
        country,
        json,
      }: { token: string | undefined; identity: string; agent: string; country: bigint; json: boolean },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTransferManagerCreate(token, identity, agent, country, chainConfig, options);

      if (json) {
        logJSONResult(res);
      } else {
        logOK(`transfer manager         : ${res.transferManagerAddress}`, lo);
        logOK(`transfer manager country : ${res.transferManagerCountry}`, lo);
        logOK(`identity alias           : ${res.identityAddressAlias}`, lo);
        logOK(`identity                 : ${res.identityAddress}`, lo);
        logOK(`token                    : ${res.tokenAddress}`, lo);
        logOK(`token name               : ${res.tokenName}`, lo);
      }

      return res;
    },
  );

transferManagerScope
  .task(SCOPE_TRANSFER_MANAGER_SET_APPROVAL_CRITERIA)
  .setDescription('Modifies the approval criteria of a token')
  .addParam('dva', 'The DVA identity user', undefined, string)
  .addParam('agent', 'A token agent', undefined, string)
  .addFlag('noRecipient', 'Determines whether the recipient is included in the approver list')
  .addFlag('noAgent', 'Determines whether the agent is included in the approver list')
  .addFlag('sequential', 'Determines whether approvals must be sequential')
  .addFlag('json', 'Output result in json format')
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .addOptionalVariadicPositionalParam(
    'additionalApprovers',
    'the addresses of additional approvers to be added to the approver list',
    undefined,
    string,
  )
  .setAction(
    async (
      {
        dva,
        token,
        agent,
        noRecipient,
        noAgent,
        sequential,
        json,
        additionalApprovers,
      }: {
        dva: string;
        token: string | undefined;
        agent: string;
        noRecipient: boolean;
        noAgent: boolean;
        sequential: boolean;
        json: boolean;
        additionalApprovers: Array<string> | undefined;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTransferManagerSetApprovalCriteria(
        token,
        agent,
        dva,
        !noRecipient,
        !noAgent,
        sequential,
        additionalApprovers ?? [],
        chainConfig,
        options,
      );

      if (json) {
        logJSONResult(res);
      } else {
        logOK(`include agent approver      : ${res.includeAgentApprover}`, lo);
        logOK(`include recipient approver  : ${res.includeRecipientApprover}`, lo);
        logOK(`sequential approval         : ${res.sequentialApproval}`, lo);
        logOK(`transfer Id alias           : ${res.transferManagerIdAlias}`, lo);
        logOK(`transfer manager            : ${res.transferManagerAddress}`, lo);
        logOK(`token                       : ${res.tokenAddress}`, lo);
        logOK(`token name                  : ${res.tokenName}`, lo);
      }

      return res;
    },
  );

transferManagerScope
  .task(SCOPE_TRANSFER_MANAGER_CALCULATE_TRANSFER_ID)
  .setDescription('Modifies the approval criteria of a token')
  .addParam('dva', 'The DVA identity user', undefined, string)
  .addParam('nonce', 'The transferID nonce', undefined, bigint)
  .addParam('sender', 'The sender address or alias', undefined, string)
  .addParam('recipient', 'The recipient address or alias', undefined, string)
  .addParam('eamount', 'The fhevm handle', undefined, bigint)
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .setAction(
    async (
      {
        dva,
        token,
        nonce,
        sender,
        recipient,
        eamount,
      }: {
        dva: string;
        token: string | undefined;
        nonce: bigint;
        sender: string;
        recipient: string;
        eamount: bigint;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTransferManagerCalculateTransferID(
        token,
        dva,
        nonce,
        sender,
        recipient,
        eamount,
        chainConfig,
        options,
      );

      logOK(`transferID        : ${res.transferID}`, lo);
      logOK(`nonce             : ${res.nonce}`, lo);
      logOK(`sender alias      : ${res.senderAddressAlias}`, lo);
      logOK(`sender            : ${res.senderAddress}`, lo);
      logOK(`recipient alias   : ${res.recipientAddressAlias}`, lo);
      logOK(`recipient         : ${res.recipientAddress}`, lo);
      logOK(`eamount           : ${res.eamount}`, lo);
      logOK(`transfer Id alias : ${res.transferManagerIdAlias}`, lo);
      logOK(`transfer manager  : ${res.transferManagerAddress}`, lo);
      logOK(`token             : ${await res.token.getAddress()}`, lo);
      logOK(`token name        : ${await res.token.name()}`, lo);

      return res;
    },
  );

transferManagerScope
  .task(SCOPE_TRANSFER_MANAGER_INITIATE)
  .setDescription('Initiates a transfer')
  .addParam('dva', 'The DVA identity user', undefined, string)
  .addParam('sender', 'The sender address or alias', undefined, string)
  .addParam('recipient', 'The recipient address or alias', undefined, string)
  .addParam('amount', 'The amount in clear form', undefined, bigint)
  .addFlag('json', 'Output result in json format')
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .setAction(
    async (
      {
        dva,
        token,
        sender,
        recipient,
        amount,
        json,
      }: {
        dva: string;
        token: string | undefined;
        sender: string;
        recipient: string;
        amount: bigint;
        json: boolean;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTransferManagerInitiate(token, dva, sender, recipient, amount, chainConfig, options);

      if (json) {
        logJSONResult(res);
      } else {
        logOK(`sender alias              : ${res.senderAddressAlias}`, lo);
        logOK(`sender                    : ${res.senderAddress}`, lo);
        logOK(`recipient alias           : ${res.recipientAddressAlias}`, lo);
        logOK(`recipient                 : ${res.recipientAddress}`, lo);
        logOK(`amount                    : ${res.amount}`, lo);
        logOK(`eamount                   : ${res.eamount}`, lo);
        logOK(`transferID                : ${res.transferID}`, lo);
        logOK(`transfer manager Id alias : ${res.transferManagerIdAlias}`, lo);
        logOK(`transfer manager          : ${res.transferManagerAddress}`, lo);
        logOK(`token                     : ${res.tokenAddress}`, lo);
        logOK(`token name                : ${res.tokenName}`, lo);
      }

      return res;
    },
  );

transferManagerScope
  .task(SCOPE_TRANSFER_MANAGER_SIGN_DELEGATE_APPROVE)
  .setDescription('Sign the approval by the signers and send the approval')
  .addParam('dva', 'The DVA identity user', undefined, string)
  .addParam('transferId', 'The transferID', undefined, string)
  .addParam('caller', 'The caller wallet', undefined, string)
  .addFlag('json', 'Output result in json format')
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .addVariadicPositionalParam('signers', 'The signers', undefined, string)
  .setAction(
    async (
      {
        dva,
        token,
        transferId,
        signers,
        caller,
        json,
      }: {
        dva: string;
        token: string | undefined;
        transferId: string;
        signers: string[];
        caller: string;
        json: boolean;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTransferManagerDelegateApprove(
        token,
        dva,
        transferId,
        signers,
        caller,
        chainConfig,
        options,
      );

      if (json) {
        logJSONResult(res);
      } else {
        logOK(`transferID                : ${res.transferID}`, lo);
        logOK(`token                     : ${res.tokenAddress}`, lo);
        logOK(`token name                : ${res.tokenName}`, lo);
      }

      return res;
    },
  );

transferManagerScope
  .task(SCOPE_TRANSFER_MANAGER_APPROVE)
  .setDescription('Approves a transfer')
  .addParam('dva', 'The DVA identity user', undefined, string)
  .addParam('transferId', 'The transferID', undefined, string)
  .addParam('approver', 'The approver wallet', undefined, string)
  .addFlag('json', 'Output result in json format')
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .setAction(
    async (
      {
        dva,
        token,
        transferId,
        approver,
        json,
      }: {
        dva: string;
        token: string | undefined;
        transferId: string;
        approver: string;
        caller: string;
        json: boolean;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTransferManagerApprove(token, dva, transferId, approver, chainConfig, options);

      if (json) {
        logJSONResult(res);
      } else {
        logOK(`transferID                : ${res.transferID}`, lo);
        logOK(`token                     : ${res.tokenAddress}`, lo);
        logOK(`token name                : ${res.tokenName}`, lo);
      }

      return res;
    },
  );

transferManagerScope
  .task(SCOPE_TRANSFER_MANAGER_GET_TRANSFER)
  .setDescription('Gets details of a specified transfer')
  .addParam('dva', 'The DVA identity user', undefined, string)
  .addParam('transferId', 'The transferID', undefined, string)
  .addFlag('json', 'Output result in json format')
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .setAction(
    async (
      {
        dva,
        token,
        transferId,
        json,
      }: {
        dva: string;
        token: string | undefined;
        transferId: string;
        json: boolean;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.noProgress };

      const res = await cmds.cmdTransferManagerGetTransfer(token, dva, transferId, chainConfig, options);

      if (json) {
        logJSONResult(res);
      } else {
        logOK(`transferID                : ${res.transferID}`, lo);
        logOK(`token                     : ${res.tokenAddress}`, lo);
        logOK(`token name                : ${res.tokenName}`, lo);
        logOK(`transfer status           : ${res.statusString}`, lo);
        logOK(`transfer eamount          : ${res.eamount}`, lo);
        logOK(`transfer actual eamount   : ${res.eactualAmount}`, lo);
      }

      return res;
    },
  );
