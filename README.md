# Steps

## The actors

- admin (wallet 0): owner of the TREX factory
- 🏫 foo-university : a claim issuer
- 🏛️ bar-government : a claim issuer
- 🏦 super-bank : the token owner
- 👨‍🚀 token-agent : the token manager
- 👩 alice : token holder #1
- 👱🏼‍♂️ bob : token holder #2
- 👱🏼‍♂️ charlie : token holder #3
- 👱🏼‍♂️ david : token holder #4
- 👩 eve : token holder #5

## Step 1: `admin` creates a new TREX factory

```bash
# the '--wallet' option can be a wallet index, a wallet name, a wallet address or a private key
# wallet #0 alias is 'admin'
# TREXFactory address: 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e
npx hardhat --network fhevm trex new-factory --wallet admin
```

## Step 2: create Claim issuers `🏫 foo-university` & `🏛️ bar-government`

```bash
# Foo University .edu is a claim issuer (alias=foo-university, index=1)
# ClaimIssuer address: 0x8464135c8F25Da09e49BC8782676a84730C318bC
npx hardhat --network fhevm issuer new --wallet foo-university

# Bar Government .gov is a claim issuer (alias=bar-government, index=2)
# ClaimIssuer address: 0x663F3ad617193148711d28f5334eE4Ed07016602
npx hardhat --network fhevm issuer new --wallet bar-government
```

## Step 3: `🏦 super-bank` creates a new TREX Token named 'MEGALODON'

The many parameters of the new token are taken from a config file, here : "./megalodon.token.json"
```bash
# --trex-factory <address created on step 1>, here 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e
# --config-file <path/to/token.config.json> that contains all the token settings
# TheMegToken address: 0x47DA632524c03ED15D293e34256D28BD0d38c7a4
npx hardhat --network fhevm token new --config-file ./megalodon.token.json --owner super-bank --trex-factory 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e --wallet admin --salt TheMegToken

# `🏦 super-bank` grants Mr `👨‍🚀 token-agent` the token administration rights:
# - add/revoke identities allowed to own new 'MEGALODON' tokens
npx hardhat --network fhevm token add-identity-agent --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet super-bank token-agent
```

## Step 4: Create all individual user identities (👩 alice, 👱🏼‍♂️ bob etc.)

```bash
# Create 👩 alice's identity (0x0116686E2291dbd5e317F47faDBFb43B599786Ef)
npx hardhat --network fhevm identity new --trex-factory 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e --wallet alice

# Create 👱🏼‍♂️ bob's identity (0x7ef8E99980Da5bcEDcF7C10f41E55f759F6A174B)
npx hardhat --network fhevm identity new --trex-factory 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e --wallet bob

# Create 👱🏼‍♂️ charlie's identity (0xef11D1c2aA48826D4c41e54ab82D1Ff5Ad8A64Ca)
npx hardhat --network fhevm identity new --trex-factory 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e --wallet charlie

# Create 👱🏼‍♂️ david's identity (0x95bD8D42f30351685e96C62EDdc0d0613bf9a87A)
npx hardhat --network fhevm identity new --trex-factory 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e --wallet david

# Create 👩 eve's identity (0xe1DA8919f262Ee86f9BE05059C9280142CF23f48)
npx hardhat --network fhevm identity new --trex-factory 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e --wallet eve
```

## Step 5: claims
- `👩 alice` stores a claim signed by `🏫 foo-university` that certifies she is actually gratuated form `🏫 foo-university`.
- `👩 alice` stores a claim signed by `🏛️ bar-government` that certifies she is actually a citizen form `bar` country.
- etc. with bob, charlie, david and eve.

```bash
# purpose = 1 means that alice grants foo-university management rights to store the signed claim.
npx hardhat --network fhevm identity add-key --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef --wallet alice --key foo-university --purpose 1

# 0x8464135c8F25Da09e49BC8782676a84730C318bC == foo-university claim issuer contract address (see step 2).
# 0x0116686E2291dbd5e317F47faDBFb43B599786Ef == alice's identity (see step 4).
# topic code 10101010000042n == university diploma
npx hardhat --network fhevm claim add --issuer 0x8464135c8F25Da09e49BC8782676a84730C318bC --wallet foo-university --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef --data "Alice is graduated from Foo University" --topic 10101010000042

# remove the management rights
npx hardhat --network fhevm identity remove-key --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef --wallet alice --key foo-university --purpose 1
```

## Step 6: Add identities in the token identity registry

```bash
# 0x0116686E2291dbd5e317F47faDBFb43B599786Ef == 👩 alice's identity (see step 4).
npx hardhat --network fhevm token add-identity --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet token-agent --country 1 --user alice --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef

# 0x7ef8E99980Da5bcEDcF7C10f41E55f759F6A174B == 👱🏼‍♂️ bob's identity (see step 4).
npx hardhat --network fhevm token add-identity --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet token-agent --country 1 --user bob --identity 0x7ef8E99980Da5bcEDcF7C10f41E55f759F6A174B

# 0xef11D1c2aA48826D4c41e54ab82D1Ff5Ad8A64Ca == 👱🏼‍♂️ charlie's identity (see step 4).
npx hardhat --network fhevm token add-identity --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet token-agent --country 2 --user charlie --identity 0xef11D1c2aA48826D4c41e54ab82D1Ff5Ad8A64Ca

# 0x95bD8D42f30351685e96C62EDdc0d0613bf9a87A == 👱🏼‍♂️ david's identity (see step 4).
npx hardhat --network fhevm token add-identity --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet token-agent --country 2 --user david --identity 0x95bD8D42f30351685e96C62EDdc0d0613bf9a87A

# 0xe1DA8919f262Ee86f9BE05059C9280142CF23f48 == 👩 eve's identity (see step 4).
npx hardhat --network fhevm token add-identity --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet token-agent --country 3 --user eve --identity 0xe1DA8919f262Ee86f9BE05059C9280142CF23f48
```

## Step 6: Add compliance modules

```bash
# Create a new ConditionalTransferModule module (0x0B306BF915C4d645ff596e518fAf3F9669b97016)
npx hardhat --network fhevm module new --name 'ConditionalTransferModule' --wallet admin

# super-bank is the token owner
npx hardhat --network fhevm module add --module 0x0B306BF915C4d645ff596e518fAf3F9669b97016 --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet super-bank
```

## Hardhat plugins import order

`hardhat-fhevm` must be imported last:

✅ OK:
```js
import 'hardhat-ignore-warnings';
import 'hardhat-fhevm';
```

❌ NOT OK (no dot):

```js
import 'hardhat-fhevm';
import 'hardhat-ignore-warnings';
```

Both plugins are overriding the built-in TASK_TEST. However, `hardhat-fhevm` must be called first by the runtime to start the fhevm network.
If `hardhat-gas-reporter` is called first and `hardhat-fhevm` second the following error will be raised:

```
Error HH108: Cannot connect to the network fhevm.
Please make sure your node is running, and check your internet connection and networks config
```


