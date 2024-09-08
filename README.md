# About

The `fhe-erc3643` package is an almost full port of the entire Tokeny Solutions `TREX` package using FHE to encrypt token amounts 
accross the entire TREX platform. The TFHE lib is deployed on the ERC20 token itself as well as all the `ModularCompliance` architecture.

It is essentially a single Hardhat project with an integrated CLI (via the hardhat task system) that allows the user to deploy a full FHE-TREX token on a local Zama node.

- Only the `country` parameter is still unencrypted. It could be easily done in future version.
- Few modules have yet to be converted into FHE.
- The vast majority of the TREX test suite has also been converted. Consequently, running the test suite on a real node is currently impracticable.
- Due to the large amount of tests, it is not possible to run the full test suite in a single hardhat test command. The node.js runtime eventually will run out of memory.
- The DVA contract is also fully converted as well as its entire test suite.

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

# How to use the FHE token manually

1. Setup the FHE-TREX environment

```bash
npx hardhat --network fhevm trex setup --mint 100 --unpause
```
- --mint option to distribute tokens to all token holders (alice, bob, etc.)
- --unpause option to activate the token
- --help to list all the available commands (mint, burn, transfer, etc.)

2. Use the token commands to play with the token

```bash
npx hardhat --network fhevm token mint --token <token address> --agent "token-agent" --user alice --amount 10n
```

3. Predefined wallets and aliases

Instead of using addresses you can execute CLI commands using wallet aliases. Note that the deployed token address is still required in hex format. See table below for the list of aliases.

```bash
npx hardhat --network fhevm token mint --token <token address> --agent "token-agent" --user alice --amount 10n
```

# The CLI

`TREX` setup commands

```bash
npx hardhat trex --help
```

`Token` related commands

```bash
npx hardhat token --help
```

# The `hardhat-fhevm` npm package

fhe-erc3643 uses the `hardhat-fhevm` hardhat plugin, which offers a set of hardhat tasks to develop solidity contracts on top of Zama's FHEVM. 
It supports both the mock and local node modes.

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
