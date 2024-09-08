/* eslint-disable no-unused-expressions */

import hre from 'hardhat';
import { expect } from 'chai';
import {
  SCOPE_TOKEN,
  SCOPE_TOKEN_BALANCE,
  SCOPE_TOKEN_BURN,
  SCOPE_TOKEN_IS_PAUSED,
  SCOPE_TOKEN_MINT,
  SCOPE_TOKEN_TIME_EXCHANGE_ADD_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_GET_LIMITS,
  SCOPE_TOKEN_TIME_EXCHANGE_IS_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_REMOVE_ID,
  SCOPE_TOKEN_TIME_EXCHANGE_SET_LIMITS,
  SCOPE_TOKEN_TOTAL_SUPPLY,
  SCOPE_TOKEN_TRANSFER,
  SCOPE_TOKEN_UNPAUSE,
  SCOPE_TREX,
  SCOPE_TREX_SETUP,
} from '../../../tasks/task-names';
import { CmdTREXSetupOutput } from '../../../sdk/cli/trex';

const cmdTotalSupply = { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_TOTAL_SUPPLY };
const cmdMint = { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_MINT };
const cmdBalance = { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BALANCE };
const cmdBurn = { scope: SCOPE_TOKEN, task: SCOPE_TOKEN_BURN };

describe('npx hardhat --network fhevm trex setup', () => {
  let context: CmdTREXSetupOutput;
  before(async () => {
    context = await hre.run({ scope: SCOPE_TREX, task: SCOPE_TREX_SETUP });
    expect(context.tokenAddress).to.be.properAddress;
  });

  it('should work', async () => {
    let amount = await hre.run(cmdTotalSupply, { token: context.tokenAddress });
    expect(amount.value).to.eq(0);

    // mint to alice
    await hre.run(cmdMint, {
      token: context.tokenAddress,
      agent: context.tokenAgent.walletName,
      user: context.accounts['alice'].walletName,
      amount: 1000n,
    });

    // check alice balance
    const aliceBalance = await hre.run(cmdBalance, {
      token: context.tokenAddress,
      user: context.accounts['alice'].walletName,
    });
    expect(aliceBalance.value).to.eq(1000);

    // mint to bob
    await hre.run(cmdMint, {
      token: context.tokenAddress,
      agent: context.tokenAgent.walletName,
      user: context.accounts['bob'].walletName,
      amount: 600n,
    });

    // check bob balance
    amount = await hre.run(cmdBalance, { token: context.tokenAddress, user: context.accounts['bob'].walletName });
    expect(amount.value).to.eq(600);

    // check total supply
    amount = await hre.run(cmdTotalSupply, { token: context.tokenAddress });
    expect(amount.value).to.eq(1600);

    // burn bob
    await hre.run(cmdBurn, {
      token: context.tokenAddress,
      agent: context.tokenAgent.walletName,
      user: context.accounts['bob'].walletName,
      amount: 100n,
    });

    // check bob balance
    amount = await hre.run(cmdBalance, { token: context.tokenAddress, user: context.accounts['bob'].walletName });
    expect(amount.value).to.eq(500);

    // check total supply
    amount = await hre.run(cmdTotalSupply, { token: context.tokenAddress });
    expect(amount.value).to.eq(1500);
  });
});
