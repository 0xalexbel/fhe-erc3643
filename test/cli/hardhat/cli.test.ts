/* eslint-disable  @typescript-eslint/no-unused-expressions */

import hre from 'hardhat';
import { expect } from 'chai';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_APPROVE,
  SCOPE_TOKEN_BALANCE,
  SCOPE_TOKEN_EXCHANGE_MONTHLY_ADD_ID,
  SCOPE_TOKEN_IS_PAUSED,
  SCOPE_TOKEN_MINT,
  SCOPE_TOKEN_TIME_EXCHANGE_ADD_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_GET_LIMITS,
  SCOPE_TOKEN_TIME_EXCHANGE_IS_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_REMOVE_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_SET_LIMITS,
  SCOPE_TOKEN_TRANSFER,
  SCOPE_TOKEN_UNPAUSE,
  SCOPE_TRANSFER_MANAGER,
  SCOPE_TRANSFER_MANAGER_CREATE,
  SCOPE_TRANSFER_MANAGER_SIGN_DELEGATE_APPROVE,
  SCOPE_TRANSFER_MANAGER_INITIATE,
  SCOPE_TRANSFER_MANAGER_SET_APPROVAL_CRITERIA,
  SCOPE_TREX,
  SCOPE_TREX_SETUP,
  SCOPE_TOKEN_EXCHANGE_MONTHLY_SET_EXCHANGE_LIMIT,
  SCOPE_TOKEN_EXCHANGE_MONTHLY_GET_MONTHLY_COUNTER,
} from '../../../tasks/task-names';

describe('run command trex setup with initial mint', () => {
  it('should work', async () => {
    const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP }, { mint: 10n });
    expect(res.tokenAddress).to.be.properAddress;
  });
});

describe('run command trex setup', () => {
  it('should work', async () => {
    const res: { tokenAddress: string } = await hre.run(
      { scope: SCOPE_TREX, task: SCOPE_TREX_SETUP },
      { mint: 100000n },
    );
    expect(res.tokenAddress).to.be.properAddress;
  });

  describe('then run command token timeexchange:is-id', () => {
    it('should work', async () => {
      const res: { tokenAddress: string } = await hre.run(
        { scope: SCOPE_TREX, task: SCOPE_TREX_SETUP },
        { mint: 100000n },
      );
      expect(res.tokenAddress).to.be.properAddress;
      const isAliceId: boolean = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_IS_ID },
        { token: res.tokenAddress, user: 'alice' },
      );
      expect(isAliceId).to.be.false;
    });
  });

  describe('then run command token timeexchange:add-id', () => {
    it('should work', async () => {
      const res: { tokenAddress: string } = await hre.run(
        { scope: SCOPE_TREX, task: SCOPE_TREX_SETUP },
        { mint: 100000n },
      );
      expect(res.tokenAddress).to.be.properAddress;
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_ADD_ID },
        { token: res.tokenAddress, user: 'alice', owner: 'token-owner' },
      );
      const isAliceId: boolean = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_IS_ID },
        { token: res.tokenAddress, user: 'alice' },
      );
      expect(isAliceId).to.be.true;
    });
  });

  describe('then run command token timeexchange:remove-id', () => {
    it('should work', async () => {
      const res: { tokenAddress: string } = await hre.run(
        { scope: SCOPE_TREX, task: SCOPE_TREX_SETUP },
        { mint: 100000n },
      );
      expect(res.tokenAddress).to.be.properAddress;
      // is alice exchange ID ?
      let isAliceId: boolean = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_IS_ID },
        { token: res.tokenAddress, user: 'alice' },
      );
      expect(isAliceId).to.be.false;
      // tag alice as exchange ID
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_ADD_ID },
        { token: res.tokenAddress, user: 'alice', owner: 'token-owner' },
      );
      // check
      isAliceId = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_IS_ID },
        { token: res.tokenAddress, user: 'alice' },
      );
      expect(isAliceId).to.be.true;
      // untag alice as exchange ID
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_REMOVE_ID },
        { token: res.tokenAddress, user: 'alice', owner: 'token-owner' },
      );
      // check
      isAliceId = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_IS_ID },
        { token: res.tokenAddress, user: 'alice' },
      );
      expect(isAliceId).to.be.false;
    });
  });

  describe('then run command token timeexchange:get-limits', () => {
    it('should work', async () => {
      const res: { tokenAddress: string } = await hre.run(
        { scope: SCOPE_TREX, task: SCOPE_TREX_SETUP },
        { mint: 100000n },
      );
      expect(res.tokenAddress).to.be.properAddress;
      let limits = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_GET_LIMITS },
        { token: res.tokenAddress, user: 'alice' },
      );
      expect(limits).to.be.empty;
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_SET_LIMITS },
        { token: res.tokenAddress, user: 'alice', agent: 'token-owner', time: 123, value: 456n },
      );
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_SET_LIMITS },
        { token: res.tokenAddress, user: 'alice', agent: 'token-owner', time: 789, value: 101112n },
      );
      limits = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_GET_LIMITS },
        { token: res.tokenAddress, user: 'alice' },
      );
      expect(limits).to.deep.eq([
        { timeLimit: 123, valueLimit: 456n },
        { timeLimit: 789, valueLimit: 101112n },
      ]);
    });
  });

  describe('then run command token transfer', () => {
    it('should work', async () => {
      const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP }, { mint: 0n });
      expect(res.tokenAddress).to.be.properAddress;
      // mint alice
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_MINT },
        { token: res.tokenAddress, agent: 'token-agent', user: 'alice', amount: 100n },
      );
      // check alice balance
      const b = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BALANCE },
        { token: res.tokenAddress, user: 'alice' },
      );
      expect(b.value).to.eq(100);
      // unpause token
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_UNPAUSE },
        { token: res.tokenAddress, agent: 'token-agent' },
      );
      // check unpaused
      const isPaused = await hre.run({ scope: SCOPE_TOKEN, task: SCOPE_TOKEN_IS_PAUSED }, { token: res.tokenAddress });
      expect(isPaused).to.be.false;
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TRANSFER },
        { token: res.tokenAddress, wallet: 'alice', to: 'bob', amount: 1n },
      );
      // check alice balance
      const aliceBalance = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BALANCE },
        { token: res.tokenAddress, user: 'alice' },
      );
      expect(aliceBalance.value).to.eq(b.value - 1n);
      // check bob balance
      const bobBalance = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BALANCE },
        { token: res.tokenAddress, user: 'bob' },
      );
      expect(bobBalance.value).to.eq(1n);
    });
  });

  describe('then run command token timeexchange:get-limits', () => {
    it('should work', async () => {
      const res: { tokenAddress: string } = await hre.run(
        { scope: SCOPE_TREX, task: SCOPE_TREX_SETUP },
        { mint: 1000n, unpause: true },
      );
      expect(res.tokenAddress).to.be.properAddress;
      //npx hardhat --network fhevm token exchangemonthly:add-id --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --owner token-owner --user bob
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_EXCHANGE_MONTHLY_ADD_ID },
        { token: res.tokenAddress, user: 'bob', owner: 'token-owner' },
      );
      //npx hardhat --network fhevm token exchangemonthly:set-exchange-limit --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --owner token-owner --exchange-id bob --limit 100
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_EXCHANGE_MONTHLY_SET_EXCHANGE_LIMIT },
        { token: res.tokenAddress, exchangeId: 'bob', owner: 'token-owner', limit: 100n },
      );
      //npx hardhat --network fhevm token transfer --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet alice --to bob --amount 10
      await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TRANSFER },
        { token: res.tokenAddress, to: 'bob', wallet: 'alice', amount: 10n },
      );
      //npx hardhat --network fhevm token exchangemonthly:get-monthly-counter --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --exchange-id bob --investor-id alice --decrypt
      const result = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_EXCHANGE_MONTHLY_GET_MONTHLY_COUNTER },
        { token: res.tokenAddress, exchangeId: 'bob', investorId: 'alice', decrypt: true },
      );
      expect(result.value).to.eq(10);
    });
  });

  describe('then run command transfer-manager create', () => {
    it('should work', async () => {
      const { tokenAddress }: { tokenAddress: string } = await hre.run(
        { scope: SCOPE_TREX, task: SCOPE_TREX_SETUP },
        { mint: 1000000n, unpause: true },
      );
      expect(tokenAddress).to.be.a.properAddress;

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
        { scope: SCOPE_TRANSFER_MANAGER, task: SCOPE_TRANSFER_MANAGER_SIGN_DELEGATE_APPROVE },
        {
          token: tokenAddress,
          dva: dvaAddress,
          caller: 'eve',
          signers: ['charlie'],
          transferId: transferID,
        },
      );
      expect(res6.approver.transferID).to.eq(transferID);
      expect(res6.approver.address).to.eq(res6.signatures[0].signer);
    });
  });
});
