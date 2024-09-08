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
} from '../../../tasks/task-names';

describe('npx hardhat --network fhevm trex setup', () => {
  it('should work', async () => {
    const res: { tokenAddress: string } = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP });
    expect(res.tokenAddress).to.be.properAddress;
  });
});
