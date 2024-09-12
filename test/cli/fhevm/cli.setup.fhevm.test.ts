/* eslint-disable no-unused-expressions */

import hre from 'hardhat';
import { expect } from 'chai';
import { SCOPE_TREX, SCOPE_TREX_SETUP } from '../../../tasks/task-names';

describe('npx hardhat --network fhevm trex setup', () => {
  it('should work', async () => {
    const res: { tokenAddress: string } = await hre.run(
      { scope: SCOPE_TREX, task: SCOPE_TREX_SETUP },
      { mint: 10000n },
    );
    expect(res.tokenAddress).to.be.properAddress;
  });
});
