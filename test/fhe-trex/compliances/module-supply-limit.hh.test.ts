import { ethers, upgrades, fhevm } from 'hardhat';
import { expect } from 'chai';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';
import { encrypt64, tokenBalanceOf, tokenMint, tokenTotalSupply, tokenTransfer } from '../../utils';
import { SupplyLimitModule } from '../../../types';
import { SupplyLimitModuleInterface } from '../../../types/contracts/fhe-trex/compliance/modular/modules/SupplyLimitModule';

async function deploySupplyLimitFixture() {
  const context = await deployComplianceFixture();

  const module = await ethers.deployContract('SupplyLimitModule');
  const proxy = await ethers.deployContract('ModuleProxy', [module, module.interface.encodeFunctionData('initialize')]);
  const complianceModule = await ethers.getContractAt('SupplyLimitModule', proxy);

  await context.suite.compliance.addModule(complianceModule);

  return {
    ...context,
    suite: {
      ...context.suite,
      complianceModule,
    },
  };
}

async function deploySupplyLimitFullSuite() {
  const context = await deploySuiteWithModularCompliancesFixture();
  const SupplyLimitModule = await ethers.getContractFactory('SupplyLimitModule');
  await context.suite.token.setCompliance(context.suite.compliance);
  const complianceModule = (await upgrades.deployProxy(SupplyLimitModule, [])) as any as SupplyLimitModule;
  await context.suite.compliance.addModule(complianceModule);

  return {
    ...context,
    suite: {
      ...context.suite,
      complianceModule,
    },
  };
}

describe('Compliance Module: SupplyLimit', () => {
  describe('.setSupplyLimit', () => {
    describe('when calling via compliance', () => {
      it('should set supply limit', async () => {
        const context = await deploySupplyLimitFixture();

        const encAmount = await encrypt64(context.suite.complianceModule, context.suite.compliance, 100);

        // within setSupplyLimit running code msg.sender === context.suite.compliance
        const tx = await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setSupplyLimit(bytes32,bytes)']).encodeFunctionData('setSupplyLimit', [
            encAmount.handles[0],
            encAmount.inputProof,
          ]),
          context.suite.complianceModule,
        );
        await tx.wait(1);

        const encAmount2 = await encrypt64(context.suite.complianceModule, context.suite.compliance, 200);
        const tx2 = await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setSupplyLimit(bytes32,bytes)']).encodeFunctionData('setSupplyLimit', [
            encAmount2.handles[0],
            encAmount2.inputProof,
          ]),
          context.suite.complianceModule,
        );
        await tx2.wait(1);

        // await expect(tx)
        //   .to.emit(context.suite.complianceModule, 'SupplyLimitSet')
        //   .withArgs(context.suite.compliance, 100);
      });
    });
  });

  describe('.getSupplyLimit', () => {
    describe('when calling directly', () => {
      it('should return', async () => {
        const context = await deploySupplyLimitFixture();

        const compliance = context.suite.compliance;
        const complianceOwner = context.accounts.deployer;
        const supplyLimitModule = context.suite.complianceModule;

        const iSupplyLimitModule: SupplyLimitModuleInterface = supplyLimitModule.interface;

        // compliance.owner === deployer
        expect(complianceOwner.address).to.equal(context.accounts.deployer.address);

        const encSupplyLimit = await encrypt64(supplyLimitModule, compliance, 1600n);

        // Typescript stricter version using typed interfaces
        const tx = await context.suite.compliance
          .connect(complianceOwner)
          .callModuleFunction(
            iSupplyLimitModule.encodeFunctionData('setSupplyLimit(bytes32,bytes)', [
              encSupplyLimit.handles[0],
              encSupplyLimit.inputProof,
            ]),
            supplyLimitModule,
          );
        await tx.wait(1);

        const newEncSupplyLimit = await context.suite.complianceModule.getSupplyLimit(context.suite.compliance);
        const supplyLimit = await fhevm.decrypt64(newEncSupplyLimit);

        expect(supplyLimit).to.be.eq(1600n);
      });
    });
  });

  describe('.moduleCheck', () => {
    describe('when supply limit does not exceed compliance supply limit', () => {
      it('should return true', async () => {
        const context = await deploySupplyLimitFullSuite();

        const token = context.suite.token;
        const aliceWallet = context.accounts.aliceWallet;
        const bobWallet = context.accounts.bobWallet;
        const compliance = context.suite.compliance;
        const complianceOwner = context.accounts.deployer;
        const supplyLimitModule = context.suite.complianceModule;

        // callModuleFunction only accessible by compliance.owner()
        const complianceOnwerAddress = await compliance.owner();
        expect(complianceOnwerAddress).to.eq(complianceOwner);

        const iSupplyLimitModule: SupplyLimitModuleInterface = supplyLimitModule.interface;

        // compliance.owner === deployer
        expect(complianceOwner.address).to.equal(context.accounts.deployer.address);

        const encSupplyLimit = await encrypt64(supplyLimitModule, compliance, 1600);
        // Typescript stricter version using typed interfaces
        const tx = await context.suite.compliance
          .connect(complianceOwner)
          .callModuleFunction(
            iSupplyLimitModule.encodeFunctionData('setSupplyLimit(bytes32,bytes)', [
              encSupplyLimit.handles[0],
              encSupplyLimit.inputProof,
            ]),
            supplyLimitModule,
          );
        await tx.wait(1);

        const encAliceBalance = await token.balanceOf(aliceWallet.address);
        const aliceBalance = await fhevm.decrypt64(encAliceBalance);

        await tokenTransfer(token, aliceWallet, bobWallet, aliceBalance - 100n);

        const newAliceBalance = await tokenBalanceOf(token, aliceWallet);

        expect(newAliceBalance).to.equal(100n);
      });
    });

    describe('when supply limit does exceed compliance supply limit', () => {
      it('totalSupply should remain the same', async () => {
        const context = await deploySupplyLimitFullSuite();

        const token = context.suite.token;
        const aliceWallet = context.accounts.aliceWallet;
        const tokenAgent = context.accounts.tokenAgent;
        const compliance = context.suite.compliance;
        const complianceOwner = context.accounts.deployer;
        const supplyLimitModule = context.suite.complianceModule;

        const iSupplyLimitModule: SupplyLimitModuleInterface = supplyLimitModule.interface;

        // compliance.owner === deployer
        expect(complianceOwner.address).to.equal(context.accounts.deployer.address);

        // compliance.owner === deployer
        // 1. await context.suite.compliance.callModuleFunction(
        //   new ethers.Interface(['function setSupplyLimit(uint256 _limit)']).encodeFunctionData('setSupplyLimit', [
        //     1600,
        //   ]),
        //   context.suite.complianceModule,
        // );
        const supplyLimit = 1600n;
        const encSupplyLimit = await encrypt64(supplyLimitModule, compliance, supplyLimit);

        const totalSupply = await tokenTotalSupply(token);

        // Typescript stricter version using typed interfaces
        const tx = await context.suite.compliance
          .connect(complianceOwner)
          .callModuleFunction(
            iSupplyLimitModule.encodeFunctionData('setSupplyLimit(bytes32,bytes)', [
              encSupplyLimit.handles[0],
              encSupplyLimit.inputProof,
            ]),
            supplyLimitModule,
          );
        await tx.wait(1);

        await tokenMint(token, tokenAgent, aliceWallet, supplyLimit - totalSupply + 1n);

        const newTotalSupply = await tokenTotalSupply(token);

        expect(newTotalSupply).to.equal(totalSupply);
      });
    });

    describe('when supply limit does not exceed compliance supply limit', () => {
      it('totalSupply should be changed successfully', async () => {
        const context = await deploySupplyLimitFullSuite();

        const token = context.suite.token;
        const aliceWallet = context.accounts.aliceWallet;
        const tokenAgent = context.accounts.tokenAgent;
        const compliance = context.suite.compliance;
        const complianceOwner = context.accounts.deployer;
        const supplyLimitModule = context.suite.complianceModule;

        const iSupplyLimitModule: SupplyLimitModuleInterface = supplyLimitModule.interface;

        // compliance.owner === deployer
        expect(complianceOwner.address).to.equal(context.accounts.deployer.address);

        // compliance.owner === deployer
        // 1. await context.suite.compliance.callModuleFunction(
        //   new ethers.Interface(['function setSupplyLimit(uint256 _limit)']).encodeFunctionData('setSupplyLimit', [
        //     1600,
        //   ]),
        //   context.suite.complianceModule,
        // );
        const supplyLimit = 1600n;
        const encSupplyLimit = await encrypt64(supplyLimitModule, compliance, supplyLimit);

        const totalSupply = await tokenTotalSupply(token);

        // Typescript stricter version using typed interfaces
        const tx = await context.suite.compliance
          .connect(complianceOwner)
          .callModuleFunction(
            iSupplyLimitModule.encodeFunctionData('setSupplyLimit(bytes32,bytes)', [
              encSupplyLimit.handles[0],
              encSupplyLimit.inputProof,
            ]),
            supplyLimitModule,
          );
        await tx.wait(1);

        await tokenMint(token, tokenAgent, aliceWallet, supplyLimit - totalSupply - 1n);

        const newTotalSupply = await tokenTotalSupply(token);

        expect(newTotalSupply).to.equal(supplyLimit - 1n);
      });
    });
  });
});
