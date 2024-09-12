#!/bin/bash

run_test () {
  echo "=========================================================="
  echo "Start test: ${1}"
  echo "-----------"

  npx hardhat --network fhevm test ${1}

  if [ $? -ne 0 ] 
  then 
    echo "${1} failed" >&2 
    exit 1
  fi
}

TEST_FILES=$( find ./test -name "*.fhevm.test.ts" )

for file in ${TEST_FILES}; do
  run_test $file
done
