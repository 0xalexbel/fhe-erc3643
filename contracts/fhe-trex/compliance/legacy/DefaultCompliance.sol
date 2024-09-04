// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, euint64, ebool} from "fhevm/lib/TFHE.sol";
import {BasicCompliance} from "./BasicCompliance.sol";

contract DefaultCompliance is BasicCompliance {
    /**
     *  @dev See {ICompliance-transferred}.
     */
    // solhint-disable-next-line no-empty-blocks
    function transferred(address _from, address _to, uint256 _value) external override {}

    /**
     *  @dev See {ICompliance-created}.
     */
    // solhint-disable-next-line no-empty-blocks
    function created(address _to, uint256 _value) external override {}

    /**
     *  @dev See {ICompliance-destroyed}.
     */
    // solhint-disable-next-line no-empty-blocks
    function destroyed(address _from, uint256 _value) external override {}

    /**
     *  @dev See {ICompliance-canTransfer}.
     */
    function canTransfer(address /*_from*/, address /*_to*/, euint64 /*_value*/) external override returns (ebool) {
        ebool eTrue = TFHE.asEbool(true);
        TFHE.allowTransient(eTrue, msg.sender);
        return eTrue;
    }
}
