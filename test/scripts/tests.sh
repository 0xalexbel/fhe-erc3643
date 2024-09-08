#!/bin/bash

run_test () {
  npx hardhat test ${1}
  if [ $? -ne 0 ] 
  then 
    echo "${1} failed" >&2 
    exit 1
  fi
}

TEST_FILES=$( find ./test -name "*.test.ts" )

for file in ${TEST_FILES}; do
  run_test $file
done

# npx hardhat test ./test/fhe-trex/token/token-recovery.test.ts
# npx hardhat test ./test/fhe-trex/token/token-information.test.ts
# npx hardhat test ./test/fhe-trex/token/token-transfer.test.ts
# npx hardhat test ./test/fhe-trex/dva.clear.test.ts
# npx hardhat test ./test/fhe-trex/registries/identity-registry-storage.test.ts
# npx hardhat test ./test/fhe-trex/registries/trusted-issuers-registry.test.ts
# npx hardhat test ./test/fhe-trex/registries/identity-registry.test.ts
# npx hardhat test ./test/fhe-trex/registries/claim-topics-registry.test.ts
# npx hardhat test ./test/fhe-trex/agentRole.test.ts
# npx hardhat test ./test/fhe-trex/dva.enc.test.ts
# npx hardhat test ./test/fhe-trex/gateway.test.ts
# npx hardhat test ./test/fhe-trex/authorities/trex-implementation-authority.test.ts
# npx hardhat test ./test/fhe-trex/compliance.test.ts
# npx hardhat test ./test/fhe-trex/compliances/module-supply-limit.test.ts
# npx hardhat test ./test/fhe-trex/compliances/module-time-exchange-limits.test.ts
# npx hardhat test ./test/fhe-trex/compliances/module-country-restrict.test.ts
# npx hardhat test ./test/fhe-trex/compliances/module-country-allow.test.ts
# npx hardhat test ./test/fhe-trex/factory.test.ts
# npx hardhat test ./test/fhe-trex/agentManager.test.ts
# npx hardhat test ./test/identity/claim-issuers/claim-issuer.test.ts
# npx hardhat test ./test/identity/verifiers/verifier.test.ts
# npx hardhat test ./test/identity/verifiers/verifier-user.test.ts
# npx hardhat test ./test/identity/proxy.test.ts
# npx hardhat test ./test/identity/identities/init.test.ts
# npx hardhat test ./test/identity/identities/keys.test.ts
# npx hardhat test ./test/identity/identities/claims.test.ts
# npx hardhat test ./test/identity/identities/executions.test.ts
# npx hardhat test ./test/identity/factory/token-oid.test.ts
# npx hardhat test ./test/identity/factory/factory.test.ts
# npx hardhat test ./test/identity/gateway/gateway.test.ts