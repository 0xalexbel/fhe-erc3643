// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IProxy {
    /// events

    event ImplementationAuthoritySet(address indexed _implementationAuthority);

    /// functions

    function setImplementationAuthority(address _newImplementationAuthority) external;

    function getImplementationAuthority() external view returns (address);
}
