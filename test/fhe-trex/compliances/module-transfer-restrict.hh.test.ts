import { ethers } from 'hardhat';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';
import { expectTokenBalanceToEq, expectTokenTransferToEq, tokenBalanceOf } from '../../utils';

async function deployTransferRestrictFullSuite() {
  const context = await deploySuiteWithModularCompliancesFixture();
  // Set token compliance
  await context.suite.token.setCompliance(context.suite.compliance);
  const module = await ethers.deployContract('TransferRestrictModule');
  const proxy = await ethers.deployContract('ModuleProxy', [module, module.interface.encodeFunctionData('initialize')]);
  const complianceModule = await ethers.getContractAt('TransferRestrictModule', proxy);

  await context.suite.compliance.bindToken(context.suite.token);
  await context.suite.compliance.addModule(complianceModule);

  return {
    ...context,
    suite: {
      ...context.suite,
      complianceModule,
    },
  };
}

describe('.moduleCheck', () => {
  describe('when sender and receiver are not allowed', () => {
    it('should transfer zero', async () => {
      const context = await deployTransferRestrictFullSuite();
      // must test with verified accounts
      const to = context.accounts.bobWallet.address;
      const fromWallet = context.accounts.aliceWallet;

      const fromBalance = await tokenBalanceOf(context.suite.token, fromWallet);
      const toBalance = await tokenBalanceOf(context.suite.token, to);

      await expectTokenTransferToEq(context.suite.token, fromWallet, to, 10, 0);
      await expectTokenBalanceToEq(context.suite.token, fromWallet, fromBalance);
      await expectTokenBalanceToEq(context.suite.token, to, toBalance);

      // const to = context.accounts.anotherWallet.address;
      // const from = context.accounts.aliceWallet.address;
      // const result = await context.suite.complianceModule.moduleCheck(from, to, 10, context.suite.compliance);
      // expect(result).to.be.false;
    });
  });

  describe('when sender is allowed', () => {
    it('transfer should succeed', async () => {
      const context = await deployTransferRestrictFullSuite();
      // must test with verified accounts
      const to = context.accounts.aliceWallet.address;
      const fromWallet = context.accounts.bobWallet;
      const from = fromWallet.address;

      const fromBalance = await tokenBalanceOf(context.suite.token, fromWallet);
      const toBalance = await tokenBalanceOf(context.suite.token, to);

      await context.suite.compliance.callModuleFunction(
        new ethers.Interface(['function allowUser(address _userAddress)']).encodeFunctionData('allowUser', [from]),
        context.suite.complianceModule,
      );

      await expectTokenTransferToEq(context.suite.token, fromWallet, to, 10, 10);
      await expectTokenBalanceToEq(context.suite.token, fromWallet, fromBalance - 10n);
      await expectTokenBalanceToEq(context.suite.token, to, toBalance + 10n);

      // const result = await context.suite.complianceModule.moduleCheck(from, to, 10, context.suite.compliance);
      // expect(result).to.be.true;
    });
  });

  describe('when receiver is allowed', () => {
    it('transfer should succeed', async () => {
      const context = await deployTransferRestrictFullSuite();
      // must test with verified accounts
      const to = context.accounts.aliceWallet.address;
      const fromWallet = context.accounts.bobWallet;
      const from = fromWallet.address;

      const fromBalance = await tokenBalanceOf(context.suite.token, fromWallet);
      const toBalance = await tokenBalanceOf(context.suite.token, to);

      await context.suite.compliance.callModuleFunction(
        new ethers.Interface(['function allowUser(address _userAddress)']).encodeFunctionData('allowUser', [to]),
        context.suite.complianceModule,
      );

      await expectTokenTransferToEq(context.suite.token, fromWallet, to, 10, 10);
      await expectTokenBalanceToEq(context.suite.token, fromWallet, fromBalance - 10n);
      await expectTokenBalanceToEq(context.suite.token, to, toBalance + 10n);

      // const result = await context.suite.complianceModule.moduleCheck(from, to, 10, context.suite.compliance);
      // expect(result).to.be.true;
    });
  });
});
