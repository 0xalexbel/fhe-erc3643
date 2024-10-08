/* eslint-disable  @typescript-eslint/no-unused-expressions */

import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';

describe('CountryRestrictModule', () => {
  async function deployComplianceWithCountryRestrictModule() {
    const context = await deployComplianceFixture();
    const { compliance } = context.suite;

    const module = await ethers.deployContract('CountryRestrictModule');
    const proxy = await ethers.deployContract('ModuleProxy', [
      module,
      module.interface.encodeFunctionData('initialize'),
    ]);
    const countryRestrictModule = await ethers.getContractAt('CountryRestrictModule', proxy);
    await compliance.addModule(countryRestrictModule);
    return { ...context, suite: { ...context.suite, countryRestrictModule } };
  }

  describe('.name()', () => {
    it('should return the name of the module', async () => {
      const {
        suite: { countryRestrictModule },
      } = await deployComplianceWithCountryRestrictModule();

      expect(await countryRestrictModule.name()).to.equal('CountryRestrictModule');
    });
  });

  describe('.isPlugAndPlay()', () => {
    it('should return true', async () => {
      const context = await deployComplianceWithCountryRestrictModule();
      expect(await context.suite.countryRestrictModule.isPlugAndPlay()).to.be.true;
    });
  });

  describe('.canComplianceBind()', () => {
    it('should return true', async () => {
      const context = await deployComplianceWithCountryRestrictModule();
      expect(await context.suite.countryRestrictModule.canComplianceBind(context.suite.compliance)).to.be.true;
    });
  });

  describe('.owner', () => {
    it('should return owner', async () => {
      const context = await deployComplianceWithCountryRestrictModule();
      await expect(context.suite.countryRestrictModule.owner()).to.eventually.be.eq(context.accounts.deployer.address);
    });
  });

  describe('.initialize', () => {
    it('should be called only once', async () => {
      // given
      const {
        accounts: { deployer },
      } = await deployComplianceFixture();
      const module = (await ethers.deployContract('CountryRestrictModule')).connect(deployer);
      await module.initialize();

      // when & then
      await expect(module.initialize()).to.be.revertedWithCustomError(module, 'InvalidInitialization');
      expect(await module.owner()).to.be.eq(deployer.address);
    });
  });

  describe('.transferOwnership', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployComplianceWithCountryRestrictModule();
        await expect(
          context.suite.countryRestrictModule
            .connect(context.accounts.aliceWallet)
            .transferOwnership(context.accounts.bobWallet.address),
        ).to.revertedWithCustomError(context.suite.countryRestrictModule, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when calling with owner account', () => {
      it('should transfer ownership', async () => {
        // given
        const context = await deployComplianceWithCountryRestrictModule();

        // when
        await context.suite.countryRestrictModule
          .connect(context.accounts.deployer)
          .transferOwnership(context.accounts.bobWallet.address);

        // then
        const owner = await context.suite.countryRestrictModule.owner();
        expect(owner).to.eq(context.accounts.bobWallet.address);
      });
    });
  });

  describe('.upgradeTo', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployComplianceWithCountryRestrictModule();
        await expect(
          context.suite.countryRestrictModule
            .connect(context.accounts.aliceWallet)
            .upgradeToAndCall(ethers.ZeroAddress, '0x'),
        ).to.revertedWithCustomError(context.suite.countryRestrictModule, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when calling with owner account', () => {
      it('should upgrade proxy', async () => {
        // given
        const context = await deployComplianceWithCountryRestrictModule();
        const newImplementation = await ethers.deployContract('CountryRestrictModule');

        // when
        await context.suite.countryRestrictModule
          .connect(context.accounts.deployer)
          .upgradeToAndCall(newImplementation, '0x');

        // then
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(
          await context.suite.countryRestrictModule.getAddress(),
        );
        expect(implementationAddress).to.eq(newImplementation);
      });
    });
  });

  describe('.addCountryRestriction()', () => {
    describe('when the sender is a random wallet', () => {
      it('should reverts', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(countryRestrictModule.connect(anotherWallet).addCountryRestriction(42)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when the sender is the deployer', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(countryRestrictModule.connect(deployer).addCountryRestriction(42)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when called via the compliance', () => {
      describe('when country is already restricted', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryRestrictModule();

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addCountryRestriction(uint16 country)']).encodeFunctionData(
                'addCountryRestriction',
                [42],
              ),
              countryRestrictModule,
            );

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function addCountryRestriction(uint16 country)']).encodeFunctionData(
                  'addCountryRestriction',
                  [42],
                ),
                countryRestrictModule,
              ),
          ).to.be.revertedWith('country already restricted');
        });
      });

      describe('when country is not restricted', () => {
        it('should add the country restriction', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryRestrictModule();

          const tx = await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addCountryRestriction(uint16 country)']).encodeFunctionData(
                'addCountryRestriction',
                [42],
              ),
              countryRestrictModule,
            );

          await expect(tx).to.emit(countryRestrictModule, 'AddedRestrictedCountry').withArgs(compliance, 42);

          expect(await countryRestrictModule.isCountryRestricted(compliance, 42)).to.be.true;
        });
      });
    });
  });

  describe('.removeCountryRestriction()', () => {
    describe('when the sender is a random wallet', () => {
      it('should reverts', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(countryRestrictModule.connect(anotherWallet).removeCountryRestriction(42)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when the sender is the deployer', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(countryRestrictModule.connect(deployer).removeCountryRestriction(42)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when called via the compliance', () => {
      describe('when country is not restricted', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryRestrictModule();

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function removeCountryRestriction(uint16 country)']).encodeFunctionData(
                  'removeCountryRestriction',
                  [42],
                ),
                countryRestrictModule,
              ),
          ).to.be.revertedWith('country not restricted');
        });
      });

      describe('when country is restricted', () => {
        it('should remove the country restriction', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryRestrictModule();

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addCountryRestriction(uint16 country)']).encodeFunctionData(
                'addCountryRestriction',
                [42],
              ),
              countryRestrictModule,
            );

          const tx = await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function removeCountryRestriction(uint16 country)']).encodeFunctionData(
                'removeCountryRestriction',
                [42],
              ),
              countryRestrictModule,
            );

          await expect(tx).to.emit(countryRestrictModule, 'RemovedRestrictedCountry').withArgs(compliance, 42);

          expect(await countryRestrictModule.isCountryRestricted(compliance, 42)).to.be.false;
        });
      });
    });
  });

  describe('.batchRestrictCountries()', () => {
    describe('when the sender is a random wallet', () => {
      it('should reverts', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(countryRestrictModule.connect(anotherWallet).batchRestrictCountries([42])).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when the sender is the deployer', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(countryRestrictModule.connect(deployer).batchRestrictCountries([42])).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when called via the compliance', () => {
      describe('when attempting to restrict more than 195 countries at once', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryRestrictModule();

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function batchRestrictCountries(uint16[] memory countries)']).encodeFunctionData(
                  'batchRestrictCountries',
                  [Array.from({ length: 195 }, (_, i) => i)],
                ),
                countryRestrictModule,
              ),
          ).to.be.revertedWith('maximum 195 can be restricted in one batch');
        });
      });

      describe('when a country is already restricted', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryRestrictModule();

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addCountryRestriction(uint16 country)']).encodeFunctionData(
                'addCountryRestriction',
                [42],
              ),
              countryRestrictModule,
            );

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function batchRestrictCountries(uint16[] memory countries)']).encodeFunctionData(
                  'batchRestrictCountries',
                  [[12, 42, 67]],
                ),
                countryRestrictModule,
              ),
          ).to.be.revertedWith('country already restricted');
        });
      });

      it('should add the country restriction', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryRestrictModule();

        const tx = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchRestrictCountries(uint16[] memory countries)']).encodeFunctionData(
              'batchRestrictCountries',
              [[42, 66]],
            ),
            countryRestrictModule,
          );

        await expect(tx).to.emit(countryRestrictModule, 'AddedRestrictedCountry').withArgs(compliance, 42);
        await expect(tx).to.emit(countryRestrictModule, 'AddedRestrictedCountry').withArgs(compliance, 66);

        expect(await countryRestrictModule.isCountryRestricted(compliance, 42)).to.be.true;
        expect(await countryRestrictModule.isCountryRestricted(compliance, 66)).to.be.true;
      });
    });
  });

  describe('.batchUnrestrictCountries()', () => {
    describe('when the sender is a random wallet', () => {
      it('should reverts', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(countryRestrictModule.connect(anotherWallet).batchUnrestrictCountries([42])).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when the sender is the deployer', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(countryRestrictModule.connect(deployer).batchUnrestrictCountries([42])).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when called via the compliance', () => {
      describe('when attempting to unrestrict more than 195 countries at once', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryRestrictModule();

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface([
                  'function batchUnrestrictCountries(uint16[] memory countries)',
                ]).encodeFunctionData('batchUnrestrictCountries', [Array.from({ length: 195 }, (_, i) => i)]),
                countryRestrictModule,
              ),
          ).to.be.revertedWith('maximum 195 can be unrestricted in one batch');
        });
      });

      describe('when a country is not restricted', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryRestrictModule();

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface([
                  'function batchUnrestrictCountries(uint16[] memory countries)',
                ]).encodeFunctionData('batchUnrestrictCountries', [[12, 42, 67]]),
                countryRestrictModule,
              ),
          ).to.be.revertedWith('country not restricted');
        });
      });

      it('should remove the country restriction', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryRestrictModule();

        await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchRestrictCountries(uint16[] memory countries)']).encodeFunctionData(
              'batchRestrictCountries',
              [[42, 66]],
            ),
            countryRestrictModule,
          );

        const tx = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchUnrestrictCountries(uint16[] memory countries)']).encodeFunctionData(
              'batchUnrestrictCountries',
              [[42, 66]],
            ),
            countryRestrictModule,
          );

        await expect(tx).to.emit(countryRestrictModule, 'RemovedRestrictedCountry').withArgs(compliance, 42);
        await expect(tx).to.emit(countryRestrictModule, 'RemovedRestrictedCountry').withArgs(compliance, 66);

        expect(await countryRestrictModule.isCountryRestricted(compliance, 42)).to.be.false;
        expect(await countryRestrictModule.isCountryRestricted(compliance, 66)).to.be.false;
      });
    });
  });

  describe('.moduleTransferAction()', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet, aliceWallet, bobWallet },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(
          countryRestrictModule.connect(anotherWallet).moduleTransferAction(aliceWallet.address, bobWallet.address, 10),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer, aliceWallet, bobWallet },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(
          compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function moduleTransferAction(address, address, uint256)']).encodeFunctionData(
                'moduleTransferAction',
                [aliceWallet.address, bobWallet.address, 10],
              ),
              countryRestrictModule,
            ),
        ).to.eventually.be.fulfilled;
      });
    });
  });

  describe('.moduleMintAction()', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(
          countryRestrictModule.connect(anotherWallet).moduleMintAction(anotherWallet.address, 10),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer, anotherWallet },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(
          compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function moduleMintAction(address, uint256)']).encodeFunctionData(
                'moduleMintAction',
                [anotherWallet.address, 10],
              ),
              countryRestrictModule,
            ),
        ).to.eventually.be.fulfilled;
      });
    });
  });

  describe('.moduleBurnAction()', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(
          countryRestrictModule.connect(anotherWallet).moduleBurnAction(anotherWallet.address, 10),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer, anotherWallet },
        } = await deployComplianceWithCountryRestrictModule();

        await expect(
          compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function moduleBurnAction(address, uint256)']).encodeFunctionData(
                'moduleBurnAction',
                [anotherWallet.address, 10],
              ),
              countryRestrictModule,
            ),
        ).to.eventually.be.fulfilled;
      });
    });
  });

  // Must write another test in FHEVM
  // describe('.moduleCheck', () => {
  //   describe('when identity country is restricted', () => {
  //     it('should return false', async () => {
  //       const {
  //         suite: { compliance, countryRestrictModule },
  //         accounts: { deployer, aliceWallet, bobWallet },
  //       } = await deployComplianceWithCountryRestrictModule();
  //       const contract = await ethers.deployContract('MockContract');
  //       await compliance.bindToken(contract);

  //       await compliance
  //         .connect(deployer)
  //         .callModuleFunction(
  //           new ethers.Interface(['function batchRestrictCountries(uint16[] calldata countries)']).encodeFunctionData(
  //             'batchRestrictCountries',
  //             [[42, 66]],
  //           ),
  //           countryRestrictModule,
  //         );

  //       await contract.setInvestorCountry(42);

  //       await expect(countryRestrictModule.moduleCheck(aliceWallet.address, bobWallet.address, 16, compliance)).to.be
  //         .eventually.false;
  //     });
  //   });

  //   describe('when identity country is not restricted', () => {
  //     it('should return true', async () => {
  //       const {
  //         suite: { compliance, countryRestrictModule },
  //         accounts: { deployer, aliceWallet, bobWallet },
  //       } = await deployComplianceWithCountryRestrictModule();
  //       const contract = await ethers.deployContract('MockContract');
  //       await compliance.bindToken(contract);

  //       await compliance
  //         .connect(deployer)
  //         .callModuleFunction(
  //           new ethers.Interface(['function batchRestrictCountries(uint16[] calldata countries)']).encodeFunctionData(
  //             'batchRestrictCountries',
  //             [[42, 66]],
  //           ),
  //           countryRestrictModule,
  //         );

  //       await contract.setInvestorCountry(10);

  //       await expect(countryRestrictModule.moduleCheck(aliceWallet.address, bobWallet.address, 16, compliance)).to.be
  //         .eventually.true;
  //     });
  //   });
  // });
});
