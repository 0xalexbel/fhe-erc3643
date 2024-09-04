// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IClaimTopicsRegistry} from "../interfaces/IClaimTopicsRegistry.sol";
import {ITrustedIssuersRegistry} from "../interfaces/ITrustedIssuersRegistry.sol";
import {IIdentityRegistryStorage} from "../interfaces/IIdentityRegistryStorage.sol";

contract IRStorage {
    // solhint-disable openzeppelin/private-variables
    /// @dev Address of the ClaimTopicsRegistry Contract
    IClaimTopicsRegistry internal _tokenTopicsRegistry;

    /// @dev Address of the TrustedIssuersRegistry Contract
    ITrustedIssuersRegistry internal _tokenIssuersRegistry;

    /// @dev Address of the IdentityRegistryStorage Contract
    IIdentityRegistryStorage internal _tokenIdentityStorage;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     */
    uint256[49] private __gap;
}
