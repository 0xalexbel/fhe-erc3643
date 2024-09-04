// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, einput, euint64} from "fhevm/lib/TFHE.sol";
import {IIdentity} from "../../../../identity/interfaces/IIdentity.sol";

import {IToken} from "../../../token/IToken.sol";
import {IIdentityRegistry} from "../../../registry/interfaces/IIdentityRegistry.sol";
import {AgentRoles} from "./AgentRoles.sol";
import "hardhat/console.sol";

contract AgentManager is AgentRoles {
    /// @dev the token managed by this AgentManager contract
    IToken private _token;

    constructor(address token_) {
        _token = IToken(token_);
    }

    function callForcedTransfer(
        address _from,
        address _to,
        einput encryptedAmount,
        IIdentity _onchainID,
        bytes calldata inputProof
    ) public {
        callForcedTransfer(_from, _to, TFHE.asEuint64(encryptedAmount, inputProof), _onchainID);
    }

    /**
     *  @dev calls the `forcedTransfer` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-forcedTransfer}.
     *  Requires that `_onchainID` is set as TransferManager on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callForcedTransfer(address _from, address _to, euint64 _eamount, IIdentity _onchainID) public {
        require(
            isTransferManager(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Transfer Manager"
        );
        require(TFHE.isSenderAllowed(_eamount));
        TFHE.allowTransient(_eamount, address(_token));
        _token.forcedTransfer(_from, _to, _eamount);
    }

    /**
     *  @dev calls the `batchForcedTransfer` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-batchForcedTransfer}.
     *  Requires that `_onchainID` is set as TransferManager on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callBatchForcedTransfer(
        address[] calldata _fromList,
        address[] calldata _toList,
        euint64[] calldata _eamounts,
        IIdentity _onchainID
    ) external {
        require(
            isTransferManager(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Transfer Manager"
        );
        _token.batchForcedTransfer(_fromList, _toList, _eamounts);
    }

    /**
     *  @dev calls the `pause` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-pause}.
     *  Requires that `_onchainID` is set as Freezer on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callPause(IIdentity _onchainID) external {
        require(
            isFreezer(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Freezer"
        );
        _token.pause();
    }

    /**
     *  @dev calls the `unpause` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-unpause}.
     *  Requires that `_onchainID` is set as Freezer on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callUnpause(IIdentity _onchainID) external {
        require(
            isFreezer(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Freezer"
        );
        _token.unpause();
    }

    /**
     *  @dev See {AgentManager-callMint}.
     */
    function callMint(address _to, einput encryptedAmount, IIdentity _onchainID, bytes calldata inputProof) public {
        callMint(_to, TFHE.asEuint64(encryptedAmount, inputProof), _onchainID);
    }

    /**
     *  @dev calls the `mint` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-mint}.
     *  Requires that `_onchainID` is set as SupplyModifier on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callMint(address _to, euint64 _eamount, IIdentity _onchainID) public {
        require(
            isSupplyModifier(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Supply Modifier"
        );
        require(TFHE.isSenderAllowed(_eamount));
        TFHE.allowTransient(_eamount, address(_token));
        _token.mint(_to, _eamount);
    }

    /**
     *  @dev calls the `batchMint` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-batchMint}.
     *  Requires that `_onchainID` is set as SupplyModifier on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callBatchMint(address[] calldata _toList, euint64[] calldata _eamounts, IIdentity _onchainID) external {
        require(
            isSupplyModifier(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Supply Modifier"
        );
        _token.batchMint(_toList, _eamounts);
    }

    /**
     *  @dev See {AgentManager-callBurn}.
     */
    function callBurn(address _to, einput encryptedAmount, IIdentity _onchainID, bytes calldata inputProof) public {
        callBurn(_to, TFHE.asEuint64(encryptedAmount, inputProof), _onchainID);
    }

    /**
     *  @dev calls the `burn` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-burn}.
     *  Requires that `_onchainID` is set as SupplyModifier on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callBurn(address _userAddress, euint64 _eamount, IIdentity _onchainID) public {
        require(
            isSupplyModifier(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Supply Modifier"
        );
        require(TFHE.isSenderAllowed(_eamount));
        TFHE.allowTransient(_eamount, address(_token));
        _token.burn(_userAddress, _eamount);
    }

    /**
     *  @dev calls the `batchBurn` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-batchBurn}.
     *  Requires that `_onchainID` is set as SupplyModifier on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callBatchBurn(
        address[] calldata _userAddresses,
        euint64[] calldata _eamounts,
        IIdentity _onchainID
    ) external {
        require(
            isSupplyModifier(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Supply Modifier"
        );
        _token.batchBurn(_userAddresses, _eamounts);
    }

    /**
     *  @dev calls the `setAddressFrozen` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-setAddressFrozen}.
     *  Requires that `_onchainID` is set as Freezer on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callSetAddressFrozen(address _userAddress, bool _freeze, IIdentity _onchainID) external {
        require(
            isFreezer(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Freezer"
        );
        _token.setAddressFrozen(_userAddress, _freeze);
    }

    /**
     *  @dev calls the `batchSetAddressFrozen` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-batchSetAddressFrozen}.
     *  Requires that `_onchainID` is set as Freezer on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callBatchSetAddressFrozen(
        address[] calldata _userAddresses,
        bool[] calldata _freeze,
        IIdentity _onchainID
    ) external {
        require(
            isFreezer(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Freezer"
        );
        _token.batchSetAddressFrozen(_userAddresses, _freeze);
    }

    /**
     *  @dev See {AgentManager-callFreezePartialTokens}.
     */
    function callFreezePartialTokens(
        address _userAddress,
        einput encryptedAmount,
        IIdentity _onchainID,
        bytes calldata inputProof
    ) public {
        callFreezePartialTokens(_userAddress, TFHE.asEuint64(encryptedAmount, inputProof), _onchainID);
    }

    /**
     *  @dev calls the `freezePartialTokens` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-freezePartialTokens}.
     *  Requires that `_onchainID` is set as Freezer on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callFreezePartialTokens(address _userAddress, euint64 _eamount, IIdentity _onchainID) public {
        require(
            isFreezer(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Freezer"
        );
        require(TFHE.isSenderAllowed(_eamount));
        TFHE.allowTransient(_eamount, address(_token));
        _token.freezePartialTokens(_userAddress, _eamount);
    }

    /**
     *  @dev calls the `batchFreezePartialTokens` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-batchFreezePartialTokens}.
     *  Requires that `_onchainID` is set as Freezer on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callBatchFreezePartialTokens(
        address[] calldata _userAddresses,
        euint64[] calldata _eamounts,
        IIdentity _onchainID
    ) external {
        require(
            isFreezer(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Freezer"
        );
        _token.batchFreezePartialTokens(_userAddresses, _eamounts);
    }

    /**
     *  @dev See {AgentManager-callFreezePartialTokens}.
     */
    function callUnfreezePartialTokens(
        address _userAddress,
        einput encryptedAmount,
        IIdentity _onchainID,
        bytes calldata inputProof
    ) public {
        callUnfreezePartialTokens(_userAddress, TFHE.asEuint64(encryptedAmount, inputProof), _onchainID);
    }

    /**
     *  @dev calls the `unfreezePartialTokens` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-unfreezePartialTokens}.
     *  Requires that `_onchainID` is set as Freezer on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callUnfreezePartialTokens(address _userAddress, euint64 _eamount, IIdentity _onchainID) public {
        require(
            isFreezer(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Freezer"
        );
        require(TFHE.isSenderAllowed(_eamount));
        TFHE.allowTransient(_eamount, address(_token));
        _token.unfreezePartialTokens(_userAddress, _eamount);
    }

    /**
     *  @dev calls the `batchUnfreezePartialTokens` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-batchUnfreezePartialTokens}.
     *  Requires that `_onchainID` is set as Freezer on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callBatchUnfreezePartialTokens(
        address[] calldata _userAddresses,
        euint64[] calldata _eamounts,
        IIdentity _onchainID
    ) external {
        require(
            isFreezer(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Freezer"
        );
        _token.batchUnfreezePartialTokens(_userAddresses, _eamounts);
    }

    /**
     *  @dev calls the `recoveryAddress` function on the Token contract
     *  AgentManager has to be set as agent on the token smart contract to process this function
     *  See {IToken-recoveryAddress}.
     *  Requires that `_managerOnchainID` is set as RecoveryAgent on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_managerOnchainID`
     *  @param _managerOnchainID the onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callRecoveryAddress(
        address _lostWallet,
        address _newWallet,
        address _onchainID,
        IIdentity _managerOnchainID
    ) external {
        require(
            isRecoveryAgent(address(_managerOnchainID)) &&
                _managerOnchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT Recovery Agent"
        );
        _token.recoveryAddress(_lostWallet, _newWallet, _onchainID);
    }

    /**
     *  @dev calls the `registerIdentity` function on the Identity Registry contract
     *  AgentManager has to be set as agent on the Identity Registry smart contract to process this function
     *  See {IIdentityRegistry-registerIdentity}.
     *  Requires that `ManagerOnchainID` is set as WhiteListManager on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_managerOnchainID`
     *  @param _managerOnchainID the onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callRegisterIdentity(
        address _userAddress,
        IIdentity _onchainID,
        uint16 _country,
        IIdentity _managerOnchainID
    ) external {
        require(
            isWhiteListManager(address(_managerOnchainID)) &&
                _managerOnchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT WhiteList Manager"
        );
        _token.identityRegistry().registerIdentity(_userAddress, _onchainID, _country);
    }

    /**
     *  @dev calls the `updateIdentity` function on the Identity Registry contract
     *  AgentManager has to be set as agent on the Identity Registry smart contract to process this function
     *  See {IIdentityRegistry-updateIdentity}.
     *  Requires that `_onchainID` is set as WhiteListManager on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callUpdateIdentity(address _userAddress, IIdentity _identity, IIdentity _onchainID) external {
        require(
            isWhiteListManager(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT WhiteList Manager"
        );
        _token.identityRegistry().updateIdentity(_userAddress, _identity);
    }

    /**
     *  @dev calls the `updateCountry` function on the Identity Registry contract
     *  AgentManager has to be set as agent on the Identity Registry smart contract to process this function
     *  See {IIdentityRegistry-updateCountry}.
     *  Requires that `_onchainID` is set as WhiteListManager on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callUpdateCountry(address _userAddress, uint16 _country, IIdentity _onchainID) external {
        require(
            isWhiteListManager(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT WhiteList Manager"
        );
        _token.identityRegistry().updateCountry(_userAddress, _country);
    }

    /**
     *  @dev calls the `deleteIdentity` function on the Identity Registry contract
     *  AgentManager has to be set as agent on the Identity Registry smart contract to process this function
     *  See {IIdentityRegistry-deleteIdentity}.
     *  Requires that `_onchainID` is set as WhiteListManager on the AgentManager contract
     *  Requires that msg.sender is a MANAGEMENT KEY on `_onchainID`
     *  @param _onchainID the _onchainID contract of the caller, e.g. "i call this function and i am Bob"
     */
    function callDeleteIdentity(address _userAddress, IIdentity _onchainID) external {
        require(
            isWhiteListManager(address(_onchainID)) && _onchainID.keyHasPurpose(keccak256(abi.encode(msg.sender)), 2),
            "Role: Sender is NOT WhiteList Manager"
        );
        _token.identityRegistry().deleteIdentity(_userAddress);
    }
}
