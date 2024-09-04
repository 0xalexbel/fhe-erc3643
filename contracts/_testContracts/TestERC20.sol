// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TestERC20 is Ownable, ERC20Pausable {
    constructor(string memory name, string memory symbol) Ownable(msg.sender) ERC20(name, symbol) {}

    function pause() public onlyOwner {
        _pause();
    }

    function mint(address recipient, uint256 amount) public onlyOwner {
        _mint(recipient, amount);
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
