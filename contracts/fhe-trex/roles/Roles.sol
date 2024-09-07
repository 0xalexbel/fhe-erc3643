// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/**
 * @title Roles
 * @dev Library for managing addresses assigned to a Role.
 */
library Roles {
    struct RoleEntry {
        bool hasRole;
        uint256 index;
    }

    struct Role {
        mapping(address => RoleEntry) bearer;
        address[] bearers;
    }

    /**
     * @dev Give an account access to this role.
     */
    function add(Role storage role, address account) internal {
        require(!has(role, account), "Roles: account already has role");
        uint256 index = role.bearers.length;
        role.bearer[account].hasRole = true;
        role.bearer[account].index = index;
        role.bearers.push(account);
    }

    /**
     * @dev Remove an account's access to this role.
     */
    function remove(Role storage role, address account) internal {
        require(has(role, account), "Roles: account does not have role");

        uint256 nBearers = role.bearers.length;
        // debug
        require(nBearers > 0, "Debug role.bearers should not be empty");

        uint256 lastIndex = nBearers - 1;
        uint256 accountIndex = role.bearer[account].index;

        if (accountIndex < lastIndex) {
            address lastAccount = role.bearers[lastIndex];
            uint256 lastAccountNewIndex = accountIndex;

            // debug
            require(lastAccount != account);

            role.bearers[lastAccountNewIndex] = lastAccount;
            role.bearer[lastAccount].index = lastAccountNewIndex;
        }

        role.bearer[account].hasRole = false;
        role.bearer[account].index = 0;

        role.bearers.pop();
    }

    /**
     * @dev Check if an account has this role.
     * @return bool
     */
    function has(Role storage role, address account) internal view returns (bool) {
        require(account != address(0), "Roles: account is the zero address");
        bool hasRole = role.bearer[account].hasRole;

        // debug
        require(!hasRole || role.bearers[role.bearer[account].index] == account);

        return hasRole;
    }
}
