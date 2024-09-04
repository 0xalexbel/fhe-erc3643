// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, ebool, euint64} from "fhevm/lib/TFHE.sol";
import {euint64} from "fhevm/lib/TFHE.sol";
import {IModularCompliance} from "../IModularCompliance.sol";
import {IToken} from "../../../token/IToken.sol";
import {AgentRole} from "../../../roles/AgentRole.sol";
import {IIdentityRegistry} from "../../../registry/interfaces/IIdentityRegistry.sol";
import {AbstractModuleUpgradeable} from "./AbstractModuleUpgradeable.sol";

contract TransferFeesModule is AbstractModuleUpgradeable {
    /// Struct of fees
    struct Fee {
        uint256 rate; // min = 0, max = 10000, 0.01% = 1, 1% = 100, 100% = 10000
        address collector;
    }

    /// Mapping for compliance fees
    mapping(address => Fee) private _fees;

    /**
     *  this event is emitted whenever a fee definition is updated for the given compliance address
     *  the event is emitted by 'setFee'.
     *  compliance is the compliance contract address
     *  _rate is the rate of the fee (0.01% = 1, 1% = 100, 100% = 10000)
     *  _collector is the collector wallet address
     */
    event FeeUpdated(address indexed compliance, uint256 _rate, address _collector);

    error FeeRateIsOutOfRange(address compliance, uint256 rate);

    error CollectorAddressIsNotVerified(address compliance, address collector);

    /**
     * @dev initializes the contract and sets the initial state.
     * @notice This function should only be called once during the contract deployment.
     */
    function initialize() external initializer {
        __AbstractModule_init();
    }

    /**
     *  @dev Sets the fee rate and collector of the given compliance
     *  @param _rate is the rate of the fee (0.01% = 1, 1% = 100, 100% = 10000)
     *  @param _collector is the collector wallet address
     *  Only the owner of the Compliance smart contract can call this function
     *  Collector wallet address must be verified
     */
    function setFee(uint256 _rate, address _collector) external onlyComplianceCall {
        address tokenAddress = IModularCompliance(msg.sender).getTokenBound();
        if (_rate > 10000) {
            revert FeeRateIsOutOfRange(msg.sender, _rate);
        }

        IIdentityRegistry identityRegistry = IToken(tokenAddress).identityRegistry();
        if (!identityRegistry.isVerified(_collector)) {
            revert CollectorAddressIsNotVerified(msg.sender, _collector);
        }

        _fees[msg.sender].rate = _rate;
        _fees[msg.sender].collector = _collector;
        emit FeeUpdated(msg.sender, _rate, _collector);
    }

    /**
     *  @dev See {IModule-moduleTransferAction}.
     */
    function moduleTransferAction(address _from, address _to, euint64 _value) external override onlyComplianceCall {
        address senderIdentity = _getIdentity(msg.sender, _from);
        address receiverIdentity = _getIdentity(msg.sender, _to);

        if (senderIdentity == receiverIdentity) {
            return;
        }

        Fee memory fee = _fees[msg.sender];
        if (fee.rate == 0 || _from == fee.collector || _to == fee.collector) {
            return;
        }

        revert("TODO");
        // uint256 feeAmount = (_value * fee.rate) / 10000;
        // if (feeAmount == 0) {
        //     return;
        // }

        // IToken token = IToken(IModularCompliance(msg.sender).getTokenBound());
        // bool sent = token.forcedTransfer(_to, fee.collector, feeAmount);
        // require(sent, "transfer fee collection failed");
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
        ebool eTrue = TFHE.asEbool(true);
        TFHE.allowTransient(eTrue, msg.sender);
        return eTrue;
    }

    /**
     *  @dev getter for `_fees` variable
     *  @param _compliance the Compliance smart contract to be checked
     *  returns the Fee
     */
    function getFee(address _compliance) external view returns (Fee memory) {
        return _fees[_compliance];
    }

    /**
     *  @dev See {IModule-canComplianceBind}.
     */
    function canComplianceBind(address _compliance) external view returns (bool) {
        address tokenAddress = IModularCompliance(_compliance).getTokenBound();
        return AgentRole(tokenAddress).isAgent(address(this));
    }

    /**
     *  @dev See {IModule-isPlugAndPlay}.
     */
    function isPlugAndPlay() external pure returns (bool) {
        return false;
    }

    /**
     *  @dev See {IModule-name}.
     */
    function name() public pure returns (string memory _name) {
        return "TransferFeesModule";
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
}
