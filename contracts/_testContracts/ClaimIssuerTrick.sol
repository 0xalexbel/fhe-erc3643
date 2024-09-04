// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

contract ClaimIssuerTrick {
    function isClaimValid(
        address _identity,
        uint256 /*claimTopic*/,
        bytes calldata /*sig*/,
        bytes calldata /*data*/
    ) public view returns (bool) {
        if (msg.sender == _identity) {
            return true;
        }

        revert("ERROR");
    }
}
