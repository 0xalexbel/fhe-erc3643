// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IModule} from "./IModule.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

abstract contract AbstractModuleUpgradeable is IModule, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    struct AbstractModuleStorage {
        /// compliance contract binding status
        mapping(address => bool) complianceBound;
    }

    // keccak256(abi.encode(uint256(keccak256("ERC3643.storage.AbstractModule")) - 1)) & ~bytes32(uint256(0xff))
    // solhint-disable-next-line openzeppelin/leading-underscore
    bytes32 private constant _ABSTRACT_MODULE_STORAGE_LOCATION =
        0xf6cc97de1266c180cd39f3b311632644143ce7873d2927755382ad4b39e8ae00;

    /**
     * @dev Throws if `_compliance` is not a bound compliance contract address.
     */
    modifier onlyBoundCompliance(address _compliance) {
        AbstractModuleStorage storage s = _getAbstractModuleStorage();
        require(s.complianceBound[_compliance], "compliance not bound");
        _;
    }

    /**
     * @dev Throws if called from an address that is not a bound compliance contract.
     */
    modifier onlyComplianceCall() {
        AbstractModuleStorage storage s = _getAbstractModuleStorage();
        require(s.complianceBound[msg.sender], "only bound compliance can call");
        _;
    }

    /**
     *  @dev See {IModule-bindCompliance}.
     */
    function bindCompliance(address _compliance) external override {
        AbstractModuleStorage storage s = _getAbstractModuleStorage();
        require(_compliance != address(0), "invalid argument - zero address");
        require(!s.complianceBound[_compliance], "compliance already bound");
        require(msg.sender == _compliance, "only compliance contract can call");
        s.complianceBound[_compliance] = true;
        emit ComplianceBound(_compliance);
    }

    /**
     *  @dev See {IModule-unbindCompliance}.
     */
    function unbindCompliance(address _compliance) external override onlyComplianceCall {
        AbstractModuleStorage storage s = _getAbstractModuleStorage();
        require(_compliance != address(0), "invalid argument - zero address");
        require(msg.sender == _compliance, "only compliance contract can call");
        s.complianceBound[_compliance] = false;
        emit ComplianceUnbound(_compliance);
    }

    /**
     *  @dev See {IModule-isComplianceBound}.
     */
    function isComplianceBound(address _compliance) external view override returns (bool) {
        AbstractModuleStorage storage s = _getAbstractModuleStorage();
        return s.complianceBound[_compliance];
    }

    // solhint-disable-next-line func-name-mixedcase
    function __AbstractModule_init() internal onlyInitializing {
        __Ownable_init(msg.sender);
        __AbstractModule_init_unchained();
    }

    // solhint-disable-next-line no-empty-blocks, func-name-mixedcase
    function __AbstractModule_init_unchained() internal onlyInitializing {}

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address /*newImplementation*/) internal virtual override onlyOwner {}

    function _getAbstractModuleStorage() private pure returns (AbstractModuleStorage storage s) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := _ABSTRACT_MODULE_STORAGE_LOCATION
        }
    }
}
