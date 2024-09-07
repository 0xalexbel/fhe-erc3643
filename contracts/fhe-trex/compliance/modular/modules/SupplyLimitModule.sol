// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, einput, ebool, euint64} from "fhevm/lib/TFHE.sol";
import {IModularCompliance} from "../IModularCompliance.sol";
import {IToken} from "../../../token/IToken.sol";
import {AbstractModuleUpgradeable} from "./AbstractModuleUpgradeable.sol";
import "hardhat/console.sol";

contract SupplyLimitModule is AbstractModuleUpgradeable {
    /// supply limits array
    mapping(address => euint64) private _esupplyLimits;

    /**
     *  this event is emitted when the supply limit has been set.
     *  `_compliance` is the compliance address.
     *  `_limit` is the max amount of tokens in circulation.
     */
    event SupplyLimitSet(address _compliance, euint64 _elimit);

    /**
     * @dev initializes the contract and sets the initial state.
     * @notice This function should only be called once during the contract deployment.
     */
    function initialize() external initializer {
        __AbstractModule_init();
    }

    function setSupplyLimit(einput encryptedAmount, bytes calldata inputProof) public onlyComplianceCall {
        return setSupplyLimit(TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @dev sets supply limit.
     *  Supply limit has to be smaller or equal to the actual supply.
     *  @param _elimit max amount of tokens to be created
     *  Only the owner of the Compliance smart contract can call this function
     *  emits an `SupplyLimitSet` event
     */
    function setSupplyLimit(euint64 _elimit) public onlyComplianceCall {
        require(TFHE.isSenderAllowed(_elimit), "TFHE: caller does not have TFHE permissions to access limit argument");
        TFHE.allow(_elimit, address(this));
        TFHE.allow(_elimit, msg.sender); // compliance
        _esupplyLimits[msg.sender] = _elimit;
        emit SupplyLimitSet(msg.sender, _elimit);
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
        address _from,
        address /*_to*/,
        euint64 _evalue,
        address _compliance
    ) external override returns (ebool) {
        euint64 totalSupply = IToken(IModularCompliance(_compliance).getTokenBound()).totalSupply();

        require(
            TFHE.isAllowed(_evalue, address(this)),
            "TFHE: SupplyLimitModule does not have TFHE permissions to access value argument"
        );
        require(
            TFHE.isAllowed(totalSupply, address(this)),
            "TFHE: SupplyLimitModule does not have TFHE permissions to access value argument"
        );

        // a = (IToken(IModularCompliance(_compliance).getTokenBound()).totalSupply() + _value)
        euint64 a = TFHE.add(totalSupply, _evalue);

        // !((IToken(IModularCompliance(_compliance).getTokenBound()).totalSupply() + _value) > _esupplyLimits[_compliance])
        ebool b = TFHE.le(a, _esupplyLimits[_compliance]);

        // !(_from == address(0))
        ebool c = TFHE.asEbool(_from != address(0));

        ebool result = TFHE.or(c, b);
        TFHE.allowTransient(result, msg.sender);

        return result;

        // if (
        //     _from == address(0) &&
        //     (IToken(IModularCompliance(_compliance).getTokenBound()).totalSupply() + _value) >
        //     _esupplyLimits[_compliance]
        // ) {
        //     return false;
        // }
        // ebool eTrue = TFHE.asEbool(true);
        // TFHE.allowTransient(eTrue, msg.sender);
        // return eTrue;
    }

    /**
     *  @dev getter for `supplyLimits` variable
     *  returns supply limit
     */
    function getSupplyLimit(address _compliance) external view returns (euint64) {
        return _esupplyLimits[_compliance];
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
