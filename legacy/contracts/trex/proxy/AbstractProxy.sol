// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {AbstractProxy} from "./AbstractProxy.sol";

import {IProxy} from "./interfaces/IProxy.sol";
import {ITREXImplementationAuthority} from "./authority/ITREXImplementationAuthority.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract AbstractProxy is IProxy, Initializable {
    /**
     *  @dev See {IProxy-setImplementationAuthority}.
     */
    function setImplementationAuthority(address _newImplementationAuthority) external override {
        require(msg.sender == getImplementationAuthority(), "only current implementationAuthority can call");
        require(_newImplementationAuthority != address(0), "invalid argument - zero address");
        require(
            (ITREXImplementationAuthority(_newImplementationAuthority)).getTokenImplementation() != address(0) &&
                (ITREXImplementationAuthority(_newImplementationAuthority)).getCTRImplementation() != address(0) &&
                (ITREXImplementationAuthority(_newImplementationAuthority)).getIRImplementation() != address(0) &&
                (ITREXImplementationAuthority(_newImplementationAuthority)).getIRSImplementation() != address(0) &&
                (ITREXImplementationAuthority(_newImplementationAuthority)).getMCImplementation() != address(0) &&
                (ITREXImplementationAuthority(_newImplementationAuthority)).getTIRImplementation() != address(0),
            "invalid Implementation Authority"
        );
        _storeImplementationAuthority(_newImplementationAuthority);
        emit ImplementationAuthoritySet(_newImplementationAuthority);
    }

    /**
     *  @dev See {IProxy-getImplementationAuthority}.
     */
    function getImplementationAuthority() public view override returns (address) {
        address implemAuth;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            implemAuth := sload(0x821f3e4d3d679f19eacc940c87acf846ea6eae24a63058ea750304437a62aafc)
        }
        return implemAuth;
    }

    /**
     *  @dev store the implementationAuthority contract address using the ERC-3643 implementation slot in storage
     *  the slot storage is the result of `keccak256("ERC-3643.proxy.beacon")`
     */
    function _storeImplementationAuthority(address implementationAuthority) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(0x821f3e4d3d679f19eacc940c87acf846ea6eae24a63058ea750304437a62aafc, implementationAuthority)
        }
    }
}
