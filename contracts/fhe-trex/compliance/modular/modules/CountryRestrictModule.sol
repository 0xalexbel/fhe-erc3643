// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, ebool, euint64} from "fhevm/lib/TFHE.sol";
import {AbstractModuleUpgradeable} from "./AbstractModuleUpgradeable.sol";
import {IModularCompliance} from "../IModularCompliance.sol";
import {IToken} from "../../../token/IToken.sol";

contract CountryRestrictModule is AbstractModuleUpgradeable {
    /// Mapping between country and their restriction status per compliance contract
    mapping(address => mapping(uint16 => bool)) private _restrictedCountries;

    /**
     *  this event is emitted whenever a Country has been restricted.
     *  the event is emitted by 'addCountryRestriction' and 'batchRestrictCountries' functions.
     *  `_country` is the numeric ISO 3166-1 of the restricted country.
     */
    event AddedRestrictedCountry(address indexed _compliance, uint16 _country);

    /**
     *  this event is emitted whenever a Country has been unrestricted.
     *  the event is emitted by 'removeCountryRestriction' and 'batchUnrestrictCountries' functions.
     *  `_country` is the numeric ISO 3166-1 of the unrestricted country.
     */
    event RemovedRestrictedCountry(address indexed _compliance, uint16 _country);

    /**
     * @dev initializes the contract and sets the initial state.
     * @notice This function should only be called once during the contract deployment.
     */
    function initialize() external initializer {
        __AbstractModule_init();
    }

    /**
     *  @dev Adds country restriction.
     *  Identities from those countries will be forbidden to manipulate Tokens linked to this Compliance.
     *  @param _country Country to be restricted, should be expressed by following numeric ISO 3166-1 standard
     *  Only the owner of the Compliance smart contract can call this function
     *  emits an `AddedRestrictedCountry` event
     */
    function addCountryRestriction(uint16 _country) external onlyComplianceCall {
        require((_restrictedCountries[msg.sender])[_country] == false, "country already restricted");
        (_restrictedCountries[msg.sender])[_country] = true;
        emit AddedRestrictedCountry(msg.sender, _country);
    }

    /**
     *  @dev Removes country restriction.
     *  Identities from those countries will again be authorised to manipulate Tokens linked to this Compliance.
     *  @param _country Country to be unrestricted, should be expressed by following numeric ISO 3166-1 standard
     *  Can be called only for a compliance contract that is bound to the CountryRestrict Module
     *  Only the owner of the Compliance smart contract can call this function
     *  emits an `RemovedRestrictedCountry` event
     */
    function removeCountryRestriction(uint16 _country) external onlyComplianceCall {
        require((_restrictedCountries[msg.sender])[_country] == true, "country not restricted");
        (_restrictedCountries[msg.sender])[_country] = false;
        emit RemovedRestrictedCountry(msg.sender, _country);
    }

    /**
     *  @dev Adds countries restriction in batch.
     *  Identities from those countries will be forbidden to manipulate Tokens linked to this Compliance.
     *  @param _countries Countries to be restricted, should be expressed by following numeric ISO 3166-1 standard
     *  Can be called only for a compliance contract that is bound to the CountryRestrict Module
     *  Only the owner of the Compliance smart contract can call this function
     *  cannot restrict more than 195 countries in 1 batch
     *  emits _countries.length `AddedRestrictedCountry` events
     */
    function batchRestrictCountries(uint16[] calldata _countries) external onlyComplianceCall {
        require(_countries.length < 195, "maximum 195 can be restricted in one batch");
        for (uint256 i = 0; i < _countries.length; i++) {
            require((_restrictedCountries[msg.sender])[_countries[i]] == false, "country already restricted");
            (_restrictedCountries[msg.sender])[_countries[i]] = true;
            emit AddedRestrictedCountry(msg.sender, _countries[i]);
        }
    }

    /**
     *  @dev Removes country restrictions in batch.
     *  Identities from those countries will again be authorised to manipulate Tokens linked to this Compliance.
     *  @param _countries Countries to be unrestricted, should be expressed by following numeric ISO 3166-1 standard
     *  Can be called only for a compliance contract that is bound to the CountryRestrict Module
     *  cannot unrestrict more than 195 countries in 1 batch
     *  Only the owner of the Compliance smart contract can call this function
     *  emits _countries.length `RemovedRestrictedCountry` events
     */
    function batchUnrestrictCountries(uint16[] calldata _countries) external onlyComplianceCall {
        require(_countries.length < 195, "maximum 195 can be unrestricted in one batch");
        for (uint256 i = 0; i < _countries.length; i++) {
            require((_restrictedCountries[msg.sender])[_countries[i]] == true, "country not restricted");
            (_restrictedCountries[msg.sender])[_countries[i]] = false;
            emit RemovedRestrictedCountry(msg.sender, _countries[i]);
        }
    }

    /**
     *  @dev See {IModule-moduleTransferAction}.
     *  no transfer action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleTransferAction(address _from, address _to, euint64 _value) external override onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleMintAction}.
     *  no mint action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleMintAction(address _to, euint64 _evalue) external override onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleBurnAction}.
     *  no burn action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleBurnAction(address _from, euint64 _evalue) external override onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleCheck}.
     *  checks if the country of address _to is not restricted for this _compliance
     *  returns TRUE if the country of _to is not restricted for this _compliance
     *  returns FALSE if the country of _to is restricted for this _compliance
     */
    function moduleCheck(
        address /*_from*/,
        address _to,
        euint64 /*_value*/,
        address _compliance
    ) external override returns (ebool) {
        uint16 receiverCountry = _getCountry(_compliance, _to);

        bool ok = true;
        if (isCountryRestricted(_compliance, receiverCountry)) {
            ok = false;
        }

        ebool eok = TFHE.asEbool(ok);
        TFHE.allowTransient(eok, msg.sender);
        return eok;
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
     *  @dev Returns true if country is Restricted
     *  @param _country, numeric ISO 3166-1 standard of the country to be checked
     */
    function isCountryRestricted(address _compliance, uint16 _country) public view returns (bool) {
        return ((_restrictedCountries[_compliance])[_country]);
    }

    /**
     *  @dev See {IModule-name}.
     */
    function name() public pure returns (string memory _name) {
        return "CountryRestrictModule";
    }

    /**
     *  @dev function used to get the country of a wallet address.
     *  @param _compliance the compliance contract address for which the country verification is required
     *  @param _userAddress the address of the wallet to be checked
     *  Returns the ISO 3166-1 standard country code of the wallet owner
     *  internal function, used only by the contract itself to process checks on investor countries
     */
    function _getCountry(address _compliance, address _userAddress) internal view returns (uint16) {
        return IToken(IModularCompliance(_compliance).getTokenBound()).identityRegistry().investorCountry(_userAddress);
    }
}
