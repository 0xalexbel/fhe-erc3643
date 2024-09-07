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
  it('should deploy the SupplyLimit contract and bind it to the compliance', async () => {
    const context = await deploySupplyLimitFixture();

    expect(context.suite.complianceModule).not.to.be.undefined;
    expect(await context.suite.compliance.isModuleBound(context.suite.complianceModule)).to.be.true;
  });

  describe('.name()', () => {
    it('should return the name of the module', async () => {
      const context = await deploySupplyLimitFixture();

      expect(await context.suite.complianceModule.name()).to.be.equal('SupplyLimitModule');
    });
  });

  describe('.isPlugAndPlay', () => {
    it('should return true', async () => {
      const context = await deploySupplyLimitFullSuite();
      expect(await context.suite.complianceModule.isPlugAndPlay()).to.be.true;
    });
  });

  describe('.canComplianceBind', () => {
    it('should return true', async () => {
      const context = await deploySupplyLimitFullSuite();
      expect(await context.suite.complianceModule.canComplianceBind(context.suite.compliance)).to.be.true;
    });
  });

  describe('.owner', () => {
    it('should return owner', async () => {
      const context = await deploySupplyLimitFixture();
      await expect(context.suite.complianceModule.owner()).to.eventually.be.eq(context.accounts.deployer.address);
    });
  });

  describe('.initialize', () => {
    it('should be called only once', async () => {
      // given
      const {
        accounts: { deployer },
      } = await deployComplianceFixture();
      const module = (await ethers.deployContract('SupplyLimitModule')).connect(deployer);
      await module.initialize();

      // when & then
      await expect(module.initialize()).to.be.revertedWithCustomError(module, 'InvalidInitialization');
      expect(await module.owner()).to.be.eq(deployer.address);
    });
  });

  describe('.transferOwnership', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deploySupplyLimitFixture();
        await expect(
          context.suite.complianceModule
            .connect(context.accounts.aliceWallet)
            .transferOwnership(context.accounts.bobWallet.address),
        ).to.revertedWithCustomError(context.suite.complianceModule, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when calling with owner account', () => {
      it('should transfer ownership', async () => {
        // given
        const context = await deploySupplyLimitFixture();

        // when
        await context.suite.complianceModule
          .connect(context.accounts.deployer)
          .transferOwnership(context.accounts.bobWallet.address);

        // then
        const owner = await context.suite.complianceModule.owner();
        expect(owner).to.eq(context.accounts.bobWallet.address);
      });
    });
  });

  describe('.upgradeTo', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deploySupplyLimitFixture();
        await expect(
          context.suite.complianceModule
            .connect(context.accounts.aliceWallet)
            .upgradeToAndCall(ethers.ZeroAddress, '0x'),
        ).to.revertedWithCustomError(context.suite.complianceModule, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when calling with owner account', () => {
      it('should upgrade proxy', async () => {
        // given
        const context = await deploySupplyLimitFixture();
        const newImplementation = await ethers.deployContract('SupplyLimitModule');

        // when
        await context.suite.complianceModule
          .connect(context.accounts.deployer)
          .upgradeToAndCall(newImplementation, '0x');

        // then
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(
          await context.suite.complianceModule.getAddress(),
        );
        expect(implementationAddress).to.eq(newImplementation);
      });
    });
  });

  describe('.setSupplyLimit', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deploySupplyLimitFixture();

        const compliance = context.suite.compliance;
        const supplyLimitModule = context.suite.complianceModule;
        const encSupplyLimit = await encrypt64(supplyLimitModule, compliance, 100n);

        await expect(
          supplyLimitModule['setSupplyLimit(bytes32,bytes)'](encSupplyLimit.handles[0], encSupplyLimit.inputProof),
        ).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      it('should set supply limit', async () => {
        const context = await deploySupplyLimitFixture();

        const encAmount = await encrypt64(context.suite.complianceModule, context.suite.compliance, 100);

        console.log('compliance=' + (await context.suite.compliance.getAddress()));
        console.log('module=' + (await context.suite.complianceModule.getAddress()));
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

    describe('.moduleTransferAction', () => {
      describe('when calling from a random wallet', () => {
        it('should revert', async () => {
          const context = await deploySupplyLimitFullSuite();

          await expect(
            context.suite.complianceModule.moduleTransferAction(
              context.accounts.anotherWallet.address,
              context.accounts.anotherWallet.address,
              10,
            ),
          ).to.be.revertedWith('only bound compliance can call');
        });
      });

      describe('when calling as the compliance', () => {
        it('should do nothing', async () => {
          const context = await deploySupplyLimitFullSuite();

          await expect(
            context.suite.compliance.callModuleFunction(
              new ethers.Interface([
                'function moduleTransferAction(address _from, address _to, uint256 _value)',
              ]).encodeFunctionData('moduleTransferAction', [
                context.accounts.anotherWallet.address,
                context.accounts.anotherWallet.address,
                10,
              ]),
              context.suite.complianceModule,
            ),
          ).to.eventually.be.fulfilled;
        });
      });
    });

    describe('.moduleMintAction', () => {
      describe('when calling from a random wallet', () => {
        it('should revert', async () => {
          const context = await deploySupplyLimitFullSuite();

          await expect(
            context.suite.complianceModule.moduleMintAction(context.accounts.anotherWallet.address, 10),
          ).to.be.revertedWith('only bound compliance can call');
        });
      });

      describe('when calling as the compliance', () => {
        it('should do nothing', async () => {
          const context = await deploySupplyLimitFullSuite();

          await expect(
            context.suite.compliance.callModuleFunction(
              new ethers.Interface(['function moduleMintAction(address, uint256)']).encodeFunctionData(
                'moduleMintAction',
                [context.accounts.anotherWallet.address, 10],
              ),
              context.suite.complianceModule,
            ),
          ).to.eventually.be.fulfilled;
        });
      });
    });

    describe('.moduleBurnAction', () => {
      describe('when calling from a random wallet', () => {
        it('should revert', async () => {
          const context = await deploySupplyLimitFullSuite();

          await expect(
            context.suite.complianceModule.moduleBurnAction(context.accounts.anotherWallet.address, 10),
          ).to.be.revertedWith('only bound compliance can call');
        });
      });

      describe('when calling as the compliance', () => {
        it('should do nothing', async () => {
          const context = await deploySupplyLimitFullSuite();

          await expect(
            context.suite.compliance.callModuleFunction(
              new ethers.Interface(['function moduleBurnAction(address, uint256)']).encodeFunctionData(
                'moduleBurnAction',
                [context.accounts.anotherWallet.address, 10],
              ),
              context.suite.complianceModule,
            ),
          ).to.eventually.be.fulfilled;
        });
      });
    });
  });
});
