/* eslint-disable no-unused-expressions */

import hre from 'hardhat';
import { expect } from 'chai';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_APPROVE,
  SCOPE_TRANSFER_MANAGER,
  SCOPE_TRANSFER_MANAGER_CREATE,
  SCOPE_TRANSFER_MANAGER_SIGN_DELEGATE_APPROVE,
  SCOPE_TRANSFER_MANAGER_INITIATE,
  SCOPE_TRANSFER_MANAGER_SET_APPROVAL_CRITERIA,
  SCOPE_TREX,
  SCOPE_TREX_SETUP,
  SCOPE_TRANSFER_MANAGER_GET_TRANSFER,
  SCOPE_TRANSFER_MANAGER_APPROVE,
  SCOPE_TOKEN_BALANCE,
} from '../../../tasks/task-names';

describe('run command trex setup', () => {
  describe('then run command transfer-manager', () => {
    it('should work', async () => {
      // npx hardhat --network fhevm trex setup --mint 1000000n --unpause
      const { tokenAddress }: { tokenAddress: string } = await hre.run(
        { scope: SCOPE_TREX, task: SCOPE_TREX_SETUP },
        { mint: 1000000n, unpause: true },
      );
      expect(tokenAddress).to.be.a.properAddress;

      const balanceRes = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BALANCE },
        {
          token: tokenAddress,
          user: 'bob',
        },
      );
      const aliceBalance = balanceRes.value;
      expect(aliceBalance).to.eq(1000000n);

      // npx hardhat --network fhevm transfer-manager create --token <tokenAddress> --identity "bob" --agent "token-owner" --country 1n
      const { identityAddressAlias, transferManagerCountry, transferManagerAddress } = await hre.run(
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_CREATE },
        { token: tokenAddress, identity: 'bob', agent: 'token-owner', country: 1n },
      );
      expect(transferManagerCountry).to.eq(1);
      expect(identityAddressAlias).to.eq('bob');
      expect(transferManagerAddress).to.be.a.properAddress;

      const res3 = await hre.run(
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_SET_APPROVAL_CRITERIA },
        {
          token: tokenAddress,
          dva: identityAddressAlias,
          agent: 'token-agent',
          noRecipient: false,
          noAgent: false,
          sequential: false,
          additionalApprovers: ['charlie'],
        },
      );
      const dvaAddress = res3.transferManagerAddress;
      expect(dvaAddress).to.eq(transferManagerAddress);

      // alice.call(token.approve(dva, 100000n))
      const res4 = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_APPROVE },
        {
          token: tokenAddress,
          caller: 'alice',
          spender: transferManagerAddress,
          amount: 100000n,
        },
      );

      expect(typeof res4.fhevmHandle).eq('bigint');

      // enc100 = encrypt(100)
      // transferID = dva.calculateTransferID(nonce, alice, bob, enc100)
      // alice.call(dva.initiateTransfer(bob, enc100))
      const { transferID } = await hre.run(
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_INITIATE },
        {
          token: tokenAddress,
          dva: transferManagerAddress,
          sender: 'alice',
          recipient: 'bob',
          amount: 100n,
        },
      );

      // charlie is an approver (cf above)
      const res6 = await hre.run(
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_SIGN_DELEGATE_APPROVE },
        {
          token: tokenAddress,
          dva: transferManagerAddress,
          caller: 'eve',
          signers: ['charlie'],
          transferId: transferID,
        },
      );
      expect(res6.approver.transferID).to.eq(transferID);
      expect(res6.approver.address).to.eq(res6.signatures[0].signer);
      expect(res6.transferDetails.statusString).to.eq('PENDING');

      // token-agent is an approver (cf above)
      const res7 = await hre.run(
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_SIGN_DELEGATE_APPROVE },
        {
          token: tokenAddress,
          dva: transferManagerAddress,
          caller: 'eve',
          signers: ['token-agent'],
          transferId: transferID,
        },
      );
      expect(res7.transferDetails.statusString).to.eq('PENDING');

      // Should be pending
      const res8 = await hre.run(
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_GET_TRANSFER },
        {
          token: tokenAddress,
          dva: transferManagerAddress,
          transferId: transferID,
          json: true,
        },
      );

      const res9 = await hre.run(
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_APPROVE },
        {
          token: tokenAddress,
          dva: transferManagerAddress,
          transferId: transferID,
          json: true,
          approver: 'bob',
        },
      );
      expect(res9.transferDetails.statusString).to.eq('COMPLETED');

      const newBalanceRes = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BALANCE },
        {
          token: tokenAddress,
          user: 'bob',
        },
      );
      expect(newBalanceRes.value).to.eq(1000000n + 100n);
    });
  });
});
