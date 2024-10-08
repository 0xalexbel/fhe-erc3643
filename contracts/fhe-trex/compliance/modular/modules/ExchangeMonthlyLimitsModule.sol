// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, ebool, euint64} from "fhevm/lib/TFHE.sol";
import {AbstractModuleUpgradeable} from "./AbstractModuleUpgradeable.sol";
import {IModularCompliance} from "../IModularCompliance.sol";
import {IToken} from "../../../token/IToken.sol";
import {AgentRole} from "../../../roles/AgentRole.sol";

contract ExchangeMonthlyLimitsModule is AbstractModuleUpgradeable {
    /// Struct of transfer Counters
    struct ExchangeTransferCounter {
        euint64 monthlyCount;
        uint256 monthlyTimer;
    }

    /// Getter for Tokens monthlyLimit (euint64)
    mapping(address => mapping(address => uint256)) private _exchangeMonthlyLimit;

    /// Mapping for users Counters
    mapping(address => mapping(address => mapping(address => ExchangeTransferCounter))) private _exchangeCounters;

    /// Mapping for wallets tagged as exchange wallets
    mapping(address => bool) private _exchangeIDs;

    /**
     *  this event is emitted whenever the Exchange Limit has been updated.
     *  the event is emitted by 'setExchangeMonthlyLimit'
     *  `compliance` is the address of the caller Compliance contract.
     *  `_exchangeID` is the amount ONCHAINID address of the exchange.
     *  `_newExchangeMonthlyLimit` is the amount Limit of tokens to be transferred monthly to an exchange wallet.
     */
    event ExchangeMonthlyLimitUpdated(
        address indexed compliance,
        address _exchangeID,
        uint256 _newExchangeMonthlyLimit
    );

    /**
     *  this event is emitted whenever an ONCHAINID is tagged as being an exchange ID.
     *  the event is emitted by 'addExchangeID'.
     *  `_newExchangeID` is the ONCHAINID address of the exchange to add.
     */
    event ExchangeIDAdded(address _newExchangeID);

    /**
     *  this event is emitted whenever an ONCHAINID is untagged as belonging to an exchange.
     *  the event is emitted by 'removeExchangeID'.
     *  `_exchangeID` is the ONCHAINID being untagged as an exchange ID.
     */
    event ExchangeIDRemoved(address _exchangeID);

    error ONCHAINIDAlreadyTaggedAsExchange(address _exchangeID);

    error ONCHAINIDNotTaggedAsExchange(address _exchangeID);

    /**
     * @dev initializes the contract and sets the initial state.
     * @notice This function should only be called once during the contract deployment.
     */
    function initialize() external initializer {
        __AbstractModule_init();
    }

    /**
     *  @dev Set the limit of tokens allowed to be transferred monthly.
     *  @param _exchangeID ONCHAINID of the exchange
     *  @param _newExchangeMonthlyLimit The new monthly limit of the exchange
     *  Only the Compliance smart contract can call this function
     */
    function setExchangeMonthlyLimit(
        address _exchangeID,
        uint256 _newExchangeMonthlyLimit
    ) external onlyComplianceCall {
        _exchangeMonthlyLimit[msg.sender][_exchangeID] = _newExchangeMonthlyLimit;
        emit ExchangeMonthlyLimitUpdated(msg.sender, _exchangeID, _newExchangeMonthlyLimit);
    }

    /**
     *  @dev tags the ONCHAINID as being an exchange ID
     *  @param _exchangeID ONCHAINID to be tagged
     *  Function can be called only by the owner of this module
     *  Cannot be called on an address already tagged as being an exchange
     *  emits an `ExchangeIDAdded` event
     */
    function addExchangeID(address _exchangeID) external onlyOwner {
        if (isExchangeID(_exchangeID)) {
            revert ONCHAINIDAlreadyTaggedAsExchange(_exchangeID);
        }

        _exchangeIDs[_exchangeID] = true;
        emit ExchangeIDAdded(_exchangeID);
    }

    /**
     *  @dev untags the ONCHAINID as being an exchange ID
     *  @param _exchangeID ONCHAINID to be untagged
     *  Function can be called only by the owner of this module
     *  Cannot be called on an address not tagged as being an exchange
     *  emits an `ExchangeIDRemoved` event
     */
    function removeExchangeID(address _exchangeID) external onlyOwner {
        if (!isExchangeID(_exchangeID)) {
            revert ONCHAINIDNotTaggedAsExchange(_exchangeID);
        }
        _exchangeIDs[_exchangeID] = false;
        emit ExchangeIDRemoved(_exchangeID);
    }

    /**
     *  @dev See {IModule-moduleTransferAction}.
     */
    function moduleTransferAction(address _from, address _to, euint64 _evalue) external override onlyComplianceCall {
        address senderIdentity = _getIdentity(msg.sender, _from);
        address receiverIdentity = _getIdentity(msg.sender, _to);
        if (isExchangeID(receiverIdentity) && !_isTokenAgent(msg.sender, _from)) {
            _increaseExchangeCounters(msg.sender, receiverIdentity, senderIdentity, _evalue);
        }
    }

    /**
     *  @dev See {IModule-moduleMintAction}.
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleMintAction(address /*_to*/, euint64 /*_value*/) external override onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleBurnAction}.
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleBurnAction(address /*_from*/, euint64 /*_value*/) external override onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleCheck}.
     */
    function moduleCheck(
        address _from,
        address _to,
        euint64 _evalue,
        address _compliance
    ) external override returns (ebool) {
        require(
            TFHE.isAllowed(_evalue, address(this)),
            "TFHE: ExchangeMonthlyLimitsModule does not have TFHE permissions to access value argument"
        );

        if (_from == address(0) || _isTokenAgent(_compliance, _from)) {
            ebool eTrue = TFHE.asEbool(true);
            TFHE.allowTransient(eTrue, msg.sender);
            return eTrue;
        }

        address senderIdentity = _getIdentity(_compliance, _from);
        if (isExchangeID(senderIdentity)) {
            ebool eTrue = TFHE.asEbool(true);
            TFHE.allowTransient(eTrue, msg.sender);
            return eTrue;
        }

        address receiverIdentity = _getIdentity(_compliance, _to);
        if (!isExchangeID(receiverIdentity)) {
            ebool eTrue = TFHE.asEbool(true);
            TFHE.allowTransient(eTrue, msg.sender);
            return eTrue;
        }

        euint64 mc = getMonthlyCounter(_compliance, receiverIdentity, senderIdentity);
        if (euint64.unwrap(mc) == 0) {
            mc = TFHE.asEuint64(0);
        }

        require(
            euint64.unwrap(mc) == 0 || TFHE.isAllowed(mc, address(this)),
            "TFHE: ExchangeMonthlyLimitsModule does not have TFHE permissions to access monthly counter stored value"
        );

        // if (_value > _exchangeMonthlyLimit[_compliance][receiverIdentity]) {
        //     return TFHE.asEbool(false);
        // }

        // if (_isExchangeMonthFinished(_compliance, receiverIdentity, senderIdentity)) {
        //     return TFHE.asEbool(true);
        // }

        // if (
        //     getMonthlyCounter(_compliance, receiverIdentity, senderIdentity) + _value >
        //     _exchangeMonthlyLimit[_compliance][receiverIdentity]
        // ) {
        //     return TFHE.asEbool(false);
        // }

        /*
        if ( A ) {
            return false
        }
        if ( B ) {
            return true
        }
        if ( C ) {
            return false
        }
        return true

        !A AND ( B OR !C  )
        */

        // A = (_value > _exchangeMonthlyLimit[_compliance][receiverIdentity])
        //
        // notA = (_value <= _exchangeMonthlyLimit[_compliance][receiverIdentity])
        ebool notA = TFHE.le(_evalue, TFHE.asEuint64(_exchangeMonthlyLimit[_compliance][receiverIdentity]));

        // B = (_isExchangeMonthFinished(_compliance, receiverIdentity, senderIdentity))
        ebool B = TFHE.asEbool(_isExchangeMonthFinished(_compliance, receiverIdentity, senderIdentity));

        // C = (
        //     getMonthlyCounter(_compliance, receiverIdentity, senderIdentity) + _value >
        //     _exchangeMonthlyLimit[_compliance][receiverIdentity]
        // )
        euint64 a = TFHE.add(mc, _evalue);
        euint64 b = TFHE.asEuint64(_exchangeMonthlyLimit[_compliance][receiverIdentity]);
        ebool notC = TFHE.le(a, b);

        ebool res = TFHE.or(B, notC);
        res = TFHE.and(notA, res);

        TFHE.allowTransient(res, msg.sender);
        return res;
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
     *  @dev getter for `_exchangeIDs` variable
     *  tells to the caller if an ONCHAINID belongs to an exchange or not
     *  @param _exchangeID ONCHAINID to be checked
     *  returns TRUE if the address corresponds to an exchange, FALSE otherwise
     */
    function isExchangeID(address _exchangeID) public view returns (bool) {
        return _exchangeIDs[_exchangeID];
    }

    /**
     *  @dev getter for `exchangeCounters` variable on the counter parameter of the ExchangeTransferCounter struct
     *  @param compliance the Compliance smart contract to be checked
     *  @param _exchangeID exchange ONCHAINID
     *  @param _investorID ONCHAINID to be checked
     *  returns current monthly counter of `_investorID` on `exchangeID` exchange
     */
    function getMonthlyCounter(
        address compliance,
        address _exchangeID,
        address _investorID
    ) public view returns (euint64) {
        return (_exchangeCounters[compliance][_exchangeID][_investorID]).monthlyCount;
    }

    /**
     *  @dev getter for `exchangeCounters` variable on the timer parameter of the ExchangeTransferCounter struct
     *  @param compliance the Compliance smart contract to be checked
     *  @param _exchangeID exchange ONCHAINID
     *  @param _investorID ONCHAINID to be checked
     *  returns current timer of `_investorID` on `exchangeID` exchange
     */
    function getMonthlyTimer(
        address compliance,
        address _exchangeID,
        address _investorID
    ) public view returns (uint256) {
        return (_exchangeCounters[compliance][_exchangeID][_investorID]).monthlyTimer;
    }

    /**
     *  @dev getter for `exchangeMonthlyLimit` variable
     *  @param compliance the Compliance smart contract to be checked
     *  @param _exchangeID exchange ONCHAINID
     *  returns the monthly limit set for that exchange
     */
    function getExchangeMonthlyLimit(address compliance, address _exchangeID) public view returns (uint256) {
        return _exchangeMonthlyLimit[compliance][_exchangeID];
    }

    /**
     *  @dev See {IModule-name}.
     */
    function name() public pure returns (string memory _name) {
        return "ExchangeMonthlyLimitsModule";
    }

    /**
     *  @dev Checks if monthly cooldown must be reset, then check if _value sent has been exceeded,
     *  if not increases user's OnchainID counters.
     *  @param compliance the Compliance smart contract address
     *  @param _exchangeID ONCHAINID of the exchange
     *  @param _investorID address on which counters will be increased
     *  @param _evalue, value of transaction to be increased
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _increaseExchangeCounters(
        address compliance,
        address _exchangeID,
        address _investorID,
        euint64 _evalue
    ) internal {
        require(
            TFHE.isAllowed(_evalue, address(this)),
            "TFHE: ExchangeMonthlyLimitsModule does not have TFHE permissions to access value argument"
        );

        _resetExchangeMonthlyCooldown(compliance, _exchangeID, _investorID);

        euint64 newV = TFHE.add(_exchangeCounters[compliance][_exchangeID][_investorID].monthlyCount, _evalue);
        TFHE.allow(newV, address(this));
        _exchangeCounters[compliance][_exchangeID][_investorID].monthlyCount = newV;
    }

    /**
     *  @dev resets cooldown for the month if cooldown has reached the time limit of 30days
     *  @param compliance the Compliance smart contract address
     *  @param _exchangeID ONCHAINID of the exchange
     *  @param _investorID ONCHAINID to reset
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _resetExchangeMonthlyCooldown(address compliance, address _exchangeID, address _investorID) internal {
        if (_isExchangeMonthFinished(compliance, _exchangeID, _investorID)) {
            ExchangeTransferCounter storage counter = _exchangeCounters[compliance][_exchangeID][_investorID];
            counter.monthlyTimer = block.timestamp + 30 days;

            euint64 ezero = TFHE.asEuint64(0);
            TFHE.allow(ezero, address(this));

            counter.monthlyCount = ezero;
        }
    }

    /**
     *  @dev checks if the month has finished since the cooldown has been triggered for this identity
     *  @param compliance the Compliance smart contract to be checked
     *  @param _exchangeID ONCHAINID of the exchange
     *  @param _investorID ONCHAINID to be checked
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _isExchangeMonthFinished(
        address compliance,
        address _exchangeID,
        address _investorID
    ) internal view returns (bool) {
        return getMonthlyTimer(compliance, _exchangeID, _investorID) <= block.timestamp;
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
