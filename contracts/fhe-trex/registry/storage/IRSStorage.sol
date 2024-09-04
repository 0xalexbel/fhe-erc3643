// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IIdentity} from "../../../identity/interfaces/IIdentity.sol";

contract IRSStorage {
    // solhint-disable openzeppelin/private-variables
    /// @dev struct containing the identity contract and the country of the user
    struct Identity {
        IIdentity identityContract;
        uint16 investorCountry;
    }
    /// @dev mapping between a user address and the corresponding identity
    mapping(address => Identity) internal _identities;

    /// @dev array of Identity Registries linked to this storage
    address[] internal _identityRegistries;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     */
    uint256[49] private __gap;
}
