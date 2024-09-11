/* eslint-disable no-unused-expressions */

import hre from 'hardhat';
import { expect } from 'chai';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_APPROVE,
  SCOPE_TRANSFER_MANAGER,
  SCOPE_TRANSFER_MANAGER_CREATE,
  SCOPE_TRANSFER_MANAGER_DELEGATE_APPROVE,
  SCOPE_TRANSFER_MANAGER_INITIATE,
  SCOPE_TRANSFER_MANAGER_SET_APPROVAL,
  SCOPE_TREX,
  SCOPE_TREX_SETUP,
} from '../../../tasks/task-names';

describe('run command trex setup', () => {
  describe('then run command transfer-manager', () => {
    it('should work', async () => {
      const { tokenAddress }: { tokenAddress: string } = await hre.run(
        { scope: SCOPE_TREX, task: SCOPE_TREX_SETUP },
        { mint: 1000000n, unpause: true },
      );
      expect(tokenAddress).to.be.a.properAddress;

      const { identityAlias, transferManagerCountry, transferManagerAddress } = await hre.run(
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_CREATE },
        { token: tokenAddress, identity: 'bob', agent: 'token-owner', country: 1n },
      );
      expect(transferManagerCountry).to.eq(1);
      expect(identityAlias).to.eq('bob');
      expect(transferManagerAddress).to.be.a.properAddress;

      const res3 = await hre.run(
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_SET_APPROVAL },
        {
          token: tokenAddress,
          dva: identityAlias,
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
          spender: dvaAddress,
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
          dva: dvaAddress,
          sender: 'alice',
          recipient: 'bob',
          amount: 100n,
        },
      );

      // charlie is an approver (cf above)
      const res6 = await hre.run(
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_DELEGATE_APPROVE },
        {
          token: tokenAddress,
          dva: dvaAddress,
          caller: 'eve',
          signers: ['charlie'],
          transferID: transferID,
        },
      );
      expect(res6.approver.transferID).to.eq(transferID);
      expect(res6.approver.address).to.eq(res6.signatures[0].signer);
    });
  });
});
