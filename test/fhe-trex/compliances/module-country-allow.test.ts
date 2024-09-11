/* eslint-disable  @typescript-eslint/no-unused-expressions */

import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';

describe('CountryAllowModule', () => {
  async function deployComplianceWithCountryAllowModule() {
    const context = await deployComplianceFixture();
    const { compliance } = context.suite;

    const module = await ethers.deployContract('CountryAllowModule');
    const proxy = await ethers.deployContract('ModuleProxy', [
      module,
      module.interface.encodeFunctionData('initialize'),
    ]);
    const countryAllowModule = await ethers.getContractAt('CountryAllowModule', proxy);
    await compliance.addModule(countryAllowModule);

    return { ...context, suite: { ...context.suite, countryAllowModule } };
  }

  describe('.name()', () => {
    it('should return the name of the module', async () => {
      const {
        suite: { countryAllowModule },
      } = await deployComplianceWithCountryAllowModule();

      expect(await countryAllowModule.name()).to.be.equal('CountryAllowModule');
    });
  });

  describe('.isPlugAndPlay()', () => {
    it('should return true', async () => {
      const context = await deployComplianceWithCountryAllowModule();
      expect(await context.suite.countryAllowModule.isPlugAndPlay()).to.be.true;
    });
  });

  describe('.canComplianceBind()', () => {
    it('should return true', async () => {
      const context = await deployComplianceWithCountryAllowModule();
      expect(await context.suite.countryAllowModule.canComplianceBind(context.suite.compliance)).to.be.true;
    });
  });

  describe('.owner', () => {
    it('should return owner', async () => {
      const context = await deployComplianceWithCountryAllowModule();
      await expect(context.suite.countryAllowModule.owner()).to.eventually.be.eq(context.accounts.deployer.address);
    });
  });

  describe('.initialize', () => {
    it('should be called only once', async () => {
      // given
      const {
        accounts: { deployer },
      } = await deployComplianceFixture();
      const module = (await ethers.deployContract('CountryAllowModule')).connect(deployer);
      await module.initialize();

      // when & then
      await expect(module.initialize()).to.be.revertedWithCustomError(module, 'InvalidInitialization');
      expect(await module.owner()).to.be.eq(deployer.address);
    });
  });

  describe('.transferOwnership', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployComplianceWithCountryAllowModule();
        const conditionalModule = context.suite.countryAllowModule.connect(context.accounts.aliceWallet);
        await expect(
          conditionalModule.transferOwnership(context.accounts.bobWallet.address),
        ).to.revertedWithCustomError(conditionalModule, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when calling with owner account', () => {
      it('should transfer ownership', async () => {
        // given
        const context = await deployComplianceWithCountryAllowModule();

        // when
        await context.suite.countryAllowModule
          .connect(context.accounts.deployer)
          .transferOwnership(context.accounts.bobWallet.address);

        // then
        const owner = await context.suite.countryAllowModule.owner();
        expect(owner).to.eq(context.accounts.bobWallet.address);
      });
    });
  });

  describe('.upgradeTo', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await deployComplianceWithCountryAllowModule();
        await expect(
          context.suite.countryAllowModule
            .connect(context.accounts.aliceWallet)
            .upgradeToAndCall(ethers.ZeroAddress, '0x'),
        ).to.revertedWithCustomError(context.suite.countryAllowModule, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when calling with owner account', () => {
      it('should upgrade proxy', async () => {
        // given
        const {
          suite: { countryAllowModule, compliance },
          accounts: { deployer },
        } = await deployComplianceWithCountryAllowModule();

        await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function addAllowedCountry(uint16 country)']).encodeFunctionData(
              'addAllowedCountry',
              [42],
            ),
            countryAllowModule,
          );

        const newImplementation = await ethers.deployContract('TestUpgradedCountryAllowModule');

        // when
        await countryAllowModule.connect(deployer).upgradeToAndCall(newImplementation, '0x');

        // then
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(
          await countryAllowModule.getAddress(),
        );
        expect(implementationAddress).to.eq(newImplementation);

        const upgradedContract = await ethers.getContractAt('TestUpgradedCountryAllowModule', countryAllowModule);
        expect(await upgradedContract.getNewField()).to.be.eq(0);

        await upgradedContract.connect(deployer).setNewField(222);
        expect(await upgradedContract.getNewField()).to.be.eq(222);
        expect(await upgradedContract.isCountryAllowed(compliance, 42)).to.be.true;
      });
    });
  });

  describe('.batchAllowCountries()', () => {
    describe('when calling not via the Compliance contract', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.connect(anotherWallet).batchAllowCountries([42, 66])).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling as the owner', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.connect(deployer).batchAllowCountries([42, 66])).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling via the compliance contract', () => {
      it('should allow the given countries', async () => {
        const {
          suite: { compliance, countryAllowModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryAllowModule();

        const tx = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchAllowCountries(uint16[] calldata countries)']).encodeFunctionData(
              'batchAllowCountries',
              [[42, 66]],
            ),
            countryAllowModule,
          );

        await expect(tx).to.emit(countryAllowModule, 'CountryAllowed').withArgs(compliance, 42);
        await expect(tx).to.emit(countryAllowModule, 'CountryAllowed').withArgs(compliance, 66);

        expect(await countryAllowModule.isCountryAllowed(compliance, 42)).to.be.true;
        expect(await countryAllowModule.isCountryAllowed(compliance, 66)).to.be.true;
      });
    });
  });

  describe('.batchDisallowCountries()', () => {
    describe('when calling not via the Compliance contract', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.connect(anotherWallet).batchDisallowCountries([42, 66])).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling as the owner', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.connect(deployer).batchDisallowCountries([42, 66])).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling via the compliance contract', () => {
      it('should disallow the given countries', async () => {
        const {
          suite: { compliance, countryAllowModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryAllowModule();

        const tx = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchDisallowCountries(uint16[] calldata countries)']).encodeFunctionData(
              'batchDisallowCountries',
              [[42, 66]],
            ),
            countryAllowModule,
          );

        await expect(tx).to.emit(countryAllowModule, 'CountryUnallowed').withArgs(compliance, 42);
        await expect(tx).to.emit(countryAllowModule, 'CountryUnallowed').withArgs(compliance, 66);

        expect(await countryAllowModule.isCountryAllowed(compliance, 42)).to.be.false;
        expect(await countryAllowModule.isCountryAllowed(compliance, 66)).to.be.false;
      });
    });
  });

  describe('.addAllowedCountry()', () => {
    describe('when calling not via the Compliance contract', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.connect(anotherWallet).addAllowedCountry(42)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling as the owner', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.connect(deployer).addAllowedCountry(42)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling via the compliance contract', () => {
      describe('when country is already allowed', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryAllowModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryAllowModule();

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addAllowedCountry(uint16 country)']).encodeFunctionData(
                'addAllowedCountry',
                [42],
              ),
              countryAllowModule,
            );

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function addAllowedCountry(uint16 country)']).encodeFunctionData(
                  'addAllowedCountry',
                  [42],
                ),
                countryAllowModule,
              ),
          )
            .to.be.revertedWithCustomError(countryAllowModule, 'CountryAlreadyAllowed')
            .withArgs(compliance, 42);
        });
      });

      describe('when country is not allowed', () => {
        it('should allow the given country', async () => {
          const {
            suite: { compliance, countryAllowModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryAllowModule();

          const tx = await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addAllowedCountry(uint16 country)']).encodeFunctionData(
                'addAllowedCountry',
                [42],
              ),
              countryAllowModule,
            );

          await expect(tx).to.emit(countryAllowModule, 'CountryAllowed').withArgs(compliance, 42);

          expect(await countryAllowModule.isCountryAllowed(compliance, 42)).to.be.true;
        });
      });
    });
  });

  describe('.removeAllowedCountry()', () => {
    describe('when calling not via the Compliance contract', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.connect(anotherWallet).removeAllowedCountry(42)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling as the owner', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { deployer },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.connect(deployer).removeAllowedCountry(42)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling via the compliance contract', () => {
      describe('when country is not allowed', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryAllowModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryAllowModule();

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function removeAllowedCountry(uint16 country)']).encodeFunctionData(
                  'removeAllowedCountry',
                  [42],
                ),
                countryAllowModule,
              ),
          )
            .to.be.revertedWithCustomError(countryAllowModule, 'CountryNotAllowed')
            .withArgs(compliance, 42);
        });
      });

      describe('when country is allowed', () => {
        it('should disallow the given country', async () => {
          const {
            suite: { compliance, countryAllowModule },
            accounts: { deployer },
          } = await deployComplianceWithCountryAllowModule();

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addAllowedCountry(uint16 country)']).encodeFunctionData(
                'addAllowedCountry',
                [42],
              ),
              countryAllowModule,
            );

          const tx = await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function removeAllowedCountry(uint16 country)']).encodeFunctionData(
                'removeAllowedCountry',
                [42],
              ),
              countryAllowModule,
            );

          await expect(tx).to.emit(countryAllowModule, 'CountryUnallowed').withArgs(compliance, 42);

          expect(await countryAllowModule.isCountryAllowed(compliance, 42)).to.be.false;
        });
      });
    });
  });

  // Invalid in FHEVM
  // describe('.moduleCheck', () => {
  //   describe('when identity country is allowed', () => {
  //     it('should return true', async () => {
  //       const {
  //         suite: { compliance, countryAllowModule },
  //         accounts: { deployer, aliceWallet, bobWallet },
  //       } = await deployComplianceWithCountryAllowModule();
  //       const contract = await ethers.deployContract('MockContract');
  //       await compliance.bindToken(contract);

  //       await compliance
  //         .connect(deployer)
  //         .callModuleFunction(
  //           new ethers.Interface(['function batchAllowCountries(uint16[] calldata countries)']).encodeFunctionData(
  //             'batchAllowCountries',
  //             [[42, 66]],
  //           ),
  //           countryAllowModule,
  //         );

  //       await contract.setInvestorCountry(42);

  //       await expect(countryAllowModule.moduleCheck(aliceWallet.address, bobWallet.address, 10, compliance)).to.be
  //         .eventually.true;
  //       await expect(compliance.canTransfer(aliceWallet.address, bobWallet.address, 10)).to.be.eventually.true;
  //     });
  //   });

  //   describe('when identity country is not allowed', () => {
  //     it('should return false', async () => {
  //       const {
  //         suite: { compliance, countryAllowModule },
  //         accounts: { deployer, aliceWallet, bobWallet },
  //       } = await deployComplianceWithCountryAllowModule();
  //       const contract = await ethers.deployContract('MockContract');
  //       await compliance.bindToken(contract);

  //       await compliance
  //         .connect(deployer)
  //         .callModuleFunction(
  //           new ethers.Interface(['function batchAllowCountries(uint16[] calldata countries)']).encodeFunctionData(
  //             'batchAllowCountries',
  //             [[42, 66]],
  //           ),
  //           countryAllowModule,
  //         );

  //       await contract.setInvestorCountry(10);

  //       await expect(countryAllowModule.moduleCheck(aliceWallet.address, bobWallet.address, 16, compliance)).to.be
  //         .eventually.false;
  //       await expect(compliance.canTransfer(aliceWallet.address, bobWallet.address, 16)).to.be.eventually.false;
  //     });
  //   });
  // });

  describe('.isComplianceBound()', () => {
    describe('when the address is a bound compliance', () => {
      it('should return true', async () => {
        const {
          suite: { countryAllowModule, compliance },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.isComplianceBound(compliance)).to.be.eventually.true;
      });
    });

    describe('when the address is not a bound compliance', () => {
      it('should return false', async () => {
        const {
          suite: { countryAllowModule },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.isComplianceBound(countryAllowModule)).to.be.eventually.false;
      });
    });
  });

  describe('.unbindCompliance()', () => {
    describe('when sender is not a bound compliance', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule, compliance },
          accounts: { anotherWallet },
        } = await deployComplianceWithCountryAllowModule();

        await expect(countryAllowModule.connect(anotherWallet).unbindCompliance(compliance)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });
  });
});
