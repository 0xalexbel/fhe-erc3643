import hre from 'hardhat';
import { expect } from 'chai';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_TIME_EXCHANGE_ADD_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_IS_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_REMOVE_ID,
  SCOPE_TREX,
  SCOPE_TREX_SETUP,
} from '../tasks/task-names';

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
        { token: res.tokenAddress, user: 'alice' },
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
        { token: res.tokenAddress, user: 'alice' },
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
        { token: res.tokenAddress, user: 'alice' },
      );
      // check
      isAliceId = await hre.run(
        { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TIME_EXCHANGE_IS_ID },
        { token: res.tokenAddress, user: 'alice' },
      );
      expect(isAliceId).to.be.false;
    });
  });
});
