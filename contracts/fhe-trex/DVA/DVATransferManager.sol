// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, euint64, einput, ebool} from "fhevm/lib/TFHE.sol";
import {AgentRole} from "../roles/AgentRole.sol";
import {IToken} from "../token/IToken.sol";
import {IDVATransferManager} from "./IDVATransferManager.sol";

contract DVATransferManager is IDVATransferManager {
    // Mapping for token approval criteria
    mapping(address => ApprovalCriteria) private _approvalCriteria;

    // Mapping for transfer requests
    mapping(bytes32 => Transfer) private _transfers;

    // nonce of the transaction allowing the creation of unique transferID
    uint256 private _txNonce;

    constructor() {
        _txNonce = 0;
    }

    /**
     *  @dev See {IDVATransferManager-setApprovalCriteria}
     */
    function setApprovalCriteria(
        address tokenAddress,
        bool includeRecipientApprover,
        bool includeAgentApprover,
        bool sequentialApproval,
        address[] memory additionalApprovers
    ) external {
        if (!AgentRole(tokenAddress).isAgent(msg.sender)) {
            revert OnlyTokenAgentCanCall(tokenAddress);
        }

        if (!IToken(tokenAddress).identityRegistry().isVerified(address(this))) {
            revert DVAManagerIsNotVerifiedForTheToken(tokenAddress);
        }

        bytes32 hash = keccak256(
            abi.encode(tokenAddress, includeRecipientApprover, includeAgentApprover, additionalApprovers)
        );

        _approvalCriteria[tokenAddress] = ApprovalCriteria(
            includeRecipientApprover,
            includeAgentApprover,
            sequentialApproval,
            additionalApprovers,
            hash
        );

        emit ApprovalCriteriaSet(
            tokenAddress,
            includeRecipientApprover,
            includeAgentApprover,
            sequentialApproval,
            additionalApprovers,
            hash
        );
    }

    /**
     *  @dev See {IDVATransferManager-initiateTransfer}
     */
    function initiateTransfer(
        address tokenAddress,
        address recipient,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external {
        // TFHE.allowedTransient(TFHE.asEuint64(encryptedAmount, inputProof), msg.sender) == true
        _initiateTransfer(tokenAddress, recipient, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    function _initiateTransfer(address tokenAddress, address recipient, euint64 eamount) private {
        // Debug
        require(
            TFHE.isSenderAllowed(eamount),
            "TFHE: DVATransferManager does not have TFHE permissions to access amount argument"
        );

        ApprovalCriteria memory approvalCriteria = _approvalCriteria[tokenAddress];
        if (approvalCriteria.hash == bytes32(0)) {
            revert TokenIsNotRegistered(tokenAddress);
        }

        IToken token = IToken(tokenAddress);
        if (!token.identityRegistry().isVerified(recipient)) {
            revert RecipientIsNotVerified(tokenAddress, recipient);
        }

        // Must calculate the actual transfer
        euint64 balanceBefore = token.balanceOf(address(this));

        // required by the transferFrom function
        TFHE.allowTransient(eamount, address(this));
        TFHE.allowTransient(eamount, address(token));
        token.transferFrom(msg.sender, address(this), eamount);

        euint64 balanceAfter = token.balanceOf(address(this));

        euint64 eactualAmount = TFHE.sub(balanceAfter, balanceBefore);
        TFHE.allow(eactualAmount, address(this));

        uint256 nonce = _txNonce++;
        bytes32 transferID = calculateTransferID(nonce, msg.sender, recipient, eamount);

        Transfer storage transfer = _transfers[transferID];
        transfer.tokenAddress = tokenAddress;
        transfer.sender = msg.sender;
        transfer.recipient = recipient;
        transfer.eamount = eamount;
        transfer.eactualAmount = eactualAmount;
        transfer.status = TransferStatus.PENDING;
        transfer.approvalCriteriaHash = approvalCriteria.hash;

        _addApproversToTransfer(transfer, approvalCriteria);
        emit TransferInitiated(
            transferID,
            tokenAddress,
            msg.sender,
            recipient,
            eamount,
            eactualAmount,
            approvalCriteria.hash
        );
    }

    /**
     *  @dev See {IDVATransferManager-approveTransfer}
     */
    function approveTransfer(bytes32 transferID) external {
        Transfer storage transfer = _getPendingTransfer(transferID);
        if (_approvalCriteriaChanged(transferID, transfer)) {
            return;
        }

        bool allApproved = _approveTransfer(transferID, transfer, msg.sender);
        if (allApproved) {
            _completeTransfer(transferID, transfer);
        }
    }

    /**
     *  @dev See {IDVATransferManager-delegateApproveTransfer}
     */
    function delegateApproveTransfer(bytes32 transferID, Signature[] memory signatures) external {
        if (signatures.length == 0) {
            revert SignaturesCanNotBeEmpty(transferID);
        }

        Transfer storage transfer = _getPendingTransfer(transferID);
        if (_approvalCriteriaChanged(transferID, transfer)) {
            return;
        }

        bytes32 transferHash = _generateTransferSignatureHash(transferID);
        for (uint256 i = 0; i < signatures.length; i++) {
            Signature memory signature = signatures[i];
            address signer = ecrecover(transferHash, signature.v, signature.r, signature.s);

            bool allApproved = _approveTransfer(transferID, transfer, signer);
            if (allApproved) {
                _completeTransfer(transferID, transfer);
                return;
            }
        }
    }

    /**
     *  @dev See {IDVATransferManager-cancelTransfer}
     */
    function cancelTransfer(bytes32 transferID) external {
        Transfer storage transfer = _getPendingTransfer(transferID);
        if (msg.sender != transfer.sender) {
            revert OnlyTransferSenderCanCall(transferID);
        }

        transfer.status = TransferStatus.CANCELLED;
        _transferTokensTo(transfer, transfer.sender);
        emit TransferCancelled(transferID);
    }

    /**
     *  @dev See {IDVATransferManager-rejectTransfer}
     */
    function rejectTransfer(bytes32 transferID) external {
        Transfer storage transfer = _getPendingTransfer(transferID);
        if (_approvalCriteriaChanged(transferID, transfer)) {
            return;
        }

        bool rejected = false;
        ApprovalCriteria memory approvalCriteria = _approvalCriteria[transfer.tokenAddress];
        for (uint256 i = 0; i < transfer.approvers.length; i++) {
            Approver storage approver = transfer.approvers[i];
            if (approver.approved) {
                continue;
            }

            if (_canApprove(transfer, approver, msg.sender)) {
                rejected = true;
                break;
            }

            if (approvalCriteria.sequentialApproval) {
                revert ApprovalsMustBeSequential(transferID);
            }
        }

        if (!rejected) {
            revert ApproverNotFound(transferID, msg.sender);
        }

        transfer.status = TransferStatus.REJECTED;
        _transferTokensTo(transfer, transfer.sender);
        emit TransferRejected(transferID, msg.sender);
    }

    /**
     *  @dev See {IDVATransferManager-getApprovalCriteria}
     */
    function getApprovalCriteria(address tokenAddress) external view returns (ApprovalCriteria memory) {
        ApprovalCriteria memory approvalCriteria = _approvalCriteria[tokenAddress];
        if (approvalCriteria.hash == bytes32(0)) {
            revert TokenIsNotRegistered(tokenAddress);
        }

        return approvalCriteria;
    }

    /**
     *  @dev getter for the transfer
     *  @param transferID is the unique ID of the transfer
     *  returns transfer
     */
    function getTransfer(bytes32 transferID) external view returns (Transfer memory) {
        Transfer memory transfer = _transfers[transferID];
        if (transfer.tokenAddress == address(0)) {
            revert InvalidTransferID(transferID);
        }

        return transfer;
    }

    /**
     *  @dev See {IDVATransferManager-getNextApprover}
     */
    function getNextApprover(bytes32 transferID) external view returns (address nextApprover, bool anyTokenAgent) {
        Transfer storage transfer = _getPendingTransfer(transferID);
        for (uint256 i = 0; i < transfer.approvers.length; i++) {
            if (transfer.approvers[i].approved) {
                continue;
            }

            nextApprover = transfer.approvers[i].wallet;
            anyTokenAgent = transfer.approvers[i].anyTokenAgent;
            break;
        }

        return (nextApprover, anyTokenAgent);
    }

    /**
     *  @dev See {IDVATransferManager-getNextTxNonce}
     */
    function getNextTxNonce() external view returns (uint256) {
        return _txNonce;
    }

    /**
     *  @dev See {IDVATransferManager-name}
     */
    function name() external pure returns (string memory _name) {
        return "DVATransferManager";
    }

    /**
     *  @dev See {IDVATransferManager-calculateTransferID}
     */
    function calculateTransferID(
        uint256 _nonce,
        address _sender,
        address _recipient,
        euint64 _eamount
    ) public pure returns (bytes32) {
        bytes32 transferID = keccak256(abi.encode(_nonce, _sender, _recipient, _eamount));
        return transferID;
    }

    // solhint-disable-next-line code-complexity
    function _approveTransfer(
        bytes32 transferID,
        Transfer storage transfer,
        address caller
    ) internal returns (bool allApproved) {
        bool approved = false;
        uint256 pendingApproverCount = 0;
        ApprovalCriteria memory approvalCriteria = _approvalCriteria[transfer.tokenAddress];
        for (uint256 i = 0; i < transfer.approvers.length; i++) {
            Approver storage approver = transfer.approvers[i];
            if (approver.approved) {
                continue;
            }

            if (approved) {
                pendingApproverCount++;
                break;
            }

            if (_canApprove(transfer, approver, caller)) {
                approved = true;
                approver.approved = true;

                if (approver.wallet == address(0)) {
                    approver.wallet = caller;
                }

                emit TransferApproved(transferID, caller);
                continue;
            }

            if (approvalCriteria.sequentialApproval) {
                revert ApprovalsMustBeSequential(transferID);
            }

            pendingApproverCount++;
        }

        if (!approved) {
            revert ApproverNotFound(transferID, caller);
        }

        return pendingApproverCount == 0;
    }

    function _completeTransfer(bytes32 transferID, Transfer storage transfer) internal {
        transfer.status = TransferStatus.COMPLETED;
        _transferTokensTo(transfer, transfer.recipient);
        emit TransferCompleted(
            transferID,
            transfer.tokenAddress,
            transfer.sender,
            transfer.recipient,
            transfer.eamount,
            transfer.eactualAmount
        );
    }

    function _approvalCriteriaChanged(bytes32 transferID, Transfer storage transfer) internal returns (bool) {
        ApprovalCriteria memory approvalCriteria = _approvalCriteria[transfer.tokenAddress];
        if (transfer.approvalCriteriaHash == approvalCriteria.hash) {
            return false;
        }

        delete transfer.approvers;
        _addApproversToTransfer(transfer, approvalCriteria);
        transfer.approvalCriteriaHash = approvalCriteria.hash;
        emit TransferApprovalStateReset(transferID, transfer.approvalCriteriaHash);

        return true;
    }

    function _addApproversToTransfer(Transfer storage transfer, ApprovalCriteria memory approvalCriteria) internal {
        if (approvalCriteria.includeRecipientApprover) {
            transfer.approvers.push(Approver(transfer.recipient, false, false));
        }

        if (approvalCriteria.includeAgentApprover) {
            transfer.approvers.push(Approver(address(0), true, false));
        }

        for (uint256 i = 0; i < approvalCriteria.additionalApprovers.length; i++) {
            transfer.approvers.push(Approver(approvalCriteria.additionalApprovers[i], false, false));
        }
    }

    function _transferTokensTo(Transfer memory transfer, address to) internal {
        // Debug: Only eactualAmount has to be checked!
        require(
            TFHE.isAllowed(transfer.eactualAmount, address(this)),
            "TFHE: DVATransferManager token has not TFHE permissions to access stored actual amount"
        );
        TFHE.allowTransient(transfer.eactualAmount, transfer.tokenAddress);
        IToken(transfer.tokenAddress).transfer(to, transfer.eactualAmount);
    }

    function _canApprove(
        Transfer memory transfer,
        Approver memory approver,
        address caller
    ) internal view returns (bool) {
        return
            approver.wallet == caller ||
            (approver.anyTokenAgent &&
                approver.wallet == address(0) &&
                AgentRole(transfer.tokenAddress).isAgent(caller));
    }

    function _getPendingTransfer(bytes32 transferID) internal view returns (Transfer storage) {
        Transfer storage transfer = _transfers[transferID];
        if (transfer.tokenAddress == address(0)) {
            revert InvalidTransferID(transferID);
        }

        if (transfer.status != TransferStatus.PENDING) {
            revert TransferIsNotInPendingStatus(transferID);
        }

        return transfer;
    }

    function _generateTransferSignatureHash(bytes32 transferID) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", transferID));
    }
}
