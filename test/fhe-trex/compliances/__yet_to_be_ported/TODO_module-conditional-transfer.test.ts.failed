import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';

describe('ConditionalTransferModule', () => {
  async function deployComplianceWithConditionalTransferModule() {
    const context = await deployComplianceFixture();
    const { compliance } = context.suite;

    const module = await ethers.deployContract('ConditionalTransferModule');
    const proxy = await ethers.deployContract('ModuleProxy', [
      module,
      module.interface.encodeFunctionData('initialize'),
    ]);
    const conditionalTransferModule = await ethers.getContractAt('ConditionalTransferModule', proxy);

    await compliance.addModule(conditionalTransferModule);

    const mockContract = await ethers.deployContract('MockContract');

    await compliance.bindToken(mockContract);

    return { ...context, suite: { ...context.suite, conditionalTransferModule, mockContract } };
  }

  describe('.name()', () => {
    it('should return the name of the module', async () => {
      const {
        suite: { conditionalTransferModule },
      } = await deployComplianceWithConditionalTransferModule();

      expect(await conditionalTransferModule.name()).to.be.equal('ConditionalTransferModule');
    });
  });

  describe('.isPlugAndPlay()', () => {
    it('should return true', async () => {
      const context = await deployComplianceWithConditionalTransferModule();
      expect(await context.suite.conditionalTransferModule.isPlugAndPlay()).to.be.true;
    });
  });

  describe('.canComplianceBind', () => {
    it('should return true', async () => {
      const context = await deployComplianceWithConditionalTransferModule();
      expect(await context.suite.conditionalTransferModule.canComplianceBind(context.suite.compliance)).to.be.true;
    });
  });

  describe('.owner', () => {
    it('should return owner', async () => {
      const context = await deployComplianceWithConditionalTransferModule();
      await expect(context.suite.conditionalTransferModule.owner()).to.eventually.be.eq(
        context.accounts.deployer.address,
      );
    });
  });

  describe('.initialize', () => {
    it('should be called only once', async () => {
      // given
      const {
        accounts: { deployer },
      } = await deployComplianceFixture();
      const module = (await ethers.deployContract('ConditionalTransferModule')).connect(deployer);
      await module.initialize();

      // when & then
      await expect(module.initialize()).to.be.revertedWithCustomError(module, 'InvalidInitialization');
      expect(await module.owner()).to.be.eq(deployer.address);
    });
  });

  describe('.transferOwnership', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployComplianceWithConditionalTransferModule();
        const conditionalTransferModule = context.suite.conditionalTransferModule.connect(context.accounts.aliceWallet);
        await expect(
          conditionalTransferModule.transferOwnership(context.accounts.bobWallet.address),
        ).to.revertedWithCustomError(conditionalTransferModule, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when calling with owner account', () => {
      it('should transfer ownership', async () => {
        // given
        const context = await deployComplianceWithConditionalTransferModule();

        // when
        await context.suite.conditionalTransferModule
          .connect(context.accounts.deployer)
          .transferOwnership(context.accounts.bobWallet.address);

        // then
        const owner = await context.suite.conditionalTransferModule.owner();
        expect(owner).to.eq(context.accounts.bobWallet.address);
      });
    });
  });

  describe('.upgradeTo', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployComplianceWithConditionalTransferModule();
        const conditionalTransferModule = context.suite.conditionalTransferModule.connect(context.accounts.aliceWallet);
        await expect(conditionalTransferModule.upgradeToAndCall(ethers.ZeroAddress, '0x')).to.revertedWithCustomError(
          conditionalTransferModule,
          'OwnableUnauthorizedAccount',
        );
      });
    });

    describe('when calling with owner account', () => {
      it('should upgrade proxy', async () => {
        // given
        const context = await deployComplianceWithConditionalTransferModule();
        const newImplementation = await ethers.deployContract('ConditionalTransferModule');

        // when
        await context.suite.conditionalTransferModule
          .connect(context.accounts.deployer)
          .upgradeToAndCall(newImplementation, '0x');

        // then
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(
          await context.suite.conditionalTransferModule.getAddress(),
        );
        expect(implementationAddress).to.eq(newImplementation);
      });
    });
  });

  describe('FAIL .batchApproveTransfers', () => {
    describe('when the sender is not the compliance', () => {
      it('should revert', async () => {
        const {
          suite: { conditionalTransferModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await expect(
          conditionalTransferModule
            .connect(anotherWallet)
            .batchApproveTransfers([anotherWallet.address], [anotherWallet.address], [10]),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when the sender is the compliance', () => {
      it('should approve the transfers', async () => {
        const {
          suite: { compliance, conditionalTransferModule, mockContract },
          accounts: { deployer, aliceWallet, bobWallet },
        } = await deployComplianceWithConditionalTransferModule();

        const tx = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface([
              'function batchApproveTransfers(address[], address[], uint256[])',
            ]).encodeFunctionData('batchApproveTransfers', [[aliceWallet.address], [bobWallet.address], [10]]),
            conditionalTransferModule,
          );

        await expect(tx)
          .to.emit(conditionalTransferModule, 'TransferApproved')
          .withArgs(aliceWallet.address, bobWallet.address, 10, mockContract);

        expect(
          await conditionalTransferModule.isTransferApproved(
            compliance,
            await conditionalTransferModule.calculateTransferHash(
              aliceWallet.address,
              bobWallet.address,
              10,
              mockContract,
            ),
          ),
        ).to.be.true;

        await expect(
          conditionalTransferModule.getTransferApprovals(
            compliance,
            await conditionalTransferModule.calculateTransferHash(
              aliceWallet.address,
              bobWallet.address,
              10,
              mockContract,
            ),
          ),
        ).to.eventually.be.equal(1);
      });
    });
  });

  describe('FAIL .batchUnApproveTransfers()', () => {
    describe('when the sender is not the compliance', () => {
      it('should revert', async () => {
        const {
          suite: { conditionalTransferModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await expect(
          conditionalTransferModule
            .connect(anotherWallet)
            .batchUnApproveTransfers([anotherWallet.address], [anotherWallet.address], [10]),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when the sender is the compliance', () => {
      describe('when the transfer is not approved', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, conditionalTransferModule },
            accounts: { deployer, aliceWallet, bobWallet },
          } = await deployComplianceWithConditionalTransferModule();

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface([
                  'function batchUnApproveTransfers(address[], address[], uint256[])',
                ]).encodeFunctionData('batchUnApproveTransfers', [[aliceWallet.address], [bobWallet.address], [10]]),
                conditionalTransferModule,
              ),
          ).to.be.revertedWith('not approved');
        });
      });

      it('should unapprove the transfers', async () => {
        const {
          suite: { compliance, conditionalTransferModule, mockContract },
          accounts: { deployer, aliceWallet, bobWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface([
              'function batchApproveTransfers(address[], address[], uint256[])',
            ]).encodeFunctionData('batchApproveTransfers', [[aliceWallet.address], [bobWallet.address], [10]]),
            conditionalTransferModule,
          );

        const tx = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface([
              'function batchUnApproveTransfers(address[], address[], uint256[])',
            ]).encodeFunctionData('batchUnApproveTransfers', [[aliceWallet.address], [bobWallet.address], [10]]),
            conditionalTransferModule,
          );

        await expect(tx)
          .to.emit(conditionalTransferModule, 'ApprovalRemoved')
          .withArgs(aliceWallet.address, bobWallet.address, 10, mockContract);

        expect(
          await conditionalTransferModule.isTransferApproved(
            compliance,
            await conditionalTransferModule.calculateTransferHash(
              aliceWallet.address,
              bobWallet.address,
              10,
              mockContract,
            ),
          ),
        ).to.be.false;
      });
    });
  });

  describe('FAIL .approveTransfer()', () => {
    describe('when the sender is not the compliance', () => {
      it('should revert', async () => {
        const {
          suite: { conditionalTransferModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await expect(
          conditionalTransferModule
            .connect(anotherWallet)
            .approveTransfer(anotherWallet.address, anotherWallet.address, 10),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });
  });

  describe('FAIL .unApproveTransfer()', () => {
    describe('when the sender is not the compliance', () => {
      it('should revert', async () => {
        const {
          suite: { conditionalTransferModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await expect(
          conditionalTransferModule
            .connect(anotherWallet)
            .unApproveTransfer(anotherWallet.address, anotherWallet.address, 10),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });
  });

  describe('.moduleCheck()', () => {
    describe('when transfer is not approved', () => {
      it('should return false', async () => {
        const {
          suite: { compliance, conditionalTransferModule },
          accounts: { aliceWallet, bobWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await expect(conditionalTransferModule.moduleCheck(aliceWallet.address, bobWallet.address, 10, compliance)).to
          .eventually.be.false;
      });
    });

    describe('when transfer is approved', () => {
      it('should return true', async () => {
        const {
          suite: { compliance, conditionalTransferModule },
          accounts: { deployer, aliceWallet, bobWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface([
              'function batchApproveTransfers(address[], address[], uint256[])',
            ]).encodeFunctionData('batchApproveTransfers', [[aliceWallet.address], [bobWallet.address], [10]]),
            conditionalTransferModule,
          );

        await expect(conditionalTransferModule.moduleCheck(aliceWallet.address, bobWallet.address, 10, compliance)).to
          .eventually.be.true;
      });
    });
  });

  describe('.moduleBurnAction', () => {
    describe('when called by a random wallet', () => {
      it('should revert', async () => {
        const {
          suite: { conditionalTransferModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await expect(conditionalTransferModule.moduleBurnAction(anotherWallet.address, 10)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when called by the compliance', () => {
      it('should do nothing', async () => {
        const {
          suite: { conditionalTransferModule, compliance },
          accounts: { deployer, anotherWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await expect(
          compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function moduleBurnAction(address, uint256)']).encodeFunctionData(
                'moduleBurnAction',
                [anotherWallet.address, 10],
              ),
              conditionalTransferModule,
            ),
        ).to.eventually.be.fulfilled;
      });
    });
  });

  describe('.moduleMintAction', () => {
    describe('when called by a random wallet', () => {
      it('should revert', async () => {
        const {
          suite: { conditionalTransferModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await expect(conditionalTransferModule.moduleMintAction(anotherWallet.address, 10)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when called by the compliance', () => {
      it('should do nothing', async () => {
        const {
          suite: { conditionalTransferModule, compliance },
          accounts: { deployer, anotherWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await expect(
          compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function moduleMintAction(address, uint256)']).encodeFunctionData(
                'moduleMintAction',
                [anotherWallet.address, 10],
              ),
              conditionalTransferModule,
            ),
        ).to.eventually.be.fulfilled;
      });
    });
  });

  describe('.moduleTransferAction()', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const {
          suite: { conditionalTransferModule },
          accounts: { anotherWallet, aliceWallet, bobWallet },
        } = await deployComplianceWithConditionalTransferModule();

        await expect(
          conditionalTransferModule
            .connect(anotherWallet)
            .moduleTransferAction(aliceWallet.address, bobWallet.address, 10),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the compliance', () => {
      describe('when the transfer is not approved', () => {
        it('should do nothing', async () => {
          const {
            suite: { compliance, conditionalTransferModule },
            accounts: { deployer, aliceWallet, bobWallet },
          } = await deployComplianceWithConditionalTransferModule();

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function moduleTransferAction(address, address, uint256)']).encodeFunctionData(
                  'moduleTransferAction',
                  [aliceWallet.address, bobWallet.address, 10],
                ),
                conditionalTransferModule,
              ),
          ).to.eventually.be.fulfilled;
        });
      });

      describe('when the transfer is approved', () => {
        it('should remove the transfer approval', async () => {
          const {
            suite: { compliance, conditionalTransferModule, mockContract },
            accounts: { deployer, aliceWallet, bobWallet },
          } = await deployComplianceWithConditionalTransferModule();

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface([
                'function batchApproveTransfers(address[], address[], uint256[])',
              ]).encodeFunctionData('batchApproveTransfers', [[aliceWallet.address], [bobWallet.address], [10]]),
              conditionalTransferModule,
            );

          const tx = await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function moduleTransferAction(address, address, uint256)']).encodeFunctionData(
                  'moduleTransferAction',
                  [aliceWallet.address, bobWallet.address, 10],
                ),
                conditionalTransferModule,
              ),
          ).to.eventually.be.fulfilled;

          await expect(tx)
            .to.emit(conditionalTransferModule, 'ApprovalRemoved')
            .withArgs(aliceWallet.address, bobWallet.address, 10, mockContract);

          expect(
            await conditionalTransferModule.isTransferApproved(
              compliance,
              await conditionalTransferModule.calculateTransferHash(
                aliceWallet.address,
                bobWallet.address,
                10,
                mockContract,
              ),
            ),
          ).to.be.false;
        });
      });
    });
  });
});
