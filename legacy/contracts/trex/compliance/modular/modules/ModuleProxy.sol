// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ModuleProxy is ERC1967Proxy {
    // solhint-disable-next-line no-empty-blocks
    constructor(address implementation, bytes memory _data) ERC1967Proxy(implementation, _data) {}
}
