import { ethers, upgrades, fhevm } from 'hardhat';
import { expect } from 'chai';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';
import { expectTokenMintToSucceed, expectTokenTransferToFail, expectTokenTransferToSucceed } from '../../utils';

async function deployExchangeMonthlyLimitsFullSuite() {
  const context = await deploySuiteWithModularCompliancesFixture();
  // Set token compliance
  await context.suite.token.setCompliance(context.suite.compliance);
  const ExchangeMonthlyLimitsModule = await ethers.getContractFactory('ExchangeMonthlyLimitsModule');
  // type = Contract
  const _complianceModule = await upgrades.deployProxy(ExchangeMonthlyLimitsModule, []);
  // type = ExchangeMonthlyLimitsModule
  const complianceModule = await ethers.getContractAt('ExchangeMonthlyLimitsModule', _complianceModule);
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

describe('Compliance Module: ExchangeMonthlyLimits', () => {
  describe('.moduleTransferAction', () => {
    describe('when calling via compliance', () => {
      describe('when receiver is an exchange', () => {
        describe('when sender is not a token agent', () => {
          describe('when the exchange monthly limit is not exceeded', () => {
            it('should increase exchange counter', async () => {
              const context = await deployExchangeMonthlyLimitsFullSuite();
              const fromWallet = context.accounts.aliceWallet;
              const toWallet = context.accounts.bobWallet;
              const investorID = await context.suite.identityRegistry.identity(fromWallet);
              const exchangeID = await context.suite.identityRegistry.identity(toWallet);

              await context.suite.complianceModule.connect(context.accounts.deployer).addExchangeID(exchangeID);

              await context.suite.compliance.callModuleFunction(
                new ethers.Interface([
                  'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
                ]).encodeFunctionData('setExchangeMonthlyLimit', [exchangeID, 100]),
                context.suite.complianceModule,
              );

              const l = await context.suite.complianceModule.getExchangeMonthlyLimit(
                context.suite.compliance,
                exchangeID,
              );
              expect(l).to.eq(100);
              await expectTokenTransferToSucceed(context.suite.token, fromWallet, toWallet, 10);

              const encCounter = await context.suite.complianceModule.getMonthlyCounter(
                context.suite.compliance,
                exchangeID,
                investorID,
              );
              const counter = await fhevm.decrypt64(encCounter);
              expect(counter).to.be.eq(10);
            });
          });

          describe('when the exchange month is finished', () => {
            it('should set monthly timer', async () => {
              const context = await deployExchangeMonthlyLimitsFullSuite();
              const fromWallet = context.accounts.aliceWallet;
              const toWallet = context.accounts.bobWallet;
              const exchangeID = await context.suite.identityRegistry.identity(toWallet);
              const investorID = await context.suite.identityRegistry.identity(fromWallet);

              await context.suite.complianceModule.connect(context.accounts.deployer).addExchangeID(exchangeID);

              // Must set a monthly limit to allow transfer
              await context.suite.compliance.callModuleFunction(
                new ethers.Interface([
                  'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
                ]).encodeFunctionData('setExchangeMonthlyLimit', [exchangeID, 100]),
                context.suite.complianceModule,
              );

              // await context.suite.compliance.callModuleFunction(
              //   new ethers.Interface([
              //     'function moduleTransferAction(address _from, address _to, uint256 _value)',
              //   ]).encodeFunctionData('moduleTransferAction', [fromWallet, toWallet, 10]),
              //   context.suite.complianceModule,
              // );

              await expectTokenTransferToSucceed(context.suite.token, fromWallet, toWallet, 10);

              const timer = await context.suite.complianceModule.getMonthlyTimer(
                context.suite.compliance,
                exchangeID,
                investorID,
              );
              expect(timer).to.be.gt(0);
            });
          });
          describe('when the exchange month is not finished', () => {
            it('should not update monthly timer', async () => {
              const context = await deployExchangeMonthlyLimitsFullSuite();
              const fromWallet = context.accounts.aliceWallet;
              const toWallet = context.accounts.bobWallet;
              const exchangeID = await context.suite.identityRegistry.identity(toWallet);
              const investorID = await context.suite.identityRegistry.identity(fromWallet);

              await context.suite.complianceModule.connect(context.accounts.deployer).addExchangeID(exchangeID);

              // Must set a monthly limit to allow transfer
              await context.suite.compliance.callModuleFunction(
                new ethers.Interface([
                  'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
                ]).encodeFunctionData('setExchangeMonthlyLimit', [exchangeID, 100]),
                context.suite.complianceModule,
              );

              // await context.suite.compliance.callModuleFunction(
              //   new ethers.Interface([
              //     'function moduleTransferAction(address _from, address _to, uint256 _value)',
              //   ]).encodeFunctionData('moduleTransferAction', [fromWallet.address, toWallet.address, 10]),
              //   context.suite.complianceModule,
              // );
              await expectTokenTransferToSucceed(context.suite.token, fromWallet, toWallet, 10);

              const previousTimer = await context.suite.complianceModule.getMonthlyTimer(
                context.suite.compliance,
                exchangeID,
                investorID,
              );

              // await context.suite.compliance.callModuleFunction(
              //   new ethers.Interface([
              //     'function moduleTransferAction(address _from, address _to, uint256 _value)',
              //   ]).encodeFunctionData('moduleTransferAction', [fromWallet.address, toWallet.address, 11]),
              //   context.suite.complianceModule,
              // );
              await expectTokenTransferToSucceed(context.suite.token, fromWallet, toWallet, 11);

              const timer = await context.suite.complianceModule.getMonthlyTimer(
                context.suite.compliance,
                exchangeID,
                investorID,
              );
              expect(timer).to.be.eq(previousTimer);
            });
          });
        });
      });
    });
  });

  describe('.moduleCheck', () => {
    describe('when from is null address', () => {
      it('should return true', async () => {
        const context = await deployExchangeMonthlyLimitsFullSuite();
        await expectTokenMintToSucceed(
          context.suite.token,
          context.accounts.tokenAgent,
          context.accounts.bobWallet.address,
          100,
        );
        // expect(
        //   await context.suite.complianceModule.moduleCheck(
        //     '0x0000000000000000000000000000000000000000',
        //     context.accounts.bobWallet.address,
        //     100,
        //     context.suite.compliance,
        //   ),
        // ).to.be.true;
      });
    });

    describe('when from is token agent', () => {
      it('should return true', async () => {
        const context = await deployExchangeMonthlyLimitsFullSuite();
        const token = context.suite.token;
        const aliceAgent = context.accounts.aliceWallet;

        // Set alice as token agent
        let tx = await token.connect(context.accounts.deployer).addAgent(aliceAgent);
        await tx.wait(1);
        const isAliceAgent = await token.isAgent(aliceAgent);
        expect(isAliceAgent).to.eq(true);

        await expectTokenTransferToSucceed(context.suite.token, aliceAgent, context.accounts.bobWallet, 100);
        // expect(
        //   await context.suite.complianceModule.moduleCheck(
        //     context.accounts.tokenAgent.address,
        //     context.accounts.bobWallet.address,
        //     100,
        //     context.suite.compliance,
        //   ),
        // ).to.be.true;
      });
    });

    describe('when receiver is not exchange', () => {
      it('should return true', async () => {
        const context = await deployExchangeMonthlyLimitsFullSuite();
        await expectTokenTransferToSucceed(
          context.suite.token,
          context.accounts.aliceWallet,
          context.accounts.bobWallet,
          100,
        );
        // expect(
        //   await context.suite.complianceModule.moduleCheck(
        //     context.accounts.aliceWallet.address,
        //     context.accounts.bobWallet.address,
        //     100,
        //     context.suite.compliance,
        //   ),
        // ).to.be.true;
      });
    });

    describe('when receiver is exchange', () => {
      describe('when sender is exchange', () => {
        it('should return true', async () => {
          const context = await deployExchangeMonthlyLimitsFullSuite();
          const fromWallet = context.accounts.aliceWallet;
          const toWallet = context.accounts.bobWallet;
          const senderExchangeID = await context.suite.identityRegistry.identity(fromWallet);
          const receiverExchangeID = await context.suite.identityRegistry.identity(toWallet);

          await context.suite.complianceModule.connect(context.accounts.deployer).addExchangeID(senderExchangeID);

          await context.suite.complianceModule.connect(context.accounts.deployer).addExchangeID(receiverExchangeID);

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface([
              'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
            ]).encodeFunctionData('setExchangeMonthlyLimit', [receiverExchangeID, 90]),
            context.suite.complianceModule,
          );

          await expectTokenTransferToSucceed(context.suite.token, fromWallet, toWallet, 100);

          //expect(await context.suite.complianceModule.moduleCheck(from, to, 100, context.suite.compliance)).to.be.true;
        });
      });

      describe('when value exceeds the monthly limit', () => {
        it('should return false', async () => {
          const context = await deployExchangeMonthlyLimitsFullSuite();
          const from = context.accounts.aliceWallet;
          const to = context.accounts.bobWallet;
          const exchangeID = await context.suite.identityRegistry.identity(to);

          await context.suite.complianceModule.connect(context.accounts.deployer).addExchangeID(exchangeID);

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface([
              'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
            ]).encodeFunctionData('setExchangeMonthlyLimit', [exchangeID, 90]),
            context.suite.complianceModule,
          );

          await expectTokenTransferToFail(context.suite.token, from, to, 100);

          //expect(await context.suite.complianceModule.moduleCheck(from, to, 100, context.suite.compliance)).to.be.false;
        });
      });

      describe('when exchange month is finished', () => {
        it('should return true', async () => {
          const context = await deployExchangeMonthlyLimitsFullSuite();
          const from = context.accounts.aliceWallet;
          const to = context.accounts.bobWallet;
          const exchangeID = await context.suite.identityRegistry.identity(to);

          await context.suite.complianceModule.connect(context.accounts.deployer).addExchangeID(exchangeID);

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface([
              'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
            ]).encodeFunctionData('setExchangeMonthlyLimit', [exchangeID, 150]),
            context.suite.complianceModule,
          );

          await expectTokenTransferToSucceed(context.suite.token, from, to, 100);

          // expect(await context.suite.complianceModule.moduleCheck(from, to, 100, context.suite.compliance)).to.be.true;
        });
      });

      describe('when monthly counter exceeds the monthly limit', () => {
        it('should return false', async () => {
          const context = await deployExchangeMonthlyLimitsFullSuite();
          const from = context.accounts.aliceWallet;
          const to = context.accounts.bobWallet;
          const exchangeID = await context.suite.identityRegistry.identity(to);

          await context.suite.complianceModule.connect(context.accounts.deployer).addExchangeID(exchangeID);

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface([
              'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
            ]).encodeFunctionData('setExchangeMonthlyLimit', [exchangeID, 150]),
            context.suite.complianceModule,
          );

          // await context.suite.compliance.callModuleFunction(
          //   new ethers.Interface([
          //     'function moduleTransferAction(address _from, address _to, uint256 _value)',
          //   ]).encodeFunctionData('moduleTransferAction', [from.address, to.address, 100]),
          //   context.suite.complianceModule,
          // );

          // first transfer is ok
          await expectTokenTransferToSucceed(context.suite.token, from, to, 100);
          // second transfer exeeds monthly limit
          await expectTokenTransferToFail(context.suite.token, from, to, 100);

          //expect(await context.suite.complianceModule.moduleCheck(from, to, 100, context.suite.compliance)).to.be.false;
        });
      });

      describe('when monthly counter does not exceed the monthly limit', () => {
        it('should return true', async () => {
          const context = await deployExchangeMonthlyLimitsFullSuite();
          const from = context.accounts.aliceWallet;
          const to = context.accounts.bobWallet;
          const exchangeID = await context.suite.identityRegistry.identity(to);

          await context.suite.complianceModule.connect(context.accounts.deployer).addExchangeID(exchangeID);

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface([
              'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
            ]).encodeFunctionData('setExchangeMonthlyLimit', [exchangeID, 150]),
            context.suite.complianceModule,
          );

          // await context.suite.compliance.callModuleFunction(
          //   new ethers.Interface([
          //     'function moduleTransferAction(address _from, address _to, uint256 _value)',
          //   ]).encodeFunctionData('moduleTransferAction', [from.address, to.address, 100]),
          //   context.suite.complianceModule,
          // );

          await expectTokenTransferToSucceed(context.suite.token, from, to, 100);

          //expect(await context.suite.complianceModule.moduleCheck(from, to, 40, context.suite.compliance)).to.be.true;
        });
      });
    });
  });
});
