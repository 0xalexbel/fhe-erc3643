// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IModularCompliance} from "../IModularCompliance.sol";
import {IToken} from "../../../token/IToken.sol";
import {AbstractModuleUpgradeable} from "./AbstractModuleUpgradeable.sol";

contract SupplyLimitModule is AbstractModuleUpgradeable {
    /// supply limits array
    mapping(address => uint256) private _supplyLimits;

    /**
     *  this event is emitted when the supply limit has been set.
     *  `_compliance` is the compliance address.
     *  `_limit` is the max amount of tokens in circulation.
     */
    event SupplyLimitSet(address _compliance, uint256 _limit);

    /**
     * @dev initializes the contract and sets the initial state.
     * @notice This function should only be called once during the contract deployment.
     */
    function initialize() external initializer {
        __AbstractModule_init();
    }

    /**
     *  @dev sets supply limit.
     *  Supply limit has to be smaller or equal to the actual supply.
     *  @param _limit max amount of tokens to be created
     *  Only the owner of the Compliance smart contract can call this function
     *  emits an `SupplyLimitSet` event
     */
    function setSupplyLimit(uint256 _limit) external onlyComplianceCall {
        _supplyLimits[msg.sender] = _limit;
        emit SupplyLimitSet(msg.sender, _limit);
    }

    /**
     *  @dev See {IModule-moduleTransferAction}.
     *  no transfer action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleTransferAction(address _from, address _to, uint256 _value) external onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleMintAction}.
     *  no mint action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleMintAction(address _to, uint256 _value) external onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleBurnAction}.
     *  no burn action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleBurnAction(address _from, uint256 _value) external onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleCheck}.
     */
    function moduleCheck(
        address _from,
        address /*_to*/,
        uint256 _value,
        address _compliance
    ) external view override returns (bool) {
        if (
            _from == address(0) &&
            (IToken(IModularCompliance(_compliance).getTokenBound()).totalSupply() + _value) >
            _supplyLimits[_compliance]
        ) {
            return false;
        }
        return true;
    }

    /**
     *  @dev getter for `supplyLimits` variable
     *  returns supply limit
     */
    function getSupplyLimit(address _compliance) external view returns (uint256) {
        return _supplyLimits[_compliance];
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
        return "SupplyLimitModule";
    }
}
