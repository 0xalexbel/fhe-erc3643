![test workflow](https://github.com/0xalexbel/fhe-erc3643/actions/workflows/ci.yml/badge.svg)

# About

The `fhe-erc3643` package is an almost full port of the entire Tokeny Solutions `TREX` package using FHE to encrypt token amounts 
accross the entire TREX platform. The TFHE lib is deployed on the ERC20 token itself as well as all the `ModularCompliance` architecture.

It is essentially a single Hardhat project with an integrated CLI (via the hardhat task system) that allows the user to deploy a full FHE-TREX token on a local Zama node.

- Only the `country` parameter is still unencrypted. It could be easily done in future version.
- Few modules have yet to be converted into FHE.
- The vast majority of the TREX test suite has also been converted. Consequently, running the test suite on a real node is currently impracticable.
- Due to the large amount of tests, it is not possible to run the full test suite in a single hardhat test command. The node.js runtime eventually will run out of memory.
- The DvA (Delivery versus Action) contract is also fully converted as well as its entire test suite. A fully running example is available at A full running script is available at [./test/scripts/fhevm/DVA.sh](https://github.com/0xalexbel/fhe-erc3643/blob/main/test/scripts/fhevm/DVA.sh)
- `OnChainID` is included as-is along with its test suite, just renamed to `identity` (added solidity 0.8.24 support + linter corrections). No FHE features have been included.

# Development Roadmap

- Improve the `hardhat-fhevm` hardhat plug-in to support multiple nodes
- Add command `trex new-token` to create multiple tokens on the same factory. Right now it only supports a single token
- Remove the `--unpause` flag in the `trex setup` command
- Test on Zama's dev node
- Test on Anvil/Hardhat node
- Implement DvD (Delivery versus Delivery)
- Convert missing modules to FHEVM (Country-related modules, TimeTransfersLimitsModule.sol, MaxBalanceModule.sol, TransferFeesModule.sol)
- Encrypt the `country` property
- linter. Current version raises too many lint errors mostly due to original TREX + onChainID code.  

# Install & Test

### Install

```bash
npm install
```

### Test on hardhat network

```bash
npm run test
```

### Test on local fhevm node (very slow)

```bash
npm run test:fhevm
```

### Start/stop/restart a local fhevm node

```bash
# starts a new local node (if not already running)
npm run start
```
```bash
# stops the running local node
npm run stop
```
```bash
# restart a running local node
npm run restart
```

# How to use the FHE token manually

### Setup a TREX token (slow)

The new token address is displayed at the end of the deployment process.

```bash
npx hardhat --network fhevm trex setup --mint 1000 --unpause
```
- --mint option to distribute tokens to all token holders (alice, bob, etc.)
- --unpause option to activate the token
- --help to list all the available commands (mint, burn, transfer, etc.)

### Inspect the lastest deployed TREX token

```bash
npx hardhat --network fhevm token show
```

### Wallet and token aliases

Instead of using addresses you can execute CLI commands using wallet aliases. The available of aliases are listed in the table below.
Token address is optional, if not provided, the CLI will use the latest valid deployed token. You can also use the symbol/name of the token instead of its address

```bash
# use token address
npx hardhat --network fhevm token mint --token 0x3Aa5ebB10DC797CAC828524e59A333d0A371443c --agent "token-agent" --user alice --amount 10n
# use token symbol
npx hardhat --network fhevm token mint --token MEG --agent "token-agent" --user alice --amount 10n
# resolve token address automatically
npx hardhat --network fhevm token mint --agent "token-agent" --user alice --amount 10n
```

### Interacting with the TREX token

Use the token commands to interact with the token

```bash
npx hardhat --network fhevm token mint --token <token address> --agent "token-agent" --user alice --amount 10n
```

# Example interacting  with the `ExchangeMonthlyLimitsModule` compliance module

The following interaction is fully FHE compliant (from start to finish). (See [./test/scripts/fhevm/ExchangeMonthlyLimits.sh](https://github.com/0xalexbel/fhe-erc3643/blob/main/test/scripts/fhevm/ExchangeMonthlyLimits.sh))


```bash
# setup the TREX environment
npx hardhat --network fhevm trex setup --mint 1000 --unpause
# register bob'id as an exchanger 
npx hardhat --network fhevm token exchangemonthly:add-id --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --owner token-owner --user bob
# specify bob's limits
npx hardhat --network fhevm token exchangemonthly:set-exchange-limit --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --owner token-owner --exchange-id bob --limit 100
# Alice transfers 10 tokens to bob
npx hardhat --network fhevm token transfer --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet alice --to bob --amount 10
# Display bob's remaining credits
npx hardhat --network fhevm token exchangemonthly:get-monthly-counter --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --exchange-id bob --investor-id alice --decrypt
```

# Example running the DvA contract in full FHE mode

A full running script is available at [./test/scripts/fhevm/DVA.sh](https://github.com/0xalexbel/fhe-erc3643/blob/main/test/scripts/fhevm/DVA.sh)

```bash
# For a complete list of DvA commands:
npx hardhat transfer-manager --help
```

# The  `🚧 hardhat-fhevm 🚧` npm package

fhe-erc3643 uses the `hardhat-fhevm` hardhat plugin, which offers a set of hardhat tasks to develop solidity contracts on top of Zama's FHEVM. 
It supports both the mock and local node modes. 
The `hardhat-fhevm` hardhat plugin is currently in alpha testing. Future versions should be fully re-architectured to better support external nodes like Anvil, Hardhat node and Zama dev-node.

- NPM: https://www.npmjs.com/package/hardhat-fhevm
- Git: https://github.com/0xalexbel/hardhat-fhevm

## The test wallets and roles

| Name  | Wallet index  | Wallet aliases  | Role  | Note  |
|---|---|---|---|---|
| 🚀 admin  |  0  | admin  |  owner of the TREXFactory |   |
|  🏫 foo-university  |  1 | foo-university  | claim issuer  | stored in the token's Identity registry  |
|  🏛️ bar-government  |  2 | bar-government  | claim issuer  | stored in the token's Identity registry  |
|  🏦 super-bank  |  3 | super-bank, token-owner  |token owner  |   |
|  👨‍🚀 token-agent  |  4 | token-agent  | token agent  |   |
|  👩 alice  |  5 | alice  | token holder  | has an identity stored in the token's Identity registry |
|  👱🏼‍♂️ bob  |  6 | bob  | token holder  | has an identity stored in the token's Identity registry |
|  👱🏼‍♂️ charlie  |  7 | charlie  | token holder  | has an identity stored in the token's Identity registry |
|  👱🏼‍♂️ david  |  8 | david  | token holder  | has an identity stored in the token's Identity registry |
|  👩 eve  |  9 | eve  | token holder  | has an identity stored in the token's Identity registry |
|  🦈 MEGALODON  |  _ | _  | TREX token  | the deployed TREX token |

# Limitations:

- For debugging reasons, all events are also emitting the encrypted handles. This should be removed if necessary.
- `country` is still un-encrypted. (Future versions)
- On the FHEVM node: Some tests are running when manually executed using the CLI while failing when run via Chai + Mocha
- DVA has been ported but the corresponding CLI is not available
- Some CLI commands are missing (transfer-from, etc.) 
- Modules that have not been converted yet: ConditionalTransferModule, MaxBalanceModule, TransferFeesModule. 