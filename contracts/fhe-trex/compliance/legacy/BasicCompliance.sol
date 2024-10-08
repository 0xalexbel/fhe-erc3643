// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {AgentRole} from "../../roles/AgentRole.sol";
import {ICompliance} from "./ICompliance.sol";
import {IToken} from "../../token/IToken.sol";

abstract contract BasicCompliance is AgentRole, ICompliance {
    /// Mapping between agents and their statuses
    mapping(address => bool) private _tokenAgentsList;

    /// Mapping of tokens linked to the compliance contract
    IToken private _tokenBound;

    /**
     * @dev Throws if called by any address that is not a token bound to the compliance.
     */
    modifier onlyToken() {
        require(_isToken(), "error : this address is not a token bound to the compliance contract");
        _;
    }

    /**
     * @dev Throws if called by any address that is not owner of compliance or agent of the token.
     */
    modifier onlyAdmin() {
        require(
            owner() == msg.sender || (AgentRole(address(_tokenBound))).isAgent(msg.sender),
            "can be called only by Admin address"
        );
        _;
    }

    /**
     *  @dev See {ICompliance-addTokenAgent}.
     *  this function is deprecated, but still implemented to avoid breaking interfaces
     */
    function addTokenAgent(address _agentAddress) external override onlyOwner {
        require(!_tokenAgentsList[_agentAddress], "This Agent is already registered");
        _tokenAgentsList[_agentAddress] = true;
        emit TokenAgentAdded(_agentAddress);
    }

    /**
     *  @dev See {ICompliance-isTokenAgent}.
     */
    function removeTokenAgent(address _agentAddress) external override onlyOwner {
        require(_tokenAgentsList[_agentAddress], "This Agent is not registered yet");
        _tokenAgentsList[_agentAddress] = false;
        emit TokenAgentRemoved(_agentAddress);
    }

    /**
     *  @dev See {ICompliance-bindToken}.
     */
    function bindToken(address _token) external override {
        require(
            owner() == msg.sender || (address(_tokenBound) == address(0) && msg.sender == _token),
            "only owner or token can call"
        );
        _tokenBound = IToken(_token);
        emit TokenBound(_token);
    }

    /**
     *  @dev See {ICompliance-unbindToken}.
     */
    function unbindToken(address _token) external override {
        require(owner() == msg.sender || msg.sender == _token, "only owner or token can call");
        require(_token == address(_tokenBound), "This token is not bound");
        delete _tokenBound;
        emit TokenUnbound(_token);
    }

    /**
     *  @dev See {ICompliance-isTokenAgent}.
     */
    function isTokenAgent(address _agentAddress) public view override returns (bool) {
        if (!_tokenAgentsList[_agentAddress] && !(AgentRole(address(_tokenBound))).isAgent(_agentAddress)) {
            return false;
        }
        return true;
    }

    /**
     *  @dev See {ICompliance-isTokenBound}.
     */
    function isTokenBound(address _token) public view override returns (bool) {
        if (_token != address(_tokenBound)) {
            return false;
        }
        return true;
    }

    /**
     *  @dev Returns true if the sender corresponds to a token that is bound with the Compliance contract
     */
    function _isToken() internal view returns (bool) {
        return isTokenBound(msg.sender);
    }

    /**
     *  @dev Returns the ONCHAINID (Identity) of the _userAddress
     *  @param _userAddress Address of the wallet
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _getIdentity(address _userAddress) internal view returns (address) {
        return address(_tokenBound.identityRegistry().identity(_userAddress));
    }

    /**
     *  @dev Returns the country of residence of the _userAddress
     *  @param _userAddress Address of the wallet
     *  internal function, can be called only from the functions of the Compliance smart contract
     */
    function _getCountry(address _userAddress) internal view returns (uint16) {
        return _tokenBound.identityRegistry().investorCountry(_userAddress);
    }
}
