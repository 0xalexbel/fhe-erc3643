/* eslint-disable no-unused-expressions */

import hre from 'hardhat';
import { expect } from 'chai';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_BALANCE,
  SCOPE_TOKEN_IS_PAUSED,
  SCOPE_TOKEN_MINT,
  SCOPE_TOKEN_TIME_EXCHANGE_ADD_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_GET_LIMITS,
  SCOPE_TOKEN_TIME_EXCHANGE_IS_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_REMOVE_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_SET_LIMITS,
  SCOPE_TOKEN_TRANSFER,
  SCOPE_TOKEN_UNPAUSE,
  SCOPE_TREX,
  SCOPE_TREX_SETUP,
} from '../tasks/task-names';

describe('run command trex setup with initial mint', () => {
  it('should work', async () => {
    const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP }, { mint: 10n });
    expect(res.tokenAddress).to.be.properAddress;
  });
  it('should work', async () => {
    const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP }, { mint: 10n });
    expect(res.tokenAddress).to.be.properAddress;
  });
});

describe('run command trex setup', () => {
  it('should work', async () => {
    const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP });
    expect(res.tokenAddress).to.be.properAddress;
  });

  describe('then run command token timeexchange:is-id', () => {
    it('should work', async () => {
      const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP });
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
      const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP });
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
      const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP });
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
      const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP });
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
      const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP });
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
});
