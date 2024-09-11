import { scope } from 'hardhat/config';
import {
  SCOPE_TRANSFER_MANAGER,
  SCOPE_TRANSFER_MANAGER_CALCULATE_TRANSFER_ID,
  SCOPE_TRANSFER_MANAGER_CREATE,
  SCOPE_TRANSFER_MANAGER_DELEGATE_APPROVE,
  SCOPE_TRANSFER_MANAGER_INITIATE,
  SCOPE_TRANSFER_MANAGER_SET_APPROVAL,
} from './task-names';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { bigint, boolean, string } from 'hardhat/internal/core/params/argumentTypes';
import { importTypes } from './internal/imp';
import { loadChainConfig } from './utils';
import { defaultTxOptions, logOK, LogOptions } from '../sdk/log';

const transferManagerScope = scope(SCOPE_TRANSFER_MANAGER, 'Transfer manager related commands (DVA)');

//npx hardhat --network fhevm transfer-manager new --token MEGALODON
transferManagerScope
  .task(SCOPE_TRANSFER_MANAGER_CREATE)
  .setDescription('Creates new transfer manager attached to the specified verified identity')
  .addParam('identity', 'A verified identity', undefined, string)
  .addParam('agent', 'A token identity registry agent', undefined, string)
  .addOptionalParam('country', 'The transfer manager country', 0n, bigint)
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .setAction(
    async (
      {
        token,
        identity,
        agent,
        country,
      }: { token: string | undefined; identity: string; agent: string; country: bigint },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.quiet };

      const res = await cmds.cmdTransferManagerCreate(token, identity, agent, country, chainConfig, options);

      logOK(``, lo);
      logOK(`transfer manager         : ${res.transferManagerAddress}`, lo);
      logOK(`transfer manager country : ${res.transferManagerCountry}`, lo);
      logOK(`identity alias           : ${res.identityAlias}`, lo);
      logOK(`identity                 : ${res.identity}`, lo);
      logOK(`token                    : ${await res.token.getAddress()}`, lo);
      logOK(`token name               : ${await res.token.name()}`, lo);

      return res;
    },
  );
/*


/**
 *  @dev modify the approval criteria of a token
 *  @param tokenAddress is the token address.
 *  @param includeRecipientApprover determines whether the recipient is included in the approver list
 *  @param includeAgentApprover determines whether the agent is included in the approver list
 *  @param sequentialApproval determines whether approvals must be sequential
 *  @param additionalApprovers are the addresses of additional approvers to be added to the approver list
 *  Only token owner can call this function
 *  DVATransferManager must be an agent of the given token
 *  emits an `ApprovalCriteriaSet` event
 */
//   function setApprovalCriteria(
//     address tokenAddress,
//     bool includeRecipientApprover,
//     bool includeAgentApprover,
//     bool sequentialApproval,
//     address[] memory additionalApprovers
// ) external;

transferManagerScope
  .task(SCOPE_TRANSFER_MANAGER_SET_APPROVAL)
  .setDescription('Modifies the approval criteria of a token')
  .addParam('dva', 'The DVA identity user', undefined, string)
  .addParam('agent', 'A token agent', undefined, string)
  .addFlag('noRecipient', 'Determines whether the recipient is included in the approver list')
  .addFlag('noAgent', 'Determines whether the agent is included in the approver list')
  .addFlag('sequential', 'Determines whether approvals must be sequential')
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
        additionalApprovers,
      }: {
        dva: string;
        token: string | undefined;
        agent: string;
        noRecipient: boolean;
        noAgent: boolean;
        sequential: boolean;
        additionalApprovers: Array<string> | undefined;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.quiet };

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

      logOK(``, lo);
      logOK(`include agent approver      : ${res.includeAgentApprover}`, lo);
      logOK(`include recipient approver  : ${res.includeRecipientApprover}`, lo);
      logOK(`sequential approval         : ${res.sequentialApproval}`, lo);
      logOK(`transfer Id alias           : ${res.transferManagerIdAlias}`, lo);
      logOK(`transfer manager            : ${res.transferManagerAddress}`, lo);
      logOK(`token                       : ${await res.token.getAddress()}`, lo);
      logOK(`token name                  : ${await res.token.name()}`, lo);

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
      const lo: LogOptions = { quiet: options.quiet };

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

      logOK(``, lo);
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
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .setAction(
    async (
      {
        dva,
        token,
        sender,
        recipient,
        amount,
      }: {
        dva: string;
        token: string | undefined;
        sender: string;
        recipient: string;
        amount: bigint;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.quiet };

      const res = await cmds.cmdTransferManagerInitiate(token, dva, sender, recipient, amount, chainConfig, options);

      logOK(``, lo);
      logOK(`sender alias              : ${res.senderAddressAlias}`, lo);
      logOK(`sender                    : ${res.senderAddress}`, lo);
      logOK(`recipient alias           : ${res.recipientAddressAlias}`, lo);
      logOK(`recipient                 : ${res.recipientAddress}`, lo);
      logOK(`amount                    : ${res.amount}`, lo);
      logOK(`eamount                   : ${res.eamount}`, lo);
      logOK(`transferID                : ${res.transferID}`, lo);
      logOK(`transfer manager Id alias : ${res.transferManagerIdAlias}`, lo);
      logOK(`transfer manager          : ${res.transferManagerAddress}`, lo);
      logOK(`token                     : ${await res.token.getAddress()}`, lo);
      logOK(`token name                : ${await res.token.name()}`, lo);

      return res;
    },
  );

transferManagerScope
  .task(SCOPE_TRANSFER_MANAGER_DELEGATE_APPROVE)
  .setDescription('Initiates a transfer')
  .addParam('dva', 'The DVA identity user', undefined, string)
  .addParam('transferID', 'The transferID', undefined, string)
  .addParam('caller', 'The caller wallet', undefined, string)
  .addOptionalParam('token', 'Token name/symbol/salt/address or last deployed', undefined, string)
  .addVariadicPositionalParam('signers', 'The signers', undefined, string)
  .setAction(
    async (
      {
        dva,
        token,
        transferID,
        signers,
        caller,
      }: {
        dva: string;
        token: string | undefined;
        transferID: string;
        signers: string[];
        caller: string;
      },
      hre: HardhatRuntimeEnvironment,
    ) => {
      await importTypes(hre);
      const cmds = await import('../sdk/cli/transfer-manager');
      const chainConfig = await loadChainConfig(hre);

      const options = defaultTxOptions(2);
      const lo: LogOptions = { quiet: options.quiet };

      const res = await cmds.cmdTransferManagerDelegateApprove(
        token,
        dva,
        transferID,
        signers,
        caller,
        chainConfig,
        options,
      );

      logOK(``, lo);
      logOK(`transferID                : ${res.transferID}`, lo);
      logOK(`token                     : ${await res.token.getAddress()}`, lo);
      logOK(`token name                : ${await res.token.name()}`, lo);

      return res;
    },
  );
