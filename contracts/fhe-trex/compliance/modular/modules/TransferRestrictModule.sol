// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, ebool, euint64} from "fhevm/lib/TFHE.sol";
import {AbstractModuleUpgradeable} from "./AbstractModuleUpgradeable.sol";

contract TransferRestrictModule is AbstractModuleUpgradeable {
    /// allowed user addresses mapping
    mapping(address => mapping(address => bool)) private _allowedUserAddresses;

    /**
     *  this event is emitted when a user is allowed for transfer
     *  `_compliance` is the compliance address.
     *  `_userAddress` is the allowed user address
     */
    event UserAllowed(address _compliance, address _userAddress);

    /**
     *  this event is emitted when a user is disallowed for transfer
     *  `_compliance` is the compliance address.
     *  `_userAddress` is the disallowed user address
     */
    event UserDisallowed(address _compliance, address _userAddress);

    /**
     * @dev initializes the contract and sets the initial state.
     * @notice This function should only be called once during the contract deployment.
     */
    function initialize() external initializer {
        __AbstractModule_init();
    }

    /**
     *  @dev allows a user address for transfer.
     *  @param _userAddress is the address of the user
     *  Only the owner of the Compliance smart contract can call this function
     *  emits an `UserAllowed` event
     */
    function allowUser(address _userAddress) external onlyComplianceCall {
        _allowedUserAddresses[msg.sender][_userAddress] = true;
        emit UserAllowed(msg.sender, _userAddress);
    }

    /**
     *  @dev allows multiple user addresses for transfer.
     *  @param _userAddresses is the array of user addresses
     *  Only the owner of the Compliance smart contract can call this function
     *  emits an `UserAllowed` event
     */
    function batchAllowUsers(address[] memory _userAddresses) external onlyComplianceCall {
        uint256 length = _userAddresses.length;
        for (uint256 i = 0; i < length; i++) {
            address _userAddress = _userAddresses[i];
            _allowedUserAddresses[msg.sender][_userAddress] = true;
            emit UserAllowed(msg.sender, _userAddress);
        }
    }

    /**
     *  @dev disallows a user address for transfer.
     *  @param _userAddress is the address of the user
     *  Only the owner of the Compliance smart contract can call this function
     *  emits an `UserDisallowed` event
     */
    function disallowUser(address _userAddress) external onlyComplianceCall {
        _allowedUserAddresses[msg.sender][_userAddress] = false;
        emit UserDisallowed(msg.sender, _userAddress);
    }

    /**
     *  @dev disallows multiple user addresses for transfer.
     *  @param _userAddresses is the array of user addresses
     *  Only the owner of the Compliance smart contract can call this function
     *  emits an `UserDisallowed` event
     */
    function batchDisallowUsers(address[] memory _userAddresses) external onlyComplianceCall {
        uint256 length = _userAddresses.length;
        for (uint256 i = 0; i < length; i++) {
            address _userAddress = _userAddresses[i];
            _allowedUserAddresses[msg.sender][_userAddress] = false;
            emit UserDisallowed(msg.sender, _userAddress);
        }
    }

    /**
     *  @dev See {IModule-moduleTransferAction}.
     *  no transfer action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleTransferAction(address _from, address _to, euint64 _value) external onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleMintAction}.
     *  no mint action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleMintAction(address _to, euint64 _evalue) external onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleBurnAction}.
     *  no burn action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleBurnAction(address _from, euint64 _evalue) external onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleCheck}.
     */
    function moduleCheck(
        address /*_from*/,
        address /*_to*/,
        euint64 /*_value*/,
        address /*_compliance*/
    ) external override returns (ebool) {
        // if (_allowedUserAddresses[_compliance][_from]) {
        //     return true;
        // }

        // return _allowedUserAddresses[_compliance][_to];
        ebool eTrue = TFHE.asEbool(true);
        TFHE.allowTransient(eTrue, msg.sender);
        return eTrue;
    }

    /**
     *  @dev getter for `_allowedUserAddresses` mapping
     *  @param _compliance the Compliance smart contract to be checked
     *  @param _userAddress the user address to be checked
     *  returns the true if user is allowed to transfer
     */
    function isUserAllowed(address _compliance, address _userAddress) external view returns (bool) {
        return _allowedUserAddresses[_compliance][_userAddress];
    }

    /**
     *  @dev See {IModule-canComplianceBind}.
     */
    function canComplianceBind(address /*_compliance*/) external pure override returns (bool) {
        return true;
    }

    /**
     *  @dev See {IModule-isPlugAndPlay}.
     */
    function isPlugAndPlay() external pure override returns (bool) {
        return true;
    }

    /**
     *  @dev See {IModule-name}.
     */
    function name() public pure returns (string memory _name) {
        return "TransferRestrictModule";
    }
}
