// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

import {IImplementationAuthority} from "../interfaces/IImplementationAuthority.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ImplementationAuthority is IImplementationAuthority, Ownable {
    // the address of implementation of ONCHAINID
    address private _implementation;

    constructor(address implementation) Ownable(msg.sender) {
        require(implementation != address(0), "invalid argument - zero address");
        _implementation = implementation;
        emit UpdatedImplementation(implementation);
    }

    /**
     *  @dev See {IImplementationAuthority-updateImplementation}.
     */
    function updateImplementation(address _newImplementation) external override onlyOwner {
        require(_newImplementation != address(0), "invalid argument - zero address");
        _implementation = _newImplementation;
        emit UpdatedImplementation(_newImplementation);
    }

    /**
     *  @dev See {IImplementationAuthority-getImplementation}.
     */
    function getImplementation() external view override returns (address) {
        return _implementation;
    }
}
