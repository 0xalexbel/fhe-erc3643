// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IClaimIssuer} from "../../../identity/interfaces/IClaimIssuer.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ITrustedIssuersRegistry} from "../interfaces/ITrustedIssuersRegistry.sol";
import {TIRStorage} from "../storage/TIRStorage.sol";

contract TrustedIssuersRegistry is ITrustedIssuersRegistry, OwnableUpgradeable, TIRStorage {
    function init() external initializer {
        __Ownable_init(msg.sender);
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-addTrustedIssuer}.
     */
    function addTrustedIssuer(
        IClaimIssuer _trustedIssuer,
        uint256[] calldata _claimTopics
    ) external override onlyOwner {
        require(address(_trustedIssuer) != address(0), "invalid argument - zero address");
        require(_trustedIssuerClaimTopics[address(_trustedIssuer)].length == 0, "trusted Issuer already exists");
        require(_claimTopics.length > 0, "trusted claim topics cannot be empty");
        require(_claimTopics.length <= 15, "cannot have more than 15 claim topics");
        require(_trustedIssuers.length < 50, "cannot have more than 50 trusted issuers");
        _trustedIssuers.push(_trustedIssuer);
        _trustedIssuerClaimTopics[address(_trustedIssuer)] = _claimTopics;
        for (uint256 i = 0; i < _claimTopics.length; i++) {
            _claimTopicsToTrustedIssuers[_claimTopics[i]].push(_trustedIssuer);
        }
        emit TrustedIssuerAdded(_trustedIssuer, _claimTopics);
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-removeTrustedIssuer}.
     */
    function removeTrustedIssuer(IClaimIssuer _trustedIssuer) external override onlyOwner {
        require(address(_trustedIssuer) != address(0), "invalid argument - zero address");
        require(_trustedIssuerClaimTopics[address(_trustedIssuer)].length != 0, "NOT a trusted issuer");
        uint256 length = _trustedIssuers.length;
        for (uint256 i = 0; i < length; i++) {
            if (_trustedIssuers[i] == _trustedIssuer) {
                _trustedIssuers[i] = _trustedIssuers[length - 1];
                _trustedIssuers.pop();
                break;
            }
        }
        for (
            uint256 claimTopicIndex = 0;
            claimTopicIndex < _trustedIssuerClaimTopics[address(_trustedIssuer)].length;
            claimTopicIndex++
        ) {
            uint256 claimTopic = _trustedIssuerClaimTopics[address(_trustedIssuer)][claimTopicIndex];
            uint256 topicsLength = _claimTopicsToTrustedIssuers[claimTopic].length;
            for (uint256 i = 0; i < topicsLength; i++) {
                if (_claimTopicsToTrustedIssuers[claimTopic][i] == _trustedIssuer) {
                    _claimTopicsToTrustedIssuers[claimTopic][i] = _claimTopicsToTrustedIssuers[claimTopic][
                        topicsLength - 1
                    ];
                    _claimTopicsToTrustedIssuers[claimTopic].pop();
                    break;
                }
            }
        }
        delete _trustedIssuerClaimTopics[address(_trustedIssuer)];
        emit TrustedIssuerRemoved(_trustedIssuer);
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-updateIssuerClaimTopics}.
     */
    function updateIssuerClaimTopics(
        IClaimIssuer _trustedIssuer,
        uint256[] calldata _claimTopics
    ) external override onlyOwner {
        require(address(_trustedIssuer) != address(0), "invalid argument - zero address");
        require(_trustedIssuerClaimTopics[address(_trustedIssuer)].length != 0, "NOT a trusted issuer");
        require(_claimTopics.length <= 15, "cannot have more than 15 claim topics");
        require(_claimTopics.length > 0, "claim topics cannot be empty");

        for (uint256 i = 0; i < _trustedIssuerClaimTopics[address(_trustedIssuer)].length; i++) {
            uint256 claimTopic = _trustedIssuerClaimTopics[address(_trustedIssuer)][i];
            uint256 topicsLength = _claimTopicsToTrustedIssuers[claimTopic].length;
            for (uint256 j = 0; j < topicsLength; j++) {
                if (_claimTopicsToTrustedIssuers[claimTopic][j] == _trustedIssuer) {
                    _claimTopicsToTrustedIssuers[claimTopic][j] = _claimTopicsToTrustedIssuers[claimTopic][
                        topicsLength - 1
                    ];
                    _claimTopicsToTrustedIssuers[claimTopic].pop();
                    break;
                }
            }
        }
        _trustedIssuerClaimTopics[address(_trustedIssuer)] = _claimTopics;
        for (uint256 i = 0; i < _claimTopics.length; i++) {
            _claimTopicsToTrustedIssuers[_claimTopics[i]].push(_trustedIssuer);
        }
        emit ClaimTopicsUpdated(_trustedIssuer, _claimTopics);
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-getTrustedIssuers}.
     */
    function getTrustedIssuers() external view override returns (IClaimIssuer[] memory) {
        return _trustedIssuers;
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-getTrustedIssuersForClaimTopic}.
     */
    function getTrustedIssuersForClaimTopic(uint256 claimTopic) external view override returns (IClaimIssuer[] memory) {
        return _claimTopicsToTrustedIssuers[claimTopic];
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-isTrustedIssuer}.
     */
    function isTrustedIssuer(address _issuer) external view override returns (bool) {
        if (_trustedIssuerClaimTopics[_issuer].length > 0) {
            return true;
        }
        return false;
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-getTrustedIssuerClaimTopics}.
     */
    function getTrustedIssuerClaimTopics(
        IClaimIssuer _trustedIssuer
    ) external view override returns (uint256[] memory) {
        require(_trustedIssuerClaimTopics[address(_trustedIssuer)].length != 0, "trusted Issuer doesn't exist");
        return _trustedIssuerClaimTopics[address(_trustedIssuer)];
    }

    /**
     *  @dev See {ITrustedIssuersRegistry-hasClaimTopic}.
     */
    function hasClaimTopic(address _issuer, uint256 _claimTopic) external view override returns (bool) {
        uint256 length = _trustedIssuerClaimTopics[_issuer].length;
        uint256[] memory claimTopics = _trustedIssuerClaimTopics[_issuer];
        for (uint256 i = 0; i < length; i++) {
            if (claimTopics[i] == _claimTopic) {
                return true;
            }
        }
        return false;
    }
}
