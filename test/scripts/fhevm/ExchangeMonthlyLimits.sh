#!/bin/bash


TOKEN=$(npx hardhat --network fhevm trex setup --mint 1000 --unpause)
TOKEN=$(echo "$TOKEN" | tail -n1)

echo $TOKEN

npx hardhat --network fhevm token exchangemonthly:add-id --token $TOKEN --owner token-owner --user bob
npx hardhat --network fhevm token exchangemonthly:set-exchange-limit --token $TOKEN --owner token-owner --exchange-id bob --limit 100
npx hardhat --network fhevm token transfer --token $TOKEN --wallet alice --to bob --amount 10

RES=$(npx hardhat --network fhevm token exchangemonthly:get-monthly-counter --token $TOKEN --exchange-id bob --investor-id alice --decrypt)

if [ "$RES" != "10n" ] 
then 
    echo "Test failed, expecting 10n got '${RES}' instead"
    exit 1
else    
    echo "Test succeeded"
fi
