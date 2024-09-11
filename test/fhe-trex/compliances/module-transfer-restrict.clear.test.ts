/* eslint-disable  @typescript-eslint/no-unused-expressions */

import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';

async function deployTransferRestrictFullSuite() {
  const context = await deploySuiteWithModularCompliancesFixture();
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

describe('Compliance Module: TransferRestrict', () => {
  it('should deploy the TransferRestrict contract and bind it to the compliance', async () => {
    const context = await deployTransferRestrictFullSuite();

    expect(context.suite.complianceModule).not.to.be.undefined;
    expect(await context.suite.compliance.isModuleBound(context.suite.complianceModule)).to.be.true;
  });

  describe('.name', () => {
    it('should return the name of the module', async () => {
      const context = await deployTransferRestrictFullSuite();

      expect(await context.suite.complianceModule.name()).to.be.equal('TransferRestrictModule');
    });
  });

  describe('.isPlugAndPlay', () => {
    it('should return true', async () => {
      const context = await deployTransferRestrictFullSuite();
      expect(await context.suite.complianceModule.isPlugAndPlay()).to.be.true;
    });
  });

  describe('.canComplianceBind', () => {
    it('should return true', async () => {
      const context = await deployTransferRestrictFullSuite();
      const complianceModule = await ethers.deployContract('TransferRestrictModule');
      expect(await complianceModule.canComplianceBind(context.suite.compliance)).to.be.true;
    });
  });

  describe('.owner', () => {
    it('should return owner', async () => {
      const context = await deployTransferRestrictFullSuite();
      await expect(context.suite.complianceModule.owner()).to.eventually.be.eq(context.accounts.deployer.address);
    });
  });

  describe('.initialize', () => {
    it('should be called only once', async () => {
      // given
      const {
        accounts: { deployer },
      } = await deployComplianceFixture();
      const module = (await ethers.deployContract('TransferRestrictModule')).connect(deployer);
      await module.initialize();

      // when & then
      await expect(module.initialize()).to.be.revertedWithCustomError(module, 'InvalidInitialization');
      expect(await module.owner()).to.be.eq(deployer.address);
    });
  });

  describe('.transferOwnership', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployTransferRestrictFullSuite();
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
        const context = await deployTransferRestrictFullSuite();

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
        const context = await deployTransferRestrictFullSuite();
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
        const context = await deployTransferRestrictFullSuite();
        const newImplementation = await ethers.deployContract('TransferRestrictModule');

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

  describe('.allowUser', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployTransferRestrictFullSuite();

        await expect(context.suite.complianceModule.allowUser(context.accounts.aliceWallet.address)).to.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling via compliance', () => {
      it('should allow user', async () => {
        const context = await deployTransferRestrictFullSuite();

        const tx = await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function allowUser(address _userAddress)']).encodeFunctionData('allowUser', [
            context.accounts.aliceWallet.address,
          ]),
          context.suite.complianceModule,
        );

        await expect(tx)
          .to.emit(context.suite.complianceModule, 'UserAllowed')
          .withArgs(context.suite.compliance, context.accounts.aliceWallet.address);
      });
    });
  });

  describe('.batchAllowUsers', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployTransferRestrictFullSuite();

        await expect(
          context.suite.complianceModule.batchAllowUsers([context.accounts.aliceWallet.address]),
        ).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      it('should allow identities', async () => {
        const context = await deployTransferRestrictFullSuite();

        const tx = await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function batchAllowUsers(address[] _identities)']).encodeFunctionData(
            'batchAllowUsers',
            [[context.accounts.aliceWallet.address, context.accounts.bobWallet.address]],
          ),
          context.suite.complianceModule,
        );

        await expect(tx)
          .to.emit(context.suite.complianceModule, 'UserAllowed')
          .withArgs(context.suite.compliance, context.accounts.aliceWallet.address)
          .to.emit(context.suite.complianceModule, 'UserAllowed')
          .withArgs(context.suite.compliance, context.accounts.bobWallet.address);
      });
    });
  });

  describe('.disallowUser', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployTransferRestrictFullSuite();

        await expect(context.suite.complianceModule.disallowUser(context.accounts.aliceWallet.address)).to.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling via compliance', () => {
      it('should disallow user', async () => {
        const context = await deployTransferRestrictFullSuite();
        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function allowUser(address _userAddress)']).encodeFunctionData('allowUser', [
            context.accounts.aliceWallet.address,
          ]),
          context.suite.complianceModule,
        );

        const tx = await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function disallowUser(address _userAddress)']).encodeFunctionData('disallowUser', [
            context.accounts.aliceWallet.address,
          ]),
          context.suite.complianceModule,
        );

        await expect(tx)
          .to.emit(context.suite.complianceModule, 'UserDisallowed')
          .withArgs(context.suite.compliance, context.accounts.aliceWallet.address);
      });
    });
  });

  describe('.batchDisallowUsers', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployTransferRestrictFullSuite();

        await expect(
          context.suite.complianceModule.batchDisallowUsers([context.accounts.aliceWallet.address]),
        ).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      it('should disallow user', async () => {
        const context = await deployTransferRestrictFullSuite();
        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function batchAllowUsers(address[] _identities)']).encodeFunctionData(
            'batchAllowUsers',
            [[context.accounts.aliceWallet.address, context.accounts.bobWallet.address]],
          ),
          context.suite.complianceModule,
        );

        const tx = await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function batchDisallowUsers(address[] _identities)']).encodeFunctionData(
            'batchDisallowUsers',
            [[context.accounts.aliceWallet.address, context.accounts.bobWallet.address]],
          ),
          context.suite.complianceModule,
        );

        await expect(tx)
          .to.emit(context.suite.complianceModule, 'UserDisallowed')
          .withArgs(context.suite.compliance, context.accounts.aliceWallet.address)
          .to.emit(context.suite.complianceModule, 'UserDisallowed')
          .withArgs(context.suite.compliance, context.accounts.bobWallet.address);
      });
    });
  });

  describe('.isUserAllowed', () => {
    describe('when user is allowed', () => {
      it('should return true', async () => {
        const context = await deployTransferRestrictFullSuite();
        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function allowUser(address _userAddress)']).encodeFunctionData('allowUser', [
            context.accounts.aliceWallet.address,
          ]),
          context.suite.complianceModule,
        );

        const result = await context.suite.complianceModule.isUserAllowed(
          context.suite.compliance,
          context.accounts.aliceWallet.address,
        );
        expect(result).to.be.true;
      });
    });

    describe('when user is not allowed', () => {
      it('should return false', async () => {
        const context = await deployTransferRestrictFullSuite();
        const result = await context.suite.complianceModule.isUserAllowed(
          context.suite.compliance,
          context.accounts.aliceWallet.address,
        );
        expect(result).to.be.false;
      });
    });
  });

  describe('.moduleMintAction', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const context = await deployTransferRestrictFullSuite();

        await expect(
          context.suite.complianceModule.moduleMintAction(context.accounts.anotherWallet.address, 10),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const context = await deployTransferRestrictFullSuite();

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
        const context = await deployTransferRestrictFullSuite();

        await expect(
          context.suite.complianceModule.moduleBurnAction(context.accounts.anotherWallet.address, 10),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const context = await deployTransferRestrictFullSuite();

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

  describe('.moduleTransfer', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const context = await deployTransferRestrictFullSuite();

        await expect(
          context.suite.complianceModule.moduleTransferAction(
            context.accounts.aliceWallet.address,
            context.accounts.anotherWallet.address,
            10,
          ),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const context = await deployTransferRestrictFullSuite();

        await expect(
          context.suite.compliance.callModuleFunction(
            new ethers.Interface([
              'function moduleTransferAction(address _from, address _to, uint256 _value)',
            ]).encodeFunctionData('moduleTransferAction', [
              context.accounts.aliceWallet.address,
              context.accounts.anotherWallet.address,
              80,
            ]),
            context.suite.complianceModule,
          ),
        ).to.eventually.be.fulfilled;
      });
    });
  });
});
