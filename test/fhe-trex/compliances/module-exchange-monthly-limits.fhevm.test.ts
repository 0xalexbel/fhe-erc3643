import { ethers, upgrades, fhevm } from 'hardhat';
import { expect } from 'chai';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';
import {
  expectTokenBurnToSucceed,
  expectTokenMintToSucceed,
  expectTokenTransferToFail,
  expectTokenTransferToSucceed,
  tokenBalanceOf,
} from '../../utils';
import { ExchangeMonthlyLimitsModule, Identity, IdentityRegistry, ModularCompliance, Token } from '../../../types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { txWait } from '../../../sdk/utils';

type MyContext = {
  suite: {
    token: Token;
    compliance: ModularCompliance;
    complianceModule: ExchangeMonthlyLimitsModule;
    identityRegistry: IdentityRegistry;
  };
  accounts: {
    aliceWallet: HardhatEthersSigner;
    bobWallet: HardhatEthersSigner;
    charlieWallet: HardhatEthersSigner;
    deployer: HardhatEthersSigner;
    tokenAgent: HardhatEthersSigner;
  };
};

async function deployExchangeMonthlyLimitsFullSuite() {
  // verifyCharlie = true
  const context = await deploySuiteWithModularCompliancesFixture();
  // Set token compliance
  await txWait(context.suite.token.setCompliance(context.suite.compliance), {});
  const ExchangeMonthlyLimitsModule = await ethers.getContractFactory('ExchangeMonthlyLimitsModule');
  // type = Contract
  const _complianceModule = await upgrades.deployProxy(ExchangeMonthlyLimitsModule, []);
  // type = ExchangeMonthlyLimitsModule
  const complianceModule = await ethers.getContractAt('ExchangeMonthlyLimitsModule', _complianceModule);
  await txWait(context.suite.compliance.bindToken(context.suite.token), {});
  await txWait(context.suite.compliance.addModule(complianceModule), {});
  await expect(context.suite.compliance.isModuleBound(complianceModule)).to.be.eventually.true;

  return {
    ...context,
    suite: {
      ...context.suite,
      complianceModule,
    },
  };
}

describe('FHEVM Compliance Module: ExchangeMonthlyLimits', () => {
  let initialAliceBalance: bigint;
  let initialBobBalance: bigint;
  let charlieHasBeenUsed: boolean;
  let aliceID: string;
  let bobID: string;
  let charlieID: string;

  let context: {
    suite: {
      token: Token;
      compliance: ModularCompliance;
      complianceModule: ExchangeMonthlyLimitsModule;
      identityRegistry: IdentityRegistry;
    };
    accounts: {
      aliceWallet: HardhatEthersSigner;
      bobWallet: HardhatEthersSigner;
      charlieWallet: HardhatEthersSigner;
      deployer: HardhatEthersSigner;
      tokenAgent: HardhatEthersSigner;
    };
  };

  async function resetModule() {
    const ExchangeMonthlyLimitsModule = await ethers.getContractFactory('ExchangeMonthlyLimitsModule');
    // type = Contract
    const _complianceModule = await upgrades.deployProxy(ExchangeMonthlyLimitsModule, []);
    // type = ExchangeMonthlyLimitsModule
    const newComplianceModule = await ethers.getContractAt('ExchangeMonthlyLimitsModule', _complianceModule);
    await expect(context.suite.compliance.isModuleBound(context.suite.complianceModule)).to.be.eventually.true;
    await context.suite.compliance.removeModule(context.suite.complianceModule);
    await context.suite.compliance.addModule(newComplianceModule);
    await expect(context.suite.compliance.isModuleBound(newComplianceModule)).to.be.eventually.true;

    context.suite.complianceModule = newComplianceModule;
  }

  before(async () => {
    context = await deployExchangeMonthlyLimitsFullSuite();

    initialAliceBalance = await tokenBalanceOf(context.suite.token, context.accounts.aliceWallet);
    initialBobBalance = await tokenBalanceOf(context.suite.token, context.accounts.bobWallet);
    charlieHasBeenUsed = false;

    aliceID = await context.suite.identityRegistry.identity(context.accounts.aliceWallet);
    bobID = await context.suite.identityRegistry.identity(context.accounts.bobWallet);
    charlieID = await context.suite.identityRegistry.identity(context.accounts.charlieWallet);

    const compliance = context.suite.complianceModule;
    if (await compliance.isExchangeID(aliceID)) {
      await compliance.removeExchangeID(aliceID);
    }
    if (await compliance.isExchangeID(bobID)) {
      await compliance.removeExchangeID(bobID);
    }
    if (await compliance.isExchangeID(charlieID)) {
      await compliance.removeExchangeID(charlieID);
    }
  });

  afterEach(async () => {
    const token = context.suite.token;

    // Check reset state
    let aliceBalance = await tokenBalanceOf(token, context.accounts.aliceWallet);
    let bobBalance = await tokenBalanceOf(token, context.accounts.bobWallet);

    const compliance = context.suite.complianceModule;
    if (await compliance.isExchangeID(aliceID)) {
      await compliance.removeExchangeID(aliceID);
    }
    if (await compliance.isExchangeID(bobID)) {
      await compliance.removeExchangeID(bobID);
    }

    if (aliceBalance + bobBalance > initialAliceBalance + initialBobBalance) {
      expect(aliceBalance).to.eq(initialAliceBalance);
      expect(bobBalance).to.greaterThan(initialBobBalance);
      await expectTokenBurnToSucceed(
        token,
        context.accounts.tokenAgent,
        context.accounts.bobWallet,
        bobBalance - initialBobBalance,
      );
      bobBalance = initialBobBalance;
    } else {
      expect(aliceBalance + bobBalance).to.eq(initialAliceBalance + initialBobBalance);
      if (aliceBalance < initialAliceBalance) {
        await expectTokenTransferToSucceed(
          token,
          context.accounts.bobWallet,
          context.accounts.aliceWallet,
          initialAliceBalance - aliceBalance,
        );
      } else if (aliceBalance > initialAliceBalance) {
        await expectTokenTransferToSucceed(
          token,
          context.accounts.aliceWallet,
          context.accounts.bobWallet,
          aliceBalance - initialAliceBalance,
        );
      }
    }

    const newAliceBalance = await tokenBalanceOf(token, context.accounts.aliceWallet);
    const newBobBalance = await tokenBalanceOf(token, context.accounts.bobWallet);

    expect(newAliceBalance).to.eq(initialAliceBalance);
    expect(newBobBalance).to.eq(initialBobBalance);

    await context.suite.compliance.callModuleFunction(
      new ethers.Interface([
        'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
      ]).encodeFunctionData('setExchangeMonthlyLimit', [aliceID, 0]),
      context.suite.complianceModule,
    );

    await context.suite.compliance.callModuleFunction(
      new ethers.Interface([
        'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
      ]).encodeFunctionData('setExchangeMonthlyLimit', [bobID, 0]),
      context.suite.complianceModule,
    );

    await context.suite.compliance.callModuleFunction(
      new ethers.Interface([
        'function setExchangeMonthlyLimit(address _exchangeID, uint256 _newExchangeMonthlyLimit)',
      ]).encodeFunctionData('setExchangeMonthlyLimit', [charlieID, 0]),
      context.suite.complianceModule,
    );
  });

  describe('.moduleTransferAction', () => {
    describe('when calling via compliance', () => {
      describe('when receiver is an exchange', () => {
        describe('when sender is not a token agent', () => {
          describe('when the exchange monthly limit is not exceeded', () => {
            it('should increase exchange counter', async () => {
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
        const token = context.suite.token;
        const aliceAgent = context.accounts.aliceWallet;

        // Set alice as token agent
        let tx = await token.connect(context.accounts.deployer).addAgent(aliceAgent);
        await tx.wait(1);
        let isAliceAgent = await token.isAgent(aliceAgent);
        expect(isAliceAgent).to.eq(true);

        await expectTokenTransferToSucceed(context.suite.token, aliceAgent, context.accounts.bobWallet, 100);

        // reset alice agent role
        tx = await token.connect(context.accounts.deployer).removeAgent(aliceAgent);
        await tx.wait(1);
        isAliceAgent = await token.isAgent(aliceAgent);
        expect(isAliceAgent).to.eq(false);

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
          await resetModule();

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
          await resetModule();

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
          await resetModule();

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
