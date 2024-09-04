// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

contract MockContract {
    address private _irRegistry;
    uint16 private _investorCountry;

    function identityRegistry() public view returns (address) {
        address a = (_irRegistry != address(0)) ? _irRegistry : address(this);
        return a;
    }

    function investorCountry(address /*investor*/) public view returns (uint16) {
        return _investorCountry;
    }

    function setInvestorCountry(uint16 country) public {
        _investorCountry = country;
    }
}
