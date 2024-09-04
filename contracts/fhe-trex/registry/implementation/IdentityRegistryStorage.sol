// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IIdentity} from "../../../identity/interfaces/IIdentity.sol";

import {AgentRoleUpgradeable} from "../../roles/AgentRoleUpgradeable.sol";
import {IIdentityRegistryStorage} from "../interfaces/IIdentityRegistryStorage.sol";
import {IRSStorage} from "../storage/IRSStorage.sol";

contract IdentityRegistryStorage is IIdentityRegistryStorage, AgentRoleUpgradeable, IRSStorage {
    function init() external initializer {
        __Ownable_init(msg.sender);
    }

    /**
     *  @dev See {IIdentityRegistryStorage-addIdentityToStorage}.
     */
    function addIdentityToStorage(
        address _userAddress,
        IIdentity _identity,
        uint16 _country
    ) external override onlyAgent {
        require(_userAddress != address(0) && address(_identity) != address(0), "invalid argument - zero address");
        require(address(_identities[_userAddress].identityContract) == address(0), "address stored already");
        _identities[_userAddress].identityContract = _identity;
        _identities[_userAddress].investorCountry = _country;
        emit IdentityStored(_userAddress, _identity);
    }

    /**
     *  @dev See {IIdentityRegistryStorage-modifyStoredIdentity}.
     */
    function modifyStoredIdentity(address _userAddress, IIdentity _identity) external override onlyAgent {
        require(_userAddress != address(0) && address(_identity) != address(0), "invalid argument - zero address");
        require(address(_identities[_userAddress].identityContract) != address(0), "address not stored yet");
        IIdentity oldIdentity = _identities[_userAddress].identityContract;
        _identities[_userAddress].identityContract = _identity;
        emit IdentityModified(oldIdentity, _identity);
    }

    /**
     *  @dev See {IIdentityRegistryStorage-modifyStoredInvestorCountry}.
     */
    function modifyStoredInvestorCountry(address _userAddress, uint16 _country) external override onlyAgent {
        require(_userAddress != address(0), "invalid argument - zero address");
        require(address(_identities[_userAddress].identityContract) != address(0), "address not stored yet");
        _identities[_userAddress].investorCountry = _country;
        emit CountryModified(_userAddress, _country);
    }

    /**
     *  @dev See {IIdentityRegistryStorage-removeIdentityFromStorage}.
     */
    function removeIdentityFromStorage(address _userAddress) external override onlyAgent {
        require(_userAddress != address(0), "invalid argument - zero address");
        require(address(_identities[_userAddress].identityContract) != address(0), "address not stored yet");
        IIdentity oldIdentity = _identities[_userAddress].identityContract;
        delete _identities[_userAddress];
        emit IdentityUnstored(_userAddress, oldIdentity);
    }

    /**
     *  @dev See {IIdentityRegistryStorage-bindIdentityRegistry}.
     */
    function bindIdentityRegistry(address _identityRegistry) external override {
        require(_identityRegistry != address(0), "invalid argument - zero address");
        require(_identityRegistries.length < 300, "cannot bind more than 300 IR to 1 IRS");
        addAgent(_identityRegistry);
        _identityRegistries.push(_identityRegistry);
        emit IdentityRegistryBound(_identityRegistry);
    }

    /**
     *  @dev See {IIdentityRegistryStorage-unbindIdentityRegistry}.
     */
    function unbindIdentityRegistry(address _identityRegistry) external override {
        require(_identityRegistry != address(0), "invalid argument - zero address");
        require(_identityRegistries.length > 0, "identity registry is not stored");
        uint256 length = _identityRegistries.length;
        for (uint256 i = 0; i < length; i++) {
            if (_identityRegistries[i] == _identityRegistry) {
                _identityRegistries[i] = _identityRegistries[length - 1];
                _identityRegistries.pop();
                break;
            }
        }
        removeAgent(_identityRegistry);
        emit IdentityRegistryUnbound(_identityRegistry);
    }

    /**
     *  @dev See {IIdentityRegistryStorage-linkedIdentityRegistries}.
     */
    function linkedIdentityRegistries() external view override returns (address[] memory) {
        return _identityRegistries;
    }

    /**
     *  @dev See {IIdentityRegistryStorage-storedIdentity}.
     */
    function storedIdentity(address _userAddress) external view override returns (IIdentity) {
        return _identities[_userAddress].identityContract;
    }

    /**
     *  @dev See {IIdentityRegistryStorage-storedInvestorCountry}.
     */
    function storedInvestorCountry(address _userAddress) external view override returns (uint16) {
        return _identities[_userAddress].investorCountry;
    }
}
