// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IClaimIssuer} from "../interfaces/IClaimIssuer.sol";
import {IIdentity} from "../interfaces/IIdentity.sol";

contract Verifier is Ownable {
    /// @dev All topics of claims required to pass verification.
    uint256[] private _requiredClaimTopics;

    /// @dev Array containing all TrustedIssuers identity contract address allowed to issue claims required.
    IClaimIssuer[] private _trustedIssuers;

    /// @dev Mapping between a trusted issuer address and the topics of claims they are trusted for.
    mapping(address => uint256[]) private _trustedIssuerClaimTopics;

    /// @dev Mapping between a claim topic and the trusted issuers trusted for it.
    mapping(uint256 => IClaimIssuer[]) private _claimTopicsToTrustedIssuers;

    /**
     *  this event is emitted when a claim topic has been added to the requirement list
     *  the event is emitted by the 'addClaimTopic' function
     *  `claimTopic` is the required claim topic added
     */
    event ClaimTopicAdded(uint256 indexed claimTopic);

    /**
     *  this event is emitted when a claim topic has been removed from the requirement list
     *  the event is emitted by the 'removeClaimTopic' function
     *  `claimTopic` is the required claim removed
     */
    event ClaimTopicRemoved(uint256 indexed claimTopic);

    /**
     *  this event is emitted when an issuer is added to the trusted list.
     *  the event is emitted by the addTrustedIssuer function
     *  `trustedIssuer` is the address of the trusted issuer's ClaimIssuer contract
     *  `claimTopics` is the set of claims that the trusted issuer is allowed to emit
     */
    event TrustedIssuerAdded(IClaimIssuer indexed trustedIssuer, uint256[] claimTopics);

    /**
     *  this event is emitted when an issuer is removed from the trusted list.
     *  the event is emitted by the removeTrustedIssuer function
     *  `trustedIssuer` is the address of the trusted issuer's ClaimIssuer contract
     */
    event TrustedIssuerRemoved(IClaimIssuer indexed trustedIssuer);

    /**
     *  this event is emitted when the set of claim topics is changed for a given trusted issuer.
     *  the event is emitted by the updateIssuerClaimTopics function
     *  `trustedIssuer` is the address of the trusted issuer's ClaimIssuer contract
     *  `claimTopics` is the set of claims that the trusted issuer is allowed to emit
     */
    event ClaimTopicsUpdated(IClaimIssuer indexed trustedIssuer, uint256[] claimTopics);

    modifier onlyVerifiedSender() {
        require(verify(_msgSender()), "sender is not verified");
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     *  @dev See {IClaimTopicsRegistry-removeClaimTopic}.
     */
    function addClaimTopic(uint256 claimTopic) public onlyOwner {
        uint256 length = _requiredClaimTopics.length;
        require(length < 15, "cannot require more than 15 topics");
        for (uint256 i = 0; i < length; i++) {
            require(_requiredClaimTopics[i] != claimTopic, "claimTopic already exists");
        }
        _requiredClaimTopics.push(claimTopic);
        emit ClaimTopicAdded(claimTopic);
    }

    /**
     *  @dev See {IClaimTopicsRegistry-getClaimTopics}.
     */
    function removeClaimTopic(uint256 claimTopic) public onlyOwner {
        uint256 length = _requiredClaimTopics.length;
        for (uint256 i = 0; i < length; i++) {
            if (_requiredClaimTopics[i] == claimTopic) {
                _requiredClaimTopics[i] = _requiredClaimTopics[length - 1];
                _requiredClaimTopics.pop();
                emit ClaimTopicRemoved(claimTopic);
                break;
            }
        }
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-addTrustedIssuer}.
     */
    function addTrustedIssuer(IClaimIssuer trustedIssuer, uint256[] calldata claimTopics) public onlyOwner {
        require(address(trustedIssuer) != address(0), "invalid argument - zero address");
        require(_trustedIssuerClaimTopics[address(trustedIssuer)].length == 0, "trusted Issuer already exists");
        require(claimTopics.length > 0, "trusted claim topics cannot be empty");
        require(claimTopics.length <= 15, "cannot have more than 15 claim topics");
        require(_trustedIssuers.length < 50, "cannot have more than 50 trusted issuers");
        _trustedIssuers.push(trustedIssuer);
        _trustedIssuerClaimTopics[address(trustedIssuer)] = claimTopics;
        for (uint256 i = 0; i < claimTopics.length; i++) {
            _claimTopicsToTrustedIssuers[claimTopics[i]].push(trustedIssuer);
        }
        emit TrustedIssuerAdded(trustedIssuer, claimTopics);
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-removeTrustedIssuer}.
     */
    function removeTrustedIssuer(IClaimIssuer trustedIssuer) public onlyOwner {
        require(address(trustedIssuer) != address(0), "invalid argument - zero address");
        require(_trustedIssuerClaimTopics[address(trustedIssuer)].length != 0, "NOT a trusted issuer");
        uint256 length = _trustedIssuers.length;
        for (uint256 i = 0; i < length; i++) {
            if (_trustedIssuers[i] == trustedIssuer) {
                _trustedIssuers[i] = _trustedIssuers[length - 1];
                _trustedIssuers.pop();
                break;
            }
        }
        for (
            uint256 claimTopicIndex = 0;
            claimTopicIndex < _trustedIssuerClaimTopics[address(trustedIssuer)].length;
            claimTopicIndex++
        ) {
            uint256 claimTopic = _trustedIssuerClaimTopics[address(trustedIssuer)][claimTopicIndex];
            uint256 topicsLength = _claimTopicsToTrustedIssuers[claimTopic].length;
            for (uint256 i = 0; i < topicsLength; i++) {
                if (_claimTopicsToTrustedIssuers[claimTopic][i] == trustedIssuer) {
                    _claimTopicsToTrustedIssuers[claimTopic][i] = _claimTopicsToTrustedIssuers[claimTopic][
                        topicsLength - 1
                    ];
                    _claimTopicsToTrustedIssuers[claimTopic].pop();
                    break;
                }
            }
        }
        delete _trustedIssuerClaimTopics[address(trustedIssuer)];
        emit TrustedIssuerRemoved(trustedIssuer);
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-updateIssuerClaimTopics}.
     */
    function updateIssuerClaimTopics(IClaimIssuer trustedIssuer, uint256[] calldata newClaimTopics) public onlyOwner {
        require(address(trustedIssuer) != address(0), "invalid argument - zero address");
        require(_trustedIssuerClaimTopics[address(trustedIssuer)].length != 0, "NOT a trusted issuer");
        require(newClaimTopics.length <= 15, "cannot have more than 15 claim topics");
        require(newClaimTopics.length > 0, "claim topics cannot be empty");

        for (uint256 i = 0; i < _trustedIssuerClaimTopics[address(trustedIssuer)].length; i++) {
            uint256 claimTopic = _trustedIssuerClaimTopics[address(trustedIssuer)][i];
            uint256 topicsLength = _claimTopicsToTrustedIssuers[claimTopic].length;
            for (uint256 j = 0; j < topicsLength; j++) {
                if (_claimTopicsToTrustedIssuers[claimTopic][j] == trustedIssuer) {
                    _claimTopicsToTrustedIssuers[claimTopic][j] = _claimTopicsToTrustedIssuers[claimTopic][
                        topicsLength - 1
                    ];
                    _claimTopicsToTrustedIssuers[claimTopic].pop();
                    break;
                }
            }
        }
        _trustedIssuerClaimTopics[address(trustedIssuer)] = newClaimTopics;
        for (uint256 i = 0; i < newClaimTopics.length; i++) {
            _claimTopicsToTrustedIssuers[newClaimTopics[i]].push(trustedIssuer);
        }
        emit ClaimTopicsUpdated(trustedIssuer, newClaimTopics);
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-getTrustedIssuers}.
     */
    function getTrustedIssuers() public view returns (IClaimIssuer[] memory) {
        return _trustedIssuers;
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-getTrustedIssuersForClaimTopic}.
     */
    function getTrustedIssuersForClaimTopic(uint256 claimTopic) public view returns (IClaimIssuer[] memory) {
        return _claimTopicsToTrustedIssuers[claimTopic];
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-isTrustedIssuer}.
     */
    function isTrustedIssuer(address issuer) public view returns (bool) {
        if (_trustedIssuerClaimTopics[issuer].length > 0) {
            return true;
        }
        return false;
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-getTrustedIssuerClaimTopics}.
     */
    function getTrustedIssuerClaimTopics(IClaimIssuer trustedIssuer) public view returns (uint256[] memory) {
        require(_trustedIssuerClaimTopics[address(trustedIssuer)].length != 0, "trusted Issuer doesn't exist");
        return _trustedIssuerClaimTopics[address(trustedIssuer)];
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-hasClaimTopic}.
     */
    function hasClaimTopic(address issuer, uint256 claimTopic) public view returns (bool) {
        uint256[] memory claimTopics = _trustedIssuerClaimTopics[issuer];
        uint256 length = claimTopics.length;
        for (uint256 i = 0; i < length; i++) {
            if (claimTopics[i] == claimTopic) {
                return true;
            }
        }
        return false;
    }

    function isClaimTopicRequired(uint256 claimTopic) public view returns (bool) {
        uint256 length = _requiredClaimTopics.length;

        for (uint256 i = 0; i < length; i++) {
            if (_requiredClaimTopics[i] == claimTopic) {
                return true;
            }
        }

        return false;
    }

    /**
     * @dev Verify an identity (ONCHAINID) by checking if the identity has at least one valid claim from a trusted
     * issuer for each required claim topic. Returns true if the identity is compliant, false otherwise.
     */
    function verify(address identity) public view returns (bool isVerified) {
        if (_requiredClaimTopics.length == 0) {
            return true;
        }

        uint256 foundClaimTopic;
        uint256 scheme;
        address issuer;
        bytes memory sig;
        bytes memory data;
        uint256 claimTopic;
        for (claimTopic = 0; claimTopic < _requiredClaimTopics.length; claimTopic++) {
            IClaimIssuer[] memory trustedIssuersForClaimTopic = this.getTrustedIssuersForClaimTopic(
                _requiredClaimTopics[claimTopic]
            );

            if (trustedIssuersForClaimTopic.length == 0) {
                return false;
            }

            bytes32[] memory claimIds = new bytes32[](trustedIssuersForClaimTopic.length);
            for (uint256 i = 0; i < trustedIssuersForClaimTopic.length; i++) {
                claimIds[i] = keccak256(abi.encode(trustedIssuersForClaimTopic[i], _requiredClaimTopics[claimTopic]));
            }

            for (uint256 j = 0; j < claimIds.length; j++) {
                (foundClaimTopic, scheme, issuer, sig, data, ) = IIdentity(identity).getClaim(claimIds[j]);

                if (foundClaimTopic == _requiredClaimTopics[claimTopic]) {
                    try
                        IClaimIssuer(issuer).isClaimValid(
                            IIdentity(identity),
                            _requiredClaimTopics[claimTopic],
                            sig,
                            data
                        )
                    returns (bool _validity) {
                        if (_validity) {
                            j = claimIds.length;
                        }
                        if (!_validity && j == (claimIds.length - 1)) {
                            return false;
                        }
                    } catch {
                        if (j == (claimIds.length - 1)) {
                            return false;
                        }
                    }
                } else if (j == (claimIds.length - 1)) {
                    return false;
                }
            }
        }

        return true;
    }
}
