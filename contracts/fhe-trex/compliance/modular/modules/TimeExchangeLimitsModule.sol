// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, ebool, euint64, einput} from "fhevm/lib/TFHE.sol";
import {IModularCompliance} from "../IModularCompliance.sol";
import {IToken} from "../../../token/IToken.sol";
import {AgentRole} from "../../../roles/AgentRole.sol";
import {AbstractModuleUpgradeable} from "./AbstractModuleUpgradeable.sol";

contract TimeExchangeLimitsModule is AbstractModuleUpgradeable {
    /// Struct of transfer Counters
    struct ExchangeTransferCounter {
        euint64 value;
        uint256 timer;
    }

    struct Limit {
        uint32 limitTime;
        euint64 limitValue;
    }

    struct InputLimit {
        uint32 limitTime;
        einput limitValue;
    }

    struct IndexLimit {
        bool attributedLimit;
        uint8 limitIndex;
    }

    // Mapping for limit time indexes
    mapping(address => mapping(address => mapping(uint32 => IndexLimit))) private _limitValues;

    /// Getter for Tokens Exchange Limits
    mapping(address => mapping(address => Limit[])) private _exchangeLimits;

    /// Mapping for users Counters
    mapping(address => mapping(address => mapping(address => mapping(uint32 => ExchangeTransferCounter))))
        private _exchangeCounters;

    /// Mapping for wallets tagged as exchange wallets
    mapping(address => bool) private _exchangeIDs;

    /**
     *  this event is emitted whenever an exchange limit is updated for the given compliance address
     *  the event is emitted by 'setExchangeLimit'.
     *  compliance`is the compliance contract address
     *  _exchangeID is the ONCHAINID of the exchange
     *  _limitValue is the new limit value for the given limit time
     *  _limitTime is the period of time of the limit
     */
    event ExchangeLimitUpdated(address indexed compliance, address _exchangeID, euint64 _limitValue, uint32 _limitTime);

    /**
     *  this event is emitted whenever an ONCHAINID is tagged as an exchange ID.
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

    error LimitsArraySizeExceeded(address compliance, uint8 arraySize);

    /**
     * @dev initializes the contract and sets the initial state.
     * @notice This function should only be called once during the contract deployment.
     */
    function initialize() external initializer {
        __AbstractModule_init();
    }

    function setExchangeLimit(
        address _exchangeID,
        uint32 _limitTime,
        einput _limitValue,
        bytes calldata inputProof
    ) public onlyComplianceCall {
        Limit memory l;
        l.limitTime = _limitTime;
        l.limitValue = TFHE.asEuint64(_limitValue, inputProof);
        setExchangeLimit(_exchangeID, l);
    }

    /**
     *  @dev Sets the limit of tokens allowed to be transferred to the given exchangeID in a given period of time
     *  @param _exchangeID ONCHAINID of the exchange
     *  @param _limit The limit time and value
     *  Only the Compliance smart contract can call this function
     *  emits an `ExchangeLimitUpdated` event
     */
    function setExchangeLimit(address _exchangeID, Limit memory _limit) public onlyComplianceCall {
        require(
            TFHE.isSenderAllowed(_limit.limitValue),
            "TFHE: TimeExchangeLimitsModule caller does not have TFHE permissions to access limit argument"
        );
        TFHE.allow(_limit.limitValue, address(this));
        TFHE.allow(_limit.limitValue, msg.sender); // compliance

        bool limitIsAttributed = _limitValues[msg.sender][_exchangeID][_limit.limitTime].attributedLimit;
        uint8 limitCount = uint8(_exchangeLimits[msg.sender][_exchangeID].length);
        if (!limitIsAttributed && limitCount >= 4) {
            revert LimitsArraySizeExceeded(msg.sender, limitCount);
        }

        if (!limitIsAttributed && limitCount < 4) {
            _exchangeLimits[msg.sender][_exchangeID].push(_limit);
            _limitValues[msg.sender][_exchangeID][_limit.limitTime] = IndexLimit(true, limitCount);
        } else {
            _exchangeLimits[msg.sender][_exchangeID][
                _limitValues[msg.sender][_exchangeID][_limit.limitTime].limitIndex
            ] = _limit;
        }

        emit ExchangeLimitUpdated(msg.sender, _exchangeID, _limit.limitValue, _limit.limitTime);
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
        require(
            TFHE.isAllowed(_evalue, address(this)),
            "TFHE: TimeExchangeLimitsModule does not have TFHE permissions to access value argument"
        );

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
            "TFHE: TimeExchangeLimitsModule does not have TFHE permissions to access value argument"
        );

        ebool eTrue = TFHE.asEbool(true);
        TFHE.allowTransient(eTrue, msg.sender);

        if (_from == address(0) || _isTokenAgent(_compliance, _from)) {
            return eTrue;
        }

        address senderIdentity = _getIdentity(_compliance, _from);

        // senderIdentity = bobID
        if (isExchangeID(senderIdentity)) {
            return eTrue;
        }

        address receiverIdentity = _getIdentity(_compliance, _to);
        if (!isExchangeID(receiverIdentity)) {
            return eTrue;
        }

        // for (uint256 i = 0; i < _exchangeLimits[_compliance][receiverIdentity].length; i++) {
        //     if (_value > _exchangeLimits[_compliance][receiverIdentity][i].limitValue) {
        //         return false;
        //     }
        //     uint32 limitTime = _exchangeLimits[_compliance][receiverIdentity][i].limitTime;
        //     if (
        //         !_isExchangeCounterFinished(_compliance, receiverIdentity, senderIdentity, limitTime) &&
        //         _exchangeCounters[_compliance][receiverIdentity][senderIdentity][limitTime].value + _value >
        //         _exchangeLimits[_compliance][receiverIdentity][i].limitValue
        //     ) {
        //         return false;
        //     }
        // }
        // return true;

        ebool res = TFHE.asEbool(true);

        for (uint256 i = 0; i < _exchangeLimits[_compliance][receiverIdentity].length; i++) {
            uint32 limitTime = _exchangeLimits[_compliance][receiverIdentity][i].limitTime;

            euint64 receiverLimitValue = _exchangeLimits[_compliance][receiverIdentity][i].limitValue;
            euint64 senderLimitValue = _exchangeCounters[_compliance][receiverIdentity][senderIdentity][limitTime]
                .value;

            if (euint64.unwrap(receiverLimitValue) != 0 && !TFHE.isAllowed(receiverLimitValue, address(this))) {
                revert(
                    "TFHE: TimeExchangeLimitsModule does not have TFHE permissions to access receiver stored limit value"
                );
            }
            if (euint64.unwrap(senderLimitValue) != 0 && !TFHE.isAllowed(senderLimitValue, address(this))) {
                revert("TFHE: TimeExchangeLimitsModule does not have TFHE permissions to access sender stored value");
            }

            // Condition 1:
            // ------------
            // 1. if (_value > _exchangeLimits[_compliance][receiverIdentity][i].limitValue) {
            //    return false;
            //  }
            //
            // notB1 = !(_value > _exchangeLimits[_compliance][receiverIdentity][i].limitValue)
            ebool notB1 = TFHE.le(_evalue, receiverLimitValue);
            res = TFHE.and(res, notB1);

            // Condition 2:
            // ------------
            // if (
            //     !_isExchangeCounterFinished(_compliance, receiverIdentity, senderIdentity, limitTime) &&
            //     _exchangeCounters[_compliance][receiverIdentity][senderIdentity][limitTime].value + _value >
            //     _exchangeLimits[_compliance][receiverIdentity][i].limitValue
            // ) {
            //     return false;
            // }
            //
            // notB2 = notA || notB
            // notA = _isExchangeCounterFinished(_compliance, receiverIdentity, senderIdentity, limitTime)
            // notB = (_exchangeCounters[_compliance][receiverIdentity][senderIdentity][limitTime].value + _value <= _exchangeLimits[_compliance][receiverIdentity][i].limitValue)

            // _isExchangeCounterFinished(_compliance, receiverIdentity, senderIdentity, limitTime)
            ebool notA = TFHE.asEbool(
                _isExchangeCounterFinished(_compliance, receiverIdentity, senderIdentity, limitTime)
            );

            // !(_exchangeCounters[_compliance][receiverIdentity][senderIdentity][limitTime].value + _value > _exchangeLimits[_compliance][receiverIdentity][i].limitValue)
            euint64 a = TFHE.add(senderLimitValue, _evalue);
            ebool notB = TFHE.le(a, receiverLimitValue);

            // notB2 = notA || notB
            ebool notB2 = TFHE.or(notA, notB);

            res = TFHE.and(res, notB2);
        }

        TFHE.allowTransient(res, msg.sender);
        return res;
    }

    /**
     *  @dev getter for `exchangeCounters` variable on the timer parameter of the ExchangeTransferCounter struct
     *  @param compliance the compliance smart contract address to be checked
     *  @param _exchangeID the ONCHAINID of the exchange
     *  @param _investorID the ONCHAINID of the investor to be checked
     *  @param _limitTime limit time frame
     *  returns the counter of the given `_limitTime`, `_investorID`, and `exchangeID`
     */
    function getExchangeCounter(
        address compliance,
        address _exchangeID,
        address _investorID,
        uint32 _limitTime
    ) external view returns (ExchangeTransferCounter memory) {
        return _exchangeCounters[compliance][_exchangeID][_investorID][_limitTime];
    }

    /**
     *  @dev getter for `exchangeLimit` variable
     *  @param compliance the Compliance smart contract to be checked
     *  @param _exchangeID exchange ONCHAINID
     *  returns the array of limits set for that exchange
     */
    function getExchangeLimits(address compliance, address _exchangeID) external view returns (Limit[] memory) {
        return _exchangeLimits[compliance][_exchangeID];
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
     *  @dev See {IModule-name}.
     */
    function name() public pure returns (string memory _name) {
        return "TimeExchangeLimitsModule";
    }

    /**
     *  @dev Checks if cooldown must be reset, then check if _value sent has been exceeded,
     *  if not increases user's OnchainID counters.
     *  @param compliance the Compliance smart contract address
     *  @param _exchangeID ONCHAINID of the exchange
     *  @param _investorID address on which counters will be increased
     *  @param _value, value of transaction)to be increased
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _increaseExchangeCounters(
        address compliance,
        address _exchangeID,
        address _investorID,
        euint64 _value
    ) internal {
        require(
            TFHE.isAllowed(_value, address(this)),
            "TFHE: TimeExchangeLimitsModule does not have TFHE permissions to access value argument"
        );

        for (uint256 i = 0; i < _exchangeLimits[compliance][_exchangeID].length; i++) {
            uint32 limitTime = _exchangeLimits[compliance][_exchangeID][i].limitTime;
            _resetExchangeLimitCooldown(compliance, _exchangeID, _investorID, limitTime);

            euint64 v = _exchangeCounters[compliance][_exchangeID][_investorID][limitTime].value;

            if (euint64.unwrap(v) == 0) {
                v = TFHE.asEuint64(0);
            }

            if (!TFHE.isAllowed(v, address(this))) {
                revert("TFHE: TimeExchangeLimitsModule does not have TFHE permissions to access to stored limit value");
            }

            euint64 newV = TFHE.add(v, _value);

            TFHE.allow(newV, address(this));

            _exchangeCounters[compliance][_exchangeID][_investorID][limitTime].value = newV;
        }
    }

    /**
     *  @dev resets cooldown for the month if cooldown has reached the time limit of 30days
     *  @param compliance the Compliance smart contract address
     *  @param _exchangeID ONCHAINID of the exchange
     *  @param _investorID ONCHAINID to reset
     *  @param _limitTime limit time frame
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _resetExchangeLimitCooldown(
        address compliance,
        address _exchangeID,
        address _investorID,
        uint32 _limitTime
    ) internal {
        if (_isExchangeCounterFinished(compliance, _exchangeID, _investorID, _limitTime)) {
            ExchangeTransferCounter storage counter = _exchangeCounters[compliance][_exchangeID][_investorID][
                _limitTime
            ];

            counter.timer = block.timestamp + _limitTime;
            counter.value = TFHE.asEuint64(0);

            TFHE.allow(counter.value, address(this));
        }
    }

    /**
     *  @dev checks if the counter time frame has finished since the cooldown has been triggered for this exchange and identity
     *  @param _compliance the Compliance smart contract to be checked
     *  @param _exchangeID ONCHAINID of the exchange
     *  @param _identity ONCHAINID of user wallet
     *  @param _limitTime limit time frame
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _isExchangeCounterFinished(
        address _compliance,
        address _exchangeID,
        address _identity,
        uint32 _limitTime
    ) internal view returns (bool) {
        return _exchangeCounters[_compliance][_exchangeID][_identity][_limitTime].timer <= block.timestamp;
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
