// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {CountryAllowModule} from "../fhe-trex/compliance/modular/modules/CountryAllowModule.sol";

contract TestUpgradedCountryAllowModule is CountryAllowModule {
    /// new field
    uint256 private _newField;

    // setter for _newField
    function setNewField(uint256 value) external onlyOwner {
        _newField = value;
    }

    // getter for _newField
    function getNewField() external view returns (uint256) {
        return _newField;
    }
}
