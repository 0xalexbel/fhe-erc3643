import hre from 'hardhat';
import { expect } from 'chai';
import {
  deployFullSuiteFixture,
  deploySuiteWithModularCompliancesFixture,
  deploySuiteWithModuleComplianceBoundToWallet,
} from './fixtures/deploy-full-suite.fixture';
import { encrypt64, tokenBurn } from '../utils';

describe('ModularCompliance', () => {
  describe('.init', () => {
    it('should prevent calling init twice', async () => {
      const {
        suite: { compliance },
      } = await deploySuiteWithModularCompliancesFixture();

      await expect(compliance.init()).to.be.revertedWithCustomError(compliance, 'InvalidInitialization');
    });
  });

  describe('.bindToken', () => {
    describe('when calling as another account that the owner', () => {
      it('should revert', async () => {
        const {
          accounts: { anotherWallet },
          suite: { token, compliance },
        } = await deploySuiteWithModularCompliancesFixture();

        await expect(compliance.connect(anotherWallet).bindToken(token)).to.be.revertedWith(
          'only owner or token can call',
        );
      });
    });

    describe('when the compliance is already bound to a token', () => {
      describe('when not calling as the token', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer, anotherWallet },
            suite: { token },
          } = await deployFullSuiteFixture();

          const compliance = await hre.ethers.deployContract('ModularCompliance', deployer);
          await compliance.init();

          await compliance.bindToken(token);

          await expect(compliance.connect(anotherWallet).bindToken(token)).to.be.revertedWith(
            'only owner or token can call',
          );
        });
      });

      describe('when calling as the token', () => {
        it('should set the new compliance', async () => {
          const {
            suite: { token },
          } = await deployFullSuiteFixture();

          const compliance = await hre.ethers.deployContract('ModularCompliance');
          await compliance.init();
          await compliance.bindToken(token);

          const newCompliance = await hre.ethers.deployContract('ModularCompliance');

          const tx = await token.setCompliance(newCompliance);
          await expect(tx).to.emit(token, 'ComplianceAdded').withArgs(newCompliance);
          await expect(tx).to.emit(newCompliance, 'TokenBound').withArgs(token);
        });
      });
    });

    describe('when calling as the owner', () => {
      describe('when token address is zero', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
          } = await deployFullSuiteFixture();

          const compliance = await hre.ethers.deployContract('ModularCompliance', deployer);
          await compliance.init();

          await expect(compliance.bindToken(hre.ethers.ZeroAddress)).to.be.revertedWith(
            'invalid argument - zero address',
          );
        });
      });
    });
  });

  describe('.unbindToken', () => {
    describe('when calling as another account', () => {
      it('should revert', async () => {
        const {
          accounts: { anotherWallet },
          suite: { token, compliance },
        } = await deploySuiteWithModularCompliancesFixture();

        await expect(compliance.connect(anotherWallet).unbindToken(token)).to.be.revertedWith(
          'only owner or token can call',
        );
      });
    });

    describe('when calling as the owner', () => {
      describe('when token is a zero address', () => {
        it('should revert', async () => {
          const {
            suite: { compliance },
          } = await deploySuiteWithModularCompliancesFixture();

          await expect(compliance.unbindToken(hre.ethers.ZeroAddress)).to.be.revertedWith(
            'invalid argument - zero address',
          );
        });
      });

      describe('when token is not bound', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            suite: { token },
          } = await deployFullSuiteFixture();

          const compliance = await hre.ethers.deployContract('ModularCompliance', deployer);
          await compliance.init();

          await expect(compliance.unbindToken(token)).to.be.revertedWith('This token is not bound');
        });
      });
    });

    describe('when calling as the token given in parameters', () => {
      it('should bind the new compliance to the token', async () => {
        const {
          suite: { compliance, complianceBeta, token },
        } = await deploySuiteWithModularCompliancesFixture();

        await token.setCompliance(compliance);

        const tx = await token.setCompliance(complianceBeta);
        await expect(tx).to.emit(token, 'ComplianceAdded').withArgs(complianceBeta);
        await expect(tx).to.emit(complianceBeta, 'TokenBound').withArgs(token);
        await expect(tx).to.emit(compliance, 'TokenUnbound').withArgs(token);

        await expect(complianceBeta.getTokenBound()).to.eventually.eq(token);
      });
    });
  });

  describe('.addModule', () => {
    describe('when not calling as the owner', () => {
      it('should revert', async () => {
        const {
          accounts: { anotherWallet },
          suite: { compliance },
        } = await deploySuiteWithModularCompliancesFixture();

        await expect(compliance.connect(anotherWallet).addModule(hre.ethers.ZeroAddress)).to.be.revertedWithCustomError(
          compliance,
          'OwnableUnauthorizedAccount',
        );
      });
    });

    describe('when calling as the owner', () => {
      describe('when module address is zero', () => {
        it('should revert', async () => {
          const {
            suite: { compliance },
          } = await deploySuiteWithModularCompliancesFixture();

          await expect(compliance.addModule(hre.ethers.ZeroAddress)).to.be.revertedWith(
            'invalid argument - zero address',
          );
        });
      });

      describe('when module address is already bound', () => {
        it('should revert', async () => {
          const {
            suite: { compliance },
          } = await deploySuiteWithModularCompliancesFixture();

          const module = await hre.ethers.deployContract('CountryAllowModule');
          await compliance.addModule(module);

          await expect(compliance.addModule(module)).to.be.revertedWith('module already bound');
        });
      });

      describe('when module is not plug & play', () => {
        describe('when compliance is not suitable for binding to the module', () => {
          it('should revert', async () => {
            const {
              accounts,
              suite: { compliance, token },
            } = await deploySuiteWithModularCompliancesFixture();
            await compliance.connect(accounts.deployer).bindToken(token);

            const module = await hre.ethers.deployContract('MaxBalanceModule');
            await expect(compliance.addModule(module)).to.be.revertedWith(
              'compliance is not suitable for binding to the module',
            );
          });
        });

        describe('when compliance is suitable for binding to the module', () => {
          it('should revert', async () => {
            const {
              accounts,
              suite: { compliance, token },
            } = await deploySuiteWithModularCompliancesFixture();

            await compliance.connect(accounts.deployer).bindToken(token);

            const module = await hre.ethers.deployContract('TransferFeesModule');
            // TransferFeesModule must be a token agent to be suitable for binding
            await token.connect(accounts.deployer).addAgent(module);
            const tx = await compliance.addModule(module);

            await expect(tx).to.emit(compliance, 'ModuleAdded').withArgs(module);
            await expect(compliance.getModules()).to.eventually.deep.eq([module.target]);
          });
        });
      });

      describe('when module is plug & play', () => {
        it('should add the module', async () => {
          const {
            suite: { compliance },
          } = await deploySuiteWithModularCompliancesFixture();

          const module = await hre.ethers.deployContract('CountryAllowModule');
          const tx = await compliance.addModule(module);

          await expect(tx).to.emit(compliance, 'ModuleAdded').withArgs(module);
          await expect(compliance.getModules()).to.eventually.deep.eq([module.target]);
        });
      });

      describe('when attempting to bind a 25th module', () => {
        it('should revert', async () => {
          const {
            suite: { compliance },
          } = await deploySuiteWithModularCompliancesFixture();

          const modules = await Promise.all(
            Array.from({ length: 25 }, () => hre.ethers.deployContract('CountryAllowModule')),
          );

          await Promise.all(modules.map(module => compliance.addModule(module)));

          const module = await hre.ethers.deployContract('CountryAllowModule');

          await expect(compliance.addModule(module)).to.be.revertedWith('cannot add more than 25 modules');
        });
      });
    });
  });

  describe('.removeModule', () => {
    describe('when not calling as owner', () => {
      it('should revert', async () => {
        const {
          accounts: { anotherWallet },
          suite: { compliance },
        } = await deploySuiteWithModularCompliancesFixture();

        await expect(
          compliance.connect(anotherWallet).removeModule(hre.ethers.ZeroAddress),
        ).to.be.revertedWithCustomError(compliance, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when calling as the owner', () => {
      describe('when module address is zero', () => {
        it('should revert', async () => {
          const {
            suite: { compliance },
          } = await deploySuiteWithModularCompliancesFixture();

          await expect(compliance.removeModule(hre.ethers.ZeroAddress)).to.be.revertedWith(
            'invalid argument - zero address',
          );
        });
      });

      describe('when module address is not bound', () => {
        it('should revert', async () => {
          const {
            suite: { compliance },
          } = await deploySuiteWithModularCompliancesFixture();

          const module = await hre.ethers.deployContract('CountryAllowModule');

          await expect(compliance.removeModule(module)).to.be.revertedWith('module not bound');
        });
      });

      describe('when module is bound', () => {
        it('should remove the module', async () => {
          const {
            suite: { compliance },
          } = await deploySuiteWithModularCompliancesFixture();

          const module = await hre.ethers.deployContract('CountryAllowModule');
          await compliance.addModule(module);

          const moduleB = await hre.ethers.deployContract('CountryAllowModule');
          await compliance.addModule(moduleB);

          const tx = await compliance.removeModule(moduleB);

          await expect(tx).to.emit(compliance, 'ModuleRemoved').withArgs(moduleB);

          await expect(compliance.isModuleBound(moduleB)).to.be.eventually.false;
        });
      });
    });
  });

  describe('.transferred', () => {
    describe('when not calling as a bound token', () => {
      it('should revert', async () => {
        const {
          accounts: { anotherWallet },
          suite: { compliance },
        } = await deploySuiteWithModularCompliancesFixture();

        await expect(
          compliance
            .connect(anotherWallet)
            ['transferred(address,address,uint256)'](hre.ethers.ZeroAddress, hre.ethers.ZeroAddress, 0),
        ).to.be.revertedWith('error : this address is not a token bound to the compliance contract');
      });
    });

    describe('when calling as a bound token', () => {
      describe('when from address is null', () => {
        it('should revert', async () => {
          const {
            suite: { compliance },
            accounts: { bobWallet, charlieWallet },
          } = await deploySuiteWithModuleComplianceBoundToWallet();

          await expect(
            compliance
              .connect(charlieWallet)
              ['transferred(address,address,uint256)'](hre.ethers.ZeroAddress, bobWallet.address, 10),
          ).to.be.revertedWith('invalid argument - zero address');
        });
      });

      describe('when to address is null', () => {
        it('should revert', async () => {
          const {
            suite: { compliance },
            accounts: { charlieWallet, aliceWallet },
          } = await deploySuiteWithModuleComplianceBoundToWallet();

          await expect(
            compliance
              .connect(charlieWallet)
              ['transferred(address,address,uint256)'](aliceWallet.address, hre.ethers.ZeroAddress, 10),
          ).to.be.revertedWith('invalid argument - zero address');
        });
      });

      // Not supported in FHEVM
      // describe('when amount is zero', () => {
      //   it('should revert', async () => {
      //     const {
      //       suite: { compliance },
      //       accounts: { aliceWallet, bobWallet, charlieWallet },
      //     } = await deploySuiteWithModuleComplianceBoundToWallet();

      //     await expect(
      //       compliance.connect(charlieWallet).transferred(aliceWallet.address, bobWallet.address, 0),
      //     ).to.be.revertedWith('invalid argument - no value transfer');
      //   });
      // });

      describe('when amount is greater than zero', () => {
        it('Should update the modules', async () => {
          const {
            suite: { compliance },
            accounts: { aliceWallet, bobWallet, charlieWallet },
          } = await deploySuiteWithModuleComplianceBoundToWallet();

          const signerEncAmount = await encrypt64(compliance, charlieWallet, 10);
          const tx = await compliance
            .connect(charlieWallet)
            [
              'transferred(address,address,bytes32,bytes)'
            ](aliceWallet, bobWallet, signerEncAmount.handles[0], signerEncAmount.inputProof);
          const txReceipt = await tx.wait(1);
          expect(txReceipt).not.to.be.null;
          expect(txReceipt!.status).be.equal(1);
          // await expect(compliance.connect(charlieWallet).transferred(aliceWallet.address, bobWallet.address, 10)).to.be
          //   .fulfilled;
        });
      });
    });
  });

  describe('.created', () => {
    describe('when not calling as a bound token', () => {
      it('should revert', async () => {
        const {
          accounts: { anotherWallet },
          suite: { compliance },
        } = await deploySuiteWithModularCompliancesFixture();

        await expect(
          compliance.connect(anotherWallet)['created(address,uint256)'](hre.ethers.ZeroAddress, 0),
        ).to.be.revertedWith('error : this address is not a token bound to the compliance contract');
      });
    });

    describe('when calling as a bound token', () => {
      describe('when to address is null', () => {
        it('should revert', async () => {
          const {
            suite: { compliance },
            accounts: { charlieWallet },
          } = await deploySuiteWithModuleComplianceBoundToWallet();

          await expect(
            compliance.connect(charlieWallet)['created(address,uint256)'](hre.ethers.ZeroAddress, 10),
          ).to.be.revertedWith('invalid argument - zero address');
        });
      });

      // Not supported in FHEVM
      // describe('when amount is zero', () => {
      //   it('should revert', async () => {
      //     const {
      //       suite: { compliance },
      //       accounts: { bobWallet, charlieWallet },
      //     } = await deploySuiteWithModuleComplianceBoundToWallet();

      //     await expect(
      //       compliance.connect(charlieWallet)['created(address,uint256)'](bobWallet.address, 0),
      //     ).to.be.revertedWith('invalid argument - no value mint');
      //   });
      // });

      describe('when amount is greater than zero', () => {
        it('Should update the modules', async () => {
          const {
            suite: { compliance },
            accounts: { bobWallet, charlieWallet },
          } = await deploySuiteWithModuleComplianceBoundToWallet();

          //await expect(compliance.connect(charlieWallet).created(bobWallet.address, 10)).to.be.fulfilled;

          const signerEncAmount = await encrypt64(compliance, charlieWallet, 10);

          const tx = await compliance
            .connect(charlieWallet)
            ['created(address,bytes32,bytes)'](bobWallet, signerEncAmount.handles[0], signerEncAmount.inputProof);

          const txReceipt = await tx.wait(1);

          expect(txReceipt).not.to.be.null;
          expect(txReceipt!.status).be.equal(1);
        });
      });
    });
  });

  describe('.destroyed', () => {
    describe('when not calling as a bound token', () => {
      it('should revert', async () => {
        const {
          accounts: { anotherWallet },
          suite: { compliance },
        } = await deploySuiteWithModularCompliancesFixture();

        await expect(
          compliance.connect(anotherWallet)['destroyed(address,uint256)'](hre.ethers.ZeroAddress, 0),
        ).to.be.revertedWith('error : this address is not a token bound to the compliance contract');
      });
    });

    describe('when calling as a bound token', () => {
      describe('when from address is null', () => {
        it('should revert', async () => {
          const {
            suite: { compliance },
            accounts: { charlieWallet },
          } = await deploySuiteWithModuleComplianceBoundToWallet();

          await expect(
            compliance.connect(charlieWallet)['destroyed(address,uint256)'](hre.ethers.ZeroAddress, 10),
          ).to.be.revertedWith('invalid argument - zero address');
        });
      });

      // Not supported in FHEVM
      // describe('when amount is zero', () => {
      //   it('should revert', async () => {
      //     const {
      //       suite: { compliance },
      //       accounts: { aliceWallet, charlieWallet },
      //     } = await deploySuiteWithModuleComplianceBoundToWallet();

      //     await expect(compliance.connect(charlieWallet)['destroyed(address,uint256)'](aliceWallet.address, 0)).to.be.revertedWith(
      //       'invalid argument - no value burn',
      //     );
      //   });
      // });

      describe('when amount is greater than zero', () => {
        it('Should update the modules', async () => {
          const {
            suite: { compliance },
            accounts: { aliceWallet, charlieWallet },
          } = await deploySuiteWithModuleComplianceBoundToWallet();

          const signerEncAmount = await encrypt64(compliance, charlieWallet, 10);

          // await expect(compliance.connect(charlieWallet).destroyed(aliceWallet.address, 10)).to.be.fulfilled;
          const tx = await compliance
            .connect(charlieWallet)
            ['destroyed(address,bytes32,bytes)'](aliceWallet, signerEncAmount.handles[0], signerEncAmount.inputProof);

          const txReceipt = await tx.wait(1);

          expect(txReceipt).not.to.be.null;
          expect(txReceipt!.status).be.equal(1);
        });
      });
    });
  });

  describe('.callModuleFunction()', () => {
    describe('when sender is not the owner', () => {
      it('should revert', async () => {
        const {
          accounts: { anotherWallet },
          suite: { compliance },
        } = await deploySuiteWithModularCompliancesFixture();

        await expect(
          compliance.connect(anotherWallet).callModuleFunction(hre.ethers.randomBytes(32), hre.ethers.ZeroAddress),
        ).to.be.revertedWithCustomError(compliance, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when module is not bound', () => {
      it('should revert', async () => {
        const {
          accounts: { deployer },
          suite: { compliance },
        } = await deploySuiteWithModularCompliancesFixture();

        await expect(
          compliance.connect(deployer).callModuleFunction(hre.ethers.randomBytes(32), hre.ethers.ZeroAddress),
        ).to.be.revertedWith('call only on bound module');
      });
    });
  });
});
