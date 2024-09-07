// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, euint64, ebool} from "fhevm/lib/TFHE.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Roles} from "./Roles.sol";
import "hardhat/console.sol";

contract AgentRoleUpgradeable is OwnableUpgradeable {
    using Roles for Roles.Role;

    Roles.Role private _agents;

    event AgentAdded(address indexed _agent);
    event AgentRemoved(address indexed _agent);

    modifier onlyAgent() {
        require(isAgent(msg.sender), "AgentRole: caller does not have the Agent role");
        _;
    }

    function addAgent(address _agent) public onlyOwner {
        require(_agent != address(0), "invalid argument - zero address");
        _agents.add(_agent);
        emit AgentAdded(_agent);
    }

    function removeAgent(address _agent) public onlyOwner {
        require(_agent != address(0), "invalid argument - zero address");
        _agents.remove(_agent);
        emit AgentRemoved(_agent);
    }

    function isAgent(address _agent) public view returns (bool) {
        return _agents.has(_agent);
    }

    function allowAgents(euint64 value) public onlyAgent {
        // console.log("alloAgents= %s count=%s", msg.sender, _agents.bearers.length);
        // console.log("value=%s isSenderAllowed=%s", euint64.unwrap(value), TFHE.isSenderAllowed(value));

        require(TFHE.isSenderAllowed(value), "TFHE: agent does not have TFHE permissions to allow other agents");
        for (uint256 i = 0; i < _agents.bearers.length; ++i) {
            address b = _agents.bearers[i];
            if (b != msg.sender) {
                //console.log("  TFHE.allow(%s) %s/%s", _agents.bearers[i], i, _agents.bearers.length);
                TFHE.allow(value, _agents.bearers[i]);
            }
        }
    }
}
