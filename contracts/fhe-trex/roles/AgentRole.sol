// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, euint64, ebool} from "fhevm/lib/TFHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Roles} from "./Roles.sol";

contract AgentRole is Ownable {
    using Roles for Roles.Role;

    Roles.Role private _agents;

    event AgentAdded(address indexed _agent);
    event AgentRemoved(address indexed _agent);

    modifier onlyAgent() {
        require(isAgent(msg.sender), "AgentRole: caller does not have the Agent role");
        _;
    }

    constructor() Ownable(msg.sender) {}

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
        require(TFHE.isSenderAllowed(value));
        for (uint256 i = 0; i < _agents.bearers.length; ++i) {
            TFHE.allow(value, _agents.bearers[i]);
        }
    }
}
