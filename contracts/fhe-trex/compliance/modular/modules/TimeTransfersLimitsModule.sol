// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, ebool, euint64} from "fhevm/lib/TFHE.sol";
import {IModularCompliance} from "../IModularCompliance.sol";
import {IToken} from "../../../token/IToken.sol";
import {AgentRole} from "../../../roles/AgentRole.sol";
import {AbstractModuleUpgradeable} from "./AbstractModuleUpgradeable.sol";

contract TimeTransfersLimitsModule is AbstractModuleUpgradeable {
    /// Struct of transfer Counters
    struct TransferCounter {
        uint256 value;
        uint256 timer;
    }

    struct Limit {
        uint32 limitTime;
        uint256 limitValue;
    }

    struct IndexLimit {
        bool attributedLimit;
        uint8 limitIndex;
    }

    // Mapping for limit time indexes
    mapping(address => mapping(uint32 => IndexLimit)) private _limitValues;

    /// Mapping for limit time frames
    mapping(address => Limit[]) private _transferLimits;

    /// Mapping for users Counters
    mapping(address => mapping(address => mapping(uint32 => TransferCounter))) private _usersCounters;

    /**
     *  this event is emitted whenever a transfer limit is updated for the given compliance address and limit time
     *  the event is emitted by 'setTimeTransferLimit'.
     *  compliance`is the compliance contract address
     *  _limitValue is the new limit value for the given limit time
     *  _limitTime is the period of time of the limit
     */
    event TimeTransferLimitUpdated(address indexed compliance, uint32 limitTime, uint256 limitValue);

    error LimitsArraySizeExceeded(address compliance, uint8 arraySize);

    /**
     * @dev initializes the contract and sets the initial state.
     * @notice This function should only be called once during the contract deployment.
     */
    function initialize() external initializer {
        __AbstractModule_init();
    }

    /**
     *  @dev Sets the limit of tokens allowed to be transferred in the given time frame.
     *  @param _limit The limit time and value
     *  Only the owner of the Compliance smart contract can call this function
     */
    function setTimeTransferLimit(Limit calldata _limit) external onlyComplianceCall {
        bool limitIsAttributed = _limitValues[msg.sender][_limit.limitTime].attributedLimit;
        uint8 limitCount = uint8(_transferLimits[msg.sender].length);
        if (!limitIsAttributed && limitCount >= 4) {
            revert LimitsArraySizeExceeded(msg.sender, limitCount);
        }
        if (!limitIsAttributed && limitCount < 4) {
            _transferLimits[msg.sender].push(_limit);
            _limitValues[msg.sender][_limit.limitTime] = IndexLimit(true, limitCount);
        } else {
            _transferLimits[msg.sender][_limitValues[msg.sender][_limit.limitTime].limitIndex] = _limit;
        }

        emit TimeTransferLimitUpdated(msg.sender, _limit.limitTime, _limit.limitValue);
    }

    /**
     *  @dev See {IModule-moduleTransferAction}.
     */
    function moduleTransferAction(address _from, address /*_to*/, euint64 _value) external override onlyComplianceCall {
        _increaseCounters(msg.sender, _from, _value);
    }

    /**
     *  @dev See {IModule-moduleMintAction}.
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleMintAction(address _to, euint64 _evalue) external override onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleBurnAction}.
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleBurnAction(address _from, euint64 _evalue) external override onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleCheck}.
     */
    function moduleCheck(
        address /*_from*/,
        address /*_to*/,
        euint64 /*_value*/,
        address /*_compliance*/
    ) external override returns (ebool) {
        // if (_from == address(0)) {
        //     return true;
        // }

        // if (_isTokenAgent(_compliance, _from)) {
        //     return true;
        // }

        // address senderIdentity = _getIdentity(_compliance, _from);
        // for (uint256 i = 0; i < _transferLimits[_compliance].length; i++) {
        //     if (_value > _transferLimits[_compliance][i].limitValue) {
        //         return false;
        //     }

        //     if (
        //         !_isUserCounterFinished(_compliance, senderIdentity, _transferLimits[_compliance][i].limitTime) &&
        //         _usersCounters[_compliance][senderIdentity][_transferLimits[_compliance][i].limitTime].value + _value >
        //         _transferLimits[_compliance][i].limitValue
        //     ) {
        //         return false;
        //     }
        // }

        // return true;
        ebool eTrue = TFHE.asEbool(true);
        TFHE.allowTransient(eTrue, msg.sender);
        return eTrue;
    }

    /**
     *  @dev getter for `_transferLimits` variable
     *  @param _compliance the Compliance smart contract to be checked
     *  returns array of Limits
     */
    function getTimeTransferLimits(address _compliance) external view returns (Limit[] memory limits) {
        return _transferLimits[_compliance];
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
        return "TimeTransfersLimitsModule";
    }

    /**
     *  @dev Checks if the cooldown must be reset, then increases user's OnchainID counters,
     *  @param _compliance the Compliance smart contract address
     *  @param _userAddress user wallet address
     *  @param _value, value of transaction)to be increased
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _increaseCounters(address _compliance, address _userAddress, euint64 _value) internal {
        revert("TODO");
        // address identity = _getIdentity(_compliance, _userAddress);
        // for (uint256 i = 0; i < _transferLimits[_compliance].length; i++) {
        //     _resetUserCounter(_compliance, identity, _transferLimits[_compliance][i].limitTime);
        //     _usersCounters[_compliance][identity][_transferLimits[_compliance][i].limitTime].value += _value;
        // }
    }

    /**
     *  @dev resets cooldown for the user if cooldown has reached the time limit
     *  @param _compliance the Compliance smart contract address
     *  @param _identity ONCHAINID of user wallet
     *  @param _limitTime limit time frame
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _resetUserCounter(address _compliance, address _identity, uint32 _limitTime) internal {
        if (_isUserCounterFinished(_compliance, _identity, _limitTime)) {
            TransferCounter storage counter = _usersCounters[_compliance][_identity][_limitTime];
            counter.timer = block.timestamp + _limitTime;
            counter.value = 0;
        }
    }

    /**
     *  @dev checks if the counter time frame has finished since the cooldown has been triggered for this identity
     *  @param _compliance the Compliance smart contract to be checked
     *  @param _identity ONCHAINID of user wallet
     *  @param _limitTime limit time frame
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _isUserCounterFinished(
        address _compliance,
        address _identity,
        uint32 _limitTime
    ) internal view returns (bool) {
        return _usersCounters[_compliance][_identity][_limitTime].timer <= block.timestamp;
    }

    /**
     *  @dev Returns the ONCHAINID (Identity) of the _userAddress
     *  @param _userAddress Address of the wallet
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _getIdentity(address _compliance, address _userAddress) internal view returns (address) {
        return
            address(IToken(IModularCompliance(_compliance).getTokenBound()).identityRegistry().identity(_userAddress));
    }

    /**
     *  @dev checks if the given user address is an agent of token
     *  @param compliance the Compliance smart contract to be checked
     *  @param _userAddress ONCHAIN identity of the user
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _isTokenAgent(address compliance, address _userAddress) internal view returns (bool) {
        return AgentRole(IModularCompliance(compliance).getTokenBound()).isAgent(_userAddress);
    }

    function usersCounters(
        address _compliance,
        address _identity,
        uint32 _limitTime
    ) external view returns (TransferCounter memory) {
        return _usersCounters[_compliance][_identity][_limitTime];
    }
}
