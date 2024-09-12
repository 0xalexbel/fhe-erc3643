#!/bin/bash


# 1. Create a new TREX Token
# ==========================
echo "1. Create a new TREX Token"

NETWORK="fhevm"
# TOKEN="0x47DA632524c03ED15D293e34256D28BD0d38c7a4"
TOKEN=$(npx hardhat --network ${NETWORK} \
    trex setup \
    --mint 10000000 \
    --unpause \
    --json | jq -r .tokenAddress)

BOB_START_BALANCE=$(npx hardhat --network ${NETWORK} \
    token balance \
    --token ${TOKEN} \
    --user "bob" \
    --json | jq -r .value)

ALICE_START_BALANCE=$(npx hardhat --network ${NETWORK} \
    token balance \
    --token ${TOKEN} \
    --user "alice" \
    --json | jq -r .value)

# 2. Create a new transfer manager attached to bob's identity (could be any verified identity)
# ============================================================================================
echo "2. Create a new transfer manager attached to bob's identity (could be any verified identity)"

DVA=$(npx hardhat --network ${NETWORK} \
    transfer-manager create \
    --token ${TOKEN} \
    --identity "bob" \
    --agent "token-owner" \
    --country 1n \
    --json | jq -r .transferManagerAddress)

# 3. Set up the approval process and specify that charlie is an authorized approver
# =================================================================================
echo "3. Set up the approval process and specify that charlie is an authorized approver"

npx hardhat --network ${NETWORK} \
    transfer-manager set-approval-criteria \
    --token ${TOKEN} \
    --dva ${DVA} \
    --agent "token-agent" \
    "charlie"

# 4. Alice approves the Transfer Manager to spend up to 100000 tokens
# ===================================================================
echo "4. Alice approves the Transfer Manager to spend up to 100000 tokens"

npx hardhat --network ${NETWORK} \
    token approve \
    --token ${TOKEN} \
    --caller alice \
    --spender ${DVA} \
    --amount 100000

# 5. initiate a transfer from alice to bob.
# =========================================
# Must be approved by charlie, a token agent ("token-agent") and bob
#   1. Transfer must be approved by token agent: token-agent (includeAgentApprover)
#   2. Transfer must be approved by recipient: bob (includeRecipientApprover)
#   3. Transfer must be approved by by additional approvers: charlie 
echo "5. Initiate a DVA transfer from alice to bob."

TRANSFERID=$(npx hardhat --network ${NETWORK} \
    transfer-manager initiate \
    --token ${TOKEN} \
    --dva ${DVA} \
    --sender "alice" \
    --recipient "bob" \
    --amount 100 \
    --json | jq -r .transferID) 


# 6. Charlie delegates the transfer approval (1/3)
# ================================================
echo "6. Charlie delegates the transfer approval (1/3)"

npx hardhat --network ${NETWORK} \
    transfer-manager sign-delegate-approve \
    --token ${TOKEN} \
    --dva ${DVA} \
    --caller "eve" \
    --transfer-id ${TRANSFERID} \
    "charlie"

# 7. The 'token-agent' delegates the transfer approval (2/3)
# ==========================================================
echo "7. The 'token-agent' delegates the transfer approval (2/3)"

npx hardhat --network ${NETWORK} \
    transfer-manager sign-delegate-approve \
    --token ${TOKEN} \
    --dva ${DVA} \
    --caller "eve" \
    --transfer-id ${TRANSFERID} \
    "token-agent"

# 8. Bob approves the transfer directly (3/3)
# ===========================================
echo "8. Bob approves the transfer directly (3/3)"

npx hardhat --network ${NETWORK} \
    transfer-manager approve \
    --token ${TOKEN} \
    --dva ${DVA} \
    --approver "bob" \
    --transfer-id ${TRANSFERID}


BOB_BALANCE=$(npx hardhat --network ${NETWORK} \
    token balance \
    --token ${TOKEN} \
    --user "bob" \
    --json | jq -r .value)

ALICE_BALANCE=$(npx hardhat --network ${NETWORK} \
    token balance \
    --token ${TOKEN} \
    --user "alice" \
    --json | jq -r .value)

echo ""
echo "9. DVA Transfer finished."
echo "- Alice's balance was ${ALICE_START_BALANCE}, it is now ${ALICE_BALANCE}" 
echo "- Bob's balance was ${BOB_START_BALANCE}, it is now ${BOB_BALANCE}" 

