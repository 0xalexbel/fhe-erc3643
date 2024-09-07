// // SPDX-License-Identifier: GPL-3.0
// pragma solidity ^0.8.24;

// import {TFHE, euint64, einput, ebool} from "fhevm/lib/TFHE.sol";

// library TFHEext {
//     /**
//      * @dev returns euint64(0) if lhs < rhs otherwise (lhs - rhs)
//      * - lhs can be 0 (uninitialized)
//      * - rhs can be 0 (uninitialized)
//      */
//     function clampedSub(euint64 lhs, euint64 rhs) public returns (euint64) {
//         ebool valid = TFHE.ge(lhs, rhs);
//         euint64 res = TFHE.sub(lhs, rhs);
//         return TFHE.select(valid, res, TFHE.asEuint64(0));
//     }

//     /**
//      * @dev returns underflowValue if lhs < rhs otherwise (lhs - rhs)
//      * - lhs can be 0 (uninitialized)
//      * - rhs can be 0 (uninitialized)
//      */
//     function safeSub(euint64 lhs, euint64 rhs, euint64 underflowValue) public returns (euint64) {
//         ebool valid = TFHE.ge(lhs, rhs);
//         euint64 res = TFHE.sub(lhs, rhs);
//         return TFHE.select(valid, res, underflowValue);
//     }

//     function allowTransientIfNeeded(euint64 value, address account) public {
//         if (!TFHE.isAllowed(value, account)) {
//             TFHE.allowTransient(value, account);
//         }
//     }

//     function getOrZero(euint64 value) public returns (euint64) {
//         if (euint64.unwrap(value) != 0) {
//             return value;
//         }

//         value = TFHE.asEuint64(0);
//         TFHE.allowTransient(value, msg.sender);

//         return value;
//     }

//     // /**
//     //  * return (a <= b - c) ? a : 0
//     //  */
//     // function selectLeSub(euint64 a, euint64 b, euint64 c) public returns (euint64) {
//     //     ebool cond = TFHE.le(a, TFHE.sub(b, c));
//     //     return TFHE.select(cond, a, TFHE.asEuint64(0));
//     // }
// }
