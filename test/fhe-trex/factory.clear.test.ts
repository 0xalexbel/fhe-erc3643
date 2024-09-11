import { assert, expect } from 'chai';
import hre from 'hardhat';

import { deployFullSuiteFixture } from './fixtures/deploy-full-suite.fixture';
import { EventLog, Log } from 'ethers';
import { expectRevert } from '../tx_error';

describe('TREXFactory', () => {
  describe('.deployTREXSuite()', () => {
    describe('when called by not owner', () => {
      it('should revert', async () => {
        const {
          accounts: { deployer, anotherWallet },
          factories: { trexFactory },
        } = await deployFullSuiteFixture();
        await expectRevert(
          trexFactory.connect(anotherWallet).deployTREXSuite(
            'salt',
            {
              owner: deployer.address,
              name: 'Token name',
              symbol: 'SYM',
              decimals: 8,
              irs: hre.ethers.ZeroAddress,
              ONCHAINID: hre.ethers.ZeroAddress,
              irAgents: [],
              tokenAgents: [],
              complianceModules: [],
              complianceSettings: [],
            },
            {
              claimTopics: [],
              issuers: [],
              issuerClaims: [],
            },
            {
              gasLimit: 5_000_000,
            },
          ),
        ).to.be.revertedWithCustomError(trexFactory, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when called by owner', () => {
      describe('when salt was already used', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await deployFullSuiteFixture();
          await trexFactory.connect(deployer).deployTREXSuite(
            'salt',
            {
              owner: deployer.address,
              name: 'Token name',
              symbol: 'SYM',
              decimals: 8,
              irs: hre.ethers.ZeroAddress,
              ONCHAINID: hre.ethers.ZeroAddress,
              irAgents: [],
              tokenAgents: [],
              complianceModules: [],
              complianceSettings: [],
            },
            {
              claimTopics: [],
              issuers: [],
              issuerClaims: [],
            },
          );
          await expectRevert(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: hre.ethers.ZeroAddress,
                ONCHAINID: hre.ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: [],
              },
              {
                claimTopics: [],
                issuers: [],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('token already deployed');
        });
      });

      describe('when claim pattern is not valid', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await deployFullSuiteFixture();
          await expectRevert(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: hre.ethers.ZeroAddress,
                ONCHAINID: hre.ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: [],
              },
              {
                claimTopics: [],
                issuers: [hre.ethers.ZeroAddress],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('claim pattern not valid');
        });
      });

      describe('when configuring more than 5 claim issuers', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await deployFullSuiteFixture();
          await expectRevert(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: hre.ethers.ZeroAddress,
                ONCHAINID: hre.ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: [],
              },
              {
                claimTopics: [],
                issuers: Array.from({ length: 6 }, () => hre.ethers.ZeroAddress),
                issuerClaims: Array.from({ length: 6 }, () => []),
              },
            ),
          ).to.be.revertedWith('max 5 claim issuers at deployment');
        });
      });

      describe('when configuring more than 5 claim topics', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await deployFullSuiteFixture();
          await expectRevert(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: hre.ethers.ZeroAddress,
                ONCHAINID: hre.ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: [],
              },
              {
                claimTopics: Array.from({ length: 6 }, () => hre.ethers.ZeroHash),
                issuers: [],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('max 5 claim topics at deployment');
        });
      });

      describe('when configuring more than 5 agents', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await deployFullSuiteFixture();
          await expectRevert(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: hre.ethers.ZeroAddress,
                ONCHAINID: hre.ethers.ZeroAddress,
                irAgents: Array.from({ length: 6 }, () => hre.ethers.ZeroAddress),
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: [],
              },
              {
                claimTopics: [],
                issuers: [],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('max 5 agents at deployment');
        });
      });

      describe('when configuring more than 30 compliance modules', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await deployFullSuiteFixture();
          await expectRevert(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: hre.ethers.ZeroAddress,
                ONCHAINID: hre.ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: Array.from({ length: 31 }, () => hre.ethers.ZeroAddress),
                complianceSettings: [],
              },
              {
                claimTopics: [],
                issuers: [],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('max 30 module actions at deployment');
        });
      });

      describe('when compliance configuration is not valid', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await deployFullSuiteFixture();
          await expectRevert(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: hre.ethers.ZeroAddress,
                ONCHAINID: hre.ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: ['0x00'],
              },
              {
                claimTopics: [],
                issuers: [],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('invalid compliance pattern');
        });
      });

      describe('when configuration is valid', () => {
        it('should deploy a new suite', async () => {
          const {
            accounts: { deployer, aliceWallet, bobWallet },
            factories: { trexFactory, identityFactory },
            suite: { claimIssuerContract },
          } = await deployFullSuiteFixture();

          const countryAllowModule = await hre.ethers.deployContract('CountryAllowModule');

          const tx = await trexFactory.connect(deployer).deployTREXSuite(
            'salt',
            {
              owner: deployer.address,
              name: 'Token name',
              symbol: 'SYM',
              decimals: 8,
              irs: hre.ethers.ZeroAddress,
              ONCHAINID: hre.ethers.ZeroAddress,
              irAgents: [aliceWallet.address],
              tokenAgents: [bobWallet.address],
              complianceModules: [countryAllowModule],
              complianceSettings: [
                new hre.ethers.Interface([
                  'function batchAllowCountries(uint16[] calldata countries)',
                ]).encodeFunctionData('batchAllowCountries', [[42, 66]]),
              ],
            },
            {
              claimTopics: [hre.ethers.keccak256(hre.ethers.toUtf8Bytes('DEMO_TOPIC'))],
              issuers: [claimIssuerContract],
              issuerClaims: [[hre.ethers.keccak256(hre.ethers.toUtf8Bytes('DEMO_TOPIC'))]],
            },
          );
          await expect(tx).to.emit(trexFactory, 'TREXSuiteDeployed');
          await expect(tx).to.emit(identityFactory, 'Deployed');
          await expect(tx).to.emit(identityFactory, 'TokenLinked');
        });
      });
    });
  });

  describe('.getToken()', () => {
    describe('when salt was used to deploy a token', () => {
      it('should return the token address', async () => {
        const {
          accounts: { deployer },
          factories: { trexFactory },
        } = await deployFullSuiteFixture();
        const tx = await trexFactory.connect(deployer).deployTREXSuite(
          'salt',
          {
            owner: deployer.address,
            name: 'Token name',
            symbol: 'SYM',
            decimals: 8,
            irs: hre.ethers.ZeroAddress,
            ONCHAINID: hre.ethers.ZeroAddress,
            irAgents: [],
            tokenAgents: [],
            complianceModules: [],
            complianceSettings: [],
          },
          {
            claimTopics: [],
            issuers: [],
            issuerClaims: [],
          },
        );

        const txReceipt = await tx.wait();
        expect(txReceipt).not.to.be.null;
        const log = txReceipt!.logs.find(log => 'eventName' in log && log.eventName === 'TREXSuiteDeployed');
        assert(log);
        assert('args' in log);

        const tokenAddressExpected = log.args[0];
        const tokenAddress = await trexFactory.getToken('salt');

        expect(tokenAddress).to.equal(tokenAddressExpected);
      });
    });
  });

  describe('.setIdFactory()', () => {
    describe('when try to input address 0', () => {
      it('should revert', async () => {
        const {
          accounts: { deployer },
          factories: { trexFactory },
        } = await deployFullSuiteFixture();
        await expectRevert(trexFactory.connect(deployer).setIdFactory(hre.ethers.ZeroAddress)).to.be.revertedWith(
          'invalid argument - zero address',
        );
      });
    });
    describe('when try to input a valid address', () => {
      it('should set new Id Factory', async () => {
        const {
          accounts: { deployer },
          factories: { trexFactory },
          authorities: { identityImplementationAuthority },
        } = await deployFullSuiteFixture();

        const idFactoryContractFactory = await hre.ethers.getContractFactory('IdFactory', deployer);
        const newIdFactory = await idFactoryContractFactory.deploy(identityImplementationAuthority);

        const tx = await trexFactory.setIdFactory(newIdFactory);
        await expect(tx).to.emit(trexFactory, 'IdFactorySet');
        expect(await trexFactory.getIdFactory()).to.equal(newIdFactory);
      });
    });
  });

  describe('.recoverContractOwnership()', () => {
    describe('when sender is not owner', () => {
      it('should revert', async () => {
        const {
          accounts: { deployer, aliceWallet },
          factories: { trexFactory },
        } = await deployFullSuiteFixture();
        const tx = await trexFactory.connect(deployer).deployTREXSuite(
          'salt',
          {
            owner: deployer,
            name: 'Token name',
            symbol: 'SYM',
            decimals: 8,
            irs: hre.ethers.ZeroAddress,
            ONCHAINID: hre.ethers.ZeroAddress,
            irAgents: [],
            tokenAgents: [],
            complianceModules: [],
            complianceSettings: [],
          },
          {
            claimTopics: [],
            issuers: [],
            issuerClaims: [],
          },
        );

        const txReceipt = await tx.wait();
        assert(txReceipt);
        const log = txReceipt.logs.find(
          (log: Log | EventLog) => 'eventName' in log && log.eventName === 'TREXSuiteDeployed',
        );
        assert(log);
        assert('args' in log);

        const tokenAddress = log.args[0];

        await expectRevert(
          trexFactory.connect(aliceWallet).recoverContractOwnership(tokenAddress, aliceWallet),
        ).to.be.revertedWithCustomError(trexFactory, 'OwnableUnauthorizedAccount');
      });
    });

    // OK
    describe('when sender is owner and factory owns the trex contract', () => {
      it('should transfer ownership on the desired contract', async () => {
        const {
          accounts: { deployer, aliceWallet },
          factories: { trexFactory },
        } = await deployFullSuiteFixture();
        const deployTx = await trexFactory.connect(deployer).deployTREXSuite(
          'salt',
          {
            owner: trexFactory,
            name: 'Token name',
            symbol: 'SYM',
            decimals: 8,
            irs: hre.ethers.ZeroAddress,
            ONCHAINID: hre.ethers.ZeroAddress,
            irAgents: [],
            tokenAgents: [],
            complianceModules: [],
            complianceSettings: [],
          },
          {
            claimTopics: [],
            issuers: [],
            issuerClaims: [],
          },
        );

        const txReceipt = await deployTx.wait(1);
        assert(txReceipt);
        const log = txReceipt.logs.find(
          (log: Log | EventLog) => 'eventName' in log && log.eventName === 'TREXSuiteDeployed',
        );
        assert(log);
        assert('args' in log);

        const tokenAddress = log.args[0];

        const tx = await trexFactory.connect(deployer).recoverContractOwnership(tokenAddress, aliceWallet);
        await tx.wait(1);
        const token = await hre.ethers.getContractAt('Token', tokenAddress);

        await expect(tx).to.emit(token, 'OwnershipTransferred').withArgs(trexFactory, aliceWallet.address);
        await expect(token.owner()).to.eventually.eq(aliceWallet);
      });
    });
  });
});
