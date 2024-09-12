import { ethers } from 'hardhat';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';
import { expectTokenBalanceToEq, expectTokenTransferToEq, tokenBalanceOf } from '../../utils';
import { ModularCompliance, Token, TransferRestrictModule } from '../../../types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { AddressLike } from 'ethers';

async function deployTransferRestrictFullSuite() {
  const context = await deploySuiteWithModularCompliancesFixture();
  // Set token compliance
  await context.suite.token.setCompliance(context.suite.compliance);

  const module = await ethers.deployContract('TransferRestrictModule');
  await module.waitForDeployment();
  const proxy = await ethers.deployContract('ModuleProxy', [module, module.interface.encodeFunctionData('initialize')]);
  await proxy.waitForDeployment();
  const complianceModule = await ethers.getContractAt('TransferRestrictModule', proxy);

  let tx = await context.suite.compliance.bindToken(context.suite.token);
  await tx.wait(1);

  tx = await context.suite.compliance.addModule(complianceModule);
  await tx.wait(1);

  return {
    ...context,
    suite: {
      ...context.suite,
      complianceModule,
    },
  };
}

async function resetPermission(compliance: ModularCompliance, complianceModule: AddressLike, user: string) {
  // Reset permissions
  const tx = await compliance.callModuleFunction(
    new ethers.Interface(['function disallowUser(address _userAddress)']).encodeFunctionData('disallowUser', [user]),
    complianceModule,
  );
  await tx.wait(1);
}

describe('FHEVM .moduleCheck', () => {
  let context: {
    suite: {
      token: Token;
      compliance: ModularCompliance;
      complianceModule: TransferRestrictModule;
    };
    accounts: {
      aliceWallet: HardhatEthersSigner;
      bobWallet: HardhatEthersSigner;
    };
  };
  let initialAliceBalance: bigint;
  let initialBobBalance: bigint;

  before(async () => {
    context = await deployTransferRestrictFullSuite();

    initialAliceBalance = await tokenBalanceOf(context.suite.token, context.accounts.aliceWallet);
    initialBobBalance = await tokenBalanceOf(context.suite.token, context.accounts.bobWallet);
  });

  afterEach(async () => {
    // Check reset state
    const aliceBalance = await tokenBalanceOf(context.suite.token, context.accounts.aliceWallet);
    const bobBalance = await tokenBalanceOf(context.suite.token, context.accounts.bobWallet);

    expect(aliceBalance).to.eq(initialAliceBalance);
    expect(bobBalance).to.eq(initialBobBalance);

    const isAliceAllowed = await context.suite.complianceModule.isUserAllowed(
      context.suite.compliance,
      context.accounts.aliceWallet,
    );
    const isBobAllowed = await context.suite.complianceModule.isUserAllowed(
      context.suite.compliance,
      context.accounts.aliceWallet,
    );

    expect(isAliceAllowed).to.eq(false);
    expect(isBobAllowed).to.eq(false);
  });

  describe('when sender and receiver are not allowed', () => {
    it('should transfer zero', async () => {
      // must test with verified accounts
      const to = context.accounts.bobWallet.address;
      const fromWallet = context.accounts.aliceWallet;

      const fromBalance = await tokenBalanceOf(context.suite.token, fromWallet);
      const toBalance = await tokenBalanceOf(context.suite.token, to);

      await expectTokenTransferToEq(context.suite.token, fromWallet, to, 10, 0);
      await expectTokenBalanceToEq(context.suite.token, fromWallet, fromBalance);
      await expectTokenBalanceToEq(context.suite.token, to, toBalance);
    });
  });

  describe('when sender is allowed', () => {
    it('transfer should succeed', async () => {
      // must test with verified accounts
      const fromWallet = context.accounts.aliceWallet;
      const toWallet = context.accounts.bobWallet;

      const fromBalance = await tokenBalanceOf(context.suite.token, fromWallet);
      const toBalance = await tokenBalanceOf(context.suite.token, toWallet);

      await context.suite.compliance.callModuleFunction(
        new ethers.Interface(['function allowUser(address _userAddress)']).encodeFunctionData('allowUser', [
          fromWallet.address,
        ]),
        context.suite.complianceModule,
      );

      await expectTokenTransferToEq(context.suite.token, fromWallet, toWallet, 10, 10);
      await expectTokenBalanceToEq(context.suite.token, fromWallet, fromBalance - 10n);
      await expectTokenBalanceToEq(context.suite.token, toWallet, toBalance + 10n);

      // Reset balance
      await expectTokenTransferToEq(context.suite.token, toWallet, fromWallet, 10, 10);
      await expectTokenBalanceToEq(context.suite.token, fromWallet, fromBalance);
      await expectTokenBalanceToEq(context.suite.token, toWallet, toBalance);

      // Reset permissions
      await resetPermission(context.suite.compliance, context.suite.complianceModule, fromWallet.address);
    });
  });

  describe('when receiver is allowed', () => {
    it('transfer should succeed', async () => {
      const context = await deployTransferRestrictFullSuite();
      // must test with verified accounts
      const fromWallet = context.accounts.aliceWallet;
      const toWallet = context.accounts.bobWallet;

      const fromBalance = await tokenBalanceOf(context.suite.token, fromWallet);
      const toBalance = await tokenBalanceOf(context.suite.token, toWallet);

      await context.suite.compliance.callModuleFunction(
        new ethers.Interface(['function allowUser(address _userAddress)']).encodeFunctionData('allowUser', [
          toWallet.address,
        ]),
        context.suite.complianceModule,
      );

      await expectTokenTransferToEq(context.suite.token, fromWallet, toWallet, 10, 10);
      await expectTokenBalanceToEq(context.suite.token, fromWallet, fromBalance - 10n);
      await expectTokenBalanceToEq(context.suite.token, toWallet, toBalance + 10n);

      // Reset balance
      await expectTokenTransferToEq(context.suite.token, toWallet, fromWallet, 10, 10);
      await expectTokenBalanceToEq(context.suite.token, fromWallet, fromBalance);
      await expectTokenBalanceToEq(context.suite.token, toWallet, toBalance);

      // Reset permissions
      await resetPermission(context.suite.compliance, context.suite.complianceModule, toWallet.address);
    });
  });
});
