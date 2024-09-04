// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {ITREXFactory} from "../../factory/ITREXFactory.sol";
import {IIAFactory} from "./IIAFactory.sol";
import {TREXImplementationAuthority} from "./TREXImplementationAuthority.sol";
import {ITREXImplementationAuthority} from "./ITREXImplementationAuthority.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract IAFactory is IIAFactory {
    /// variables

    /// address of the trex factory
    address private _trexFactory;

    /// mapping allowing to know if an IA was deployed by the factory or not
    mapping(address => bool) private _deployedByFactory;

    /// functions

    constructor(address trexFactory) {
        _trexFactory = trexFactory;
    }

    /**
     *  @dev See {IIAFactory-deployIA}.
     */
    function deployIA(address _token) external override returns (address) {
        if (ITREXFactory(_trexFactory).getImplementationAuthority() != msg.sender) {
            revert("only reference IA can deploy");
        }
        TREXImplementationAuthority _newIA = new TREXImplementationAuthority(
            false,
            ITREXImplementationAuthority(msg.sender).getTREXFactory(),
            address(this)
        );
        _newIA.fetchVersion(ITREXImplementationAuthority(msg.sender).getCurrentVersion());
        _newIA.useTREXVersion(ITREXImplementationAuthority(msg.sender).getCurrentVersion());
        Ownable(_newIA).transferOwnership(Ownable(_token).owner());
        _deployedByFactory[address(_newIA)] = true;
        emit ImplementationAuthorityDeployed(address(_newIA));
        return address(_newIA);
    }

    /**
     *  @dev See {IIAFactory-deployedByFactory}.
     */
    function deployedByFactory(address _ia) external view override returns (bool) {
        return _deployedByFactory[_ia];
    }
}
