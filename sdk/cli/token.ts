import { ChainConfig } from '../ChainConfig';
import { FheERC3643Error, throwIfInvalidAddress, throwIfNotDeployed } from '../errors';
import { IdentityAPI } from '../IdentityAPI';
import { logStepInfo, logStepMsg, logStepOK } from '../log';
import { TokenAPI } from '../TokenAPI';
import { TokenConfig } from '../TokenConfig';
import { TREXFactoryAPI } from '../TREXFactory';
import { TxOptions } from '../types';
import { defaultTxOptions } from '../utils';

export type NewTokenResult = {
  token: string;
  ir: string;
  irs: string;
  tir: string;
  ctr: string;
  mc: string;
  saltHash: string;
};

export async function cmdTokenNew(
  configFile: string,
  ownerAddressAlias: string,
  trexFactoryAddress: string,
  salt: string,
  trexFactoryOwnerWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  const trexFactoryOwnerWallet =
    trexFactoryOwnerWalletAlias === 'auto'
      ? await chainConfig.getOwnerWallet(trexFactoryAddress)
      : chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(trexFactoryOwnerWalletAlias);

  throwIfInvalidAddress(trexFactoryAddress);
  await throwIfNotDeployed('TREX factory', chainConfig.provider, trexFactoryAddress);

  const ownerAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(ownerAddressAlias);

  const c = await TokenConfig.load(configFile, chainConfig);
  c.token.owner = ownerAddress;
  c.salt = salt;

  const params = TokenConfig.toCallParams(c);
  const trexFactory = await TREXFactoryAPI.fromWithOwner(trexFactoryAddress, trexFactoryOwnerWallet);
  const res: NewTokenResult = await TREXFactoryAPI.deployTREXSuite(
    trexFactory,
    params.salt,
    params.tokenDetails,
    params.claimDetails,
    trexFactoryOwnerWallet,
    chainConfig,
    options,
  );

  if (options?.mute !== true) {
    console.log(
      JSON.stringify(
        { ...res, config: c },
        (key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2, // return everything else unchanged
      ),
    );
  }

  return res;
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenAddIdentity(
  tokenAddress: string,
  userWalletAlias: string,
  identityAddress: string,
  country: bigint,
  tokenIRAgentWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  throwIfInvalidAddress(identityAddress);
  await throwIfNotDeployed('User identity', chainConfig.provider, identityAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userWalletAlias);
  const agentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenIRAgentWalletAlias);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);
  const identity = IdentityAPI.from(identityAddress, chainConfig.provider);

  const alreadyStored = await TokenAPI.hasIdentity(token, userAddress, identity, country, chainConfig.provider);

  if (alreadyStored) {
    logStepInfo(
      `Identity ${identityAddress} with user ${userWalletAlias} and country ${country} is already registered by token ${tokenAddress}`,
      options,
    );
    return;
  }

  options.progress?.pause();

  await TokenAPI.registerIdentity(token, userAddress, identity, country, agentWallet, options);

  options.progress?.unpause();

  logStepOK(
    `Identity ${identityAddress} with user ${userAddress} and country ${country} has been successfully added to token ${tokenAddress}`,
    options,
  );
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenBalance(
  tokenAddress: string,
  userWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userWalletAlias);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);

  const encBalance = await TokenAPI.balanceOf(token, userAddress, chainConfig.provider, options);

  logStepMsg(`Decrypting balance of ${userWalletAlias}...`, options);

  const balance = await chainConfig.decrypt64(encBalance);

  logStepMsg(`Balance of ${userWalletAlias} is : ${balance} (fhevm handle=${encBalance})`, options);

  return {
    fhevmHandle: encBalance,
    value: balance,
  };
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenTotalSupply(tokenAddress: string, chainConfig: ChainConfig, options?: TxOptions) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);

  const fhevmHandle = await TokenAPI.totalSupply(token, chainConfig.provider, options);

  logStepMsg(`Decrypting token total supply ...`, options);

  const value = await chainConfig.decrypt64(fhevmHandle);

  logStepMsg(`Token total supply is : ${value} (fhevm handle=${fhevmHandle})`, options);

  return {
    fhevmHandle,
    value,
  };
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenMint(
  tokenAddress: string,
  userWalletAlias: string,
  tokenAgentWalletAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userWalletAlias);
  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  const encAmount = await chainConfig.encrypt64(await token.getAddress(), userAddress, amount);

  await TokenAPI.mint(
    token,
    userAddress,
    encAmount.handles[0],
    encAmount.inputProof,
    tokenAgentWallet,
    chainConfig,
    options,
  );

  const bb = await TokenAPI.balanceOf(token, userAddress, chainConfig.provider, options);
  console.log('....');
  const aaa = await chainConfig.decrypt64(bb);
  console.log(aaa);

  logStepOK(`Minted ${amount} tokens to '${userWalletAlias}'`, options);
}

export async function cmdTokenBurn(
  tokenAddress: string,
  userWalletAlias: string,
  tokenAgentWalletAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userWalletAlias);
  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  const encAmount = await chainConfig.encrypt64(await token.getAddress(), userAddress, amount);

  await TokenAPI.burn(token, userAddress, encAmount.handles[0], encAmount.inputProof, tokenAgentWallet, options);
}

export async function cmdTokenFreeze(
  tokenAddress: string,
  userWalletAlias: string,
  tokenAgentWalletAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userWalletAlias);
  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  const encAmount = await chainConfig.encrypt64(await token.getAddress(), userAddress, amount);

  await TokenAPI.freezePartialTokens(
    token,
    userAddress,
    encAmount.handles[0],
    encAmount.inputProof,
    tokenAgentWallet,
    options,
  );
}

export async function cmdTokenTransfer(
  tokenAddress: string,
  fromWalletAlias: string,
  toAddressAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const fromWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(fromWalletAlias);
  const toAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(toAddressAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  const encAmount = await chainConfig.encrypt64(await token.getAddress(), fromWallet.address, amount);

  await TokenAPI.transfer(token, toAddress, encAmount.handles[0], encAmount.inputProof, fromWallet, options);
}

export async function cmdTokenUnfreeze(
  tokenAddress: string,
  userAddressAlias: string,
  tokenAgentWalletAlias: string,
  amount: bigint,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);
  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  const encAmount = await chainConfig.encrypt64(await token.getAddress(), userAddress, amount);

  await TokenAPI.unfreezePartialTokens(
    token,
    userAddress,
    encAmount.handles[0],
    encAmount.inputProof,
    tokenAgentWallet,
    options,
  );
}

export async function cmdTokenFrozenTokens(
  tokenAddress: string,
  userAddressAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const userAddress = chainConfig.loadAddressFromWalletIndexOrAliasOrAddress(userAddressAlias);

  const token = TokenAPI.from(tokenAddress, chainConfig.provider);

  const encValue = await TokenAPI.getFrozenTokens(token, userAddress, chainConfig.provider, options);

  logStepMsg(`Decrypting frozen tokens of ${userAddressAlias}...`, options);

  let value: bigint | undefined = undefined;
  if (encValue !== 0n) {
    value = await chainConfig.decrypt64(encValue);
  }

  logStepMsg(`The number of frozen tokens of ${userAddressAlias} is : ${value} (fhevm handle=${encValue})`, options);

  return {
    fhevmHandle: encValue,
    value,
  };
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenPause(
  tokenAddress: string,
  tokenAgentWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  let isPaused = await TokenAPI.paused(token, chainConfig.provider, options);

  if (isPaused) {
    logStepInfo(`Token ${tokenAddress} is already paused`, options);
    return;
  }

  await TokenAPI.pause(token, tokenAgentWallet, options);

  isPaused = await TokenAPI.paused(token, chainConfig.provider, options);

  if (!isPaused) {
    throw new FheERC3643Error(`Pause token ${tokenAddress} failed.`);
  }

  logStepOK(`Token ${tokenAddress} is paused`, options);
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenUnpause(
  tokenAddress: string,
  tokenAgentWalletAlias: string,
  chainConfig: ChainConfig,
  options?: TxOptions,
) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const tokenAgentWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(tokenAgentWalletAlias);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  if (!(await token.isAgent(tokenAgentWallet))) {
    throw new FheERC3643Error(`agent ${tokenAgentWalletAlias} is not a token agent`);
  }

  let isPaused = await TokenAPI.paused(token, chainConfig.provider, options);

  if (!isPaused) {
    logStepInfo(`Token ${tokenAddress} is already unpaused`, options);
    return;
  }

  await TokenAPI.unpause(token, tokenAgentWallet, options);

  isPaused = await TokenAPI.paused(token, chainConfig.provider, options);

  if (isPaused) {
    throw new FheERC3643Error(`Unpause token ${tokenAddress} failed.`);
  }

  logStepOK(`Token ${tokenAddress} is unpaused`, options);
}

////////////////////////////////////////////////////////////////////////////////

export async function cmdTokenIsPaused(tokenAddress: string, chainConfig: ChainConfig, options?: TxOptions) {
  options = options ?? defaultTxOptions(1);

  throwIfInvalidAddress(tokenAddress);
  await throwIfNotDeployed('Token', chainConfig.provider, tokenAddress);

  const token = await TokenAPI.fromSafe(tokenAddress, chainConfig.provider);

  const isPaused = await TokenAPI.paused(token, chainConfig.provider, options);

  if (isPaused) {
    logStepMsg(`Token ${tokenAddress} is paused`, options);
  } else {
    logStepMsg(`Token ${tokenAddress} is unpaused`, options);
  }
}

////////////////////////////////////////////////////////////////////////////////

//npx hardhat --network fhevm token mint --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --user alice --agent token-agent
// tokenScope
//   .task(SCOPE_TOKEN_MINT)
//   .addParam('token', 'Token address', undefined, string)
//   .addParam('user', 'The address or wallet index/alias of the user', undefined, string)
//   .addParam('agent', 'The token agent wallet', undefined, string)
//   .addParam('amount', 'Amount of tokens to transfer to user', undefined, bigint)
//   .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
//     const chainConfig = await loadChainConfig(hre, getHistoryPath());

//     throwIfInvalidAddress(taskArgs.token, hre);

//     const userAddress = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.user);
//     const agentWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.agent);

//     const token = TokenAPI.from(taskArgs.token, chainConfig.provider);

//     if (!(await token.isAgent(agentWallet))) {
//       logError(`agent ${taskArgs.agent} is not a token agent`);
//       return;
//     }

//     const encAmount = await chainConfig.encrypt64(await token.getAddress(), userAddress, taskArgs.amount);

//     await TokenAPI.mint(token, userAddress, encAmount.handles[0], encAmount.inputProof, agentWallet, {
//       progress: new Progress(1),
//       confirms: 1,
//       chainConfig,
//       gasLimit: 5_000_000,
//     });
//   });

/*

//npx hardhat --network fhevm token add-identity --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet token-agent --country 1 --user alice --identity 0x0116686E2291dbd5e317F47faDBFb43B599786Ef
tokenScope
  .task(SCOPE_TOKEN_ADD_IDENTITY)
  .addParam('token', 'Token address', undefined, string)
  .addParam('user', 'Identity user wallet address or wallet index to register', undefined, string)
  .addParam('identity', 'Identity address to register', undefined, string)
  .addParam('country', 'Identity country code', undefined, bigint)
  .addParam('wallet', 'Token identity registry agent wallet (index, address or private key)', undefined, string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    throwIfInvalidAddress(taskArgs.token, hre);
    throwIfInvalidAddress(taskArgs.identity, hre);

    const userAddress = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.user);
    const agentWallet = loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    const token = TokenAPI.from(taskArgs.token, chainConfig.provider);
    const identity = IdentityAPI.from(taskArgs.identity, chainConfig.provider);

    const alreadyStored = await TokenAPI.hasIdentity(
      token,
      userAddress,
      identity,
      taskArgs.country,
      chainConfig.provider,
    );

    if (alreadyStored) {
      logInfo(
        `Identity ${taskArgs.identity} with user ${taskArgs.user} and country ${taskArgs.country} is already registered by token ${taskArgs.token}`,
      );
      return;
    }

    await TokenAPI.registerIdentity(token, userAddress, identity, taskArgs.country, agentWallet, {
      progress: new Progress(1),
      confirms: 1,
      chainConfig,
    });

    logOK(
      `Identity ${taskArgs.identity} with user ${taskArgs.user} and country ${taskArgs.country} has been successfully added to token ${taskArgs.token}`,
    );
  });

//npx hardhat --network fhevm token show --salt MyAA2 --factory 0x0E801D84Fa97b50751Dbf25036d067dCf18858bF
//npx hardhat --network fhevm token show --salt "My Salt" --factory 0x0E801D84Fa97b50751Dbf25036d067dCf18858bF
tokenScope
  .task(SCOPE_TOKEN_SHOW)
  .addOptionalParam('token', 'TREX Token address', undefined, string)
  .addOptionalParam('salt', 'Salt of the token to display', undefined, string)
  .addOptionalParam('factory', 'TREX factory address where the token is registered', undefined, string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    let token;
    if (taskArgs.token) {
      token = await TokenAPI.fromSafe(taskArgs.token, chainConfig.provider);
      if (!token) {
        logError(`Unable to retreive token from address ${taskArgs.token}`);
        return;
      }
    } else {
      const trexFactory = TREXFactoryAPI.from(taskArgs.factory, chainConfig.provider);
      const tokenSalt = taskArgs.salt;

      token = await TREXFactoryAPI.tokenFromSalt(trexFactory, tokenSalt, chainConfig.provider);

      if (!token) {
        logError(`Unable to retreive token salt ${tokenSalt}`);
        return;
      }
    }

    const o = {
      address: hre.ethers.ZeroAddress,
      owner: {
        address: hre.ethers.ZeroAddress,
        index: undefined as number | undefined,
        names: [] as string[],
      },
      agents: [] as Array<{
        address: string;
        index: number | undefined;
        names: string[];
      }>,
      name: '',
      symbol: '',
      decimals: 0n,
      identityRegistry: hre.ethers.ZeroAddress,
      identityRegistryAgents: [] as Array<{
        address: string;
        index: number | undefined;
        names: string[];
      }>,
      identityRegistryOwner: {
        address: hre.ethers.ZeroAddress,
        index: undefined as number | undefined,
        names: [] as string[],
      },
      identityRegistryStorage: hre.ethers.ZeroAddress,
      identity: hre.ethers.ZeroAddress,
      modularCompliance: hre.ethers.ZeroAddress,
      complianceModules: [] as Array<string>,
      topicsRegistry: hre.ethers.ZeroAddress,
      topics: [] as Array<bigint>,
      trustedIssuersRegistry: hre.ethers.ZeroAddress,
      issuers: {} as Record<string, { topics: Array<bigint> }>,
    };

    o.address = await token.getAddress();
    o.owner = (await AgentRoleAPI.searchOwnerInAgentRole(token, chainConfig)) ?? o.owner;
    o.agents = await AgentRoleAPI.searchAgentsInAgentRole(token, chainConfig);
    o.name = await token.name();
    o.symbol = await token.symbol();
    o.decimals = await token.decimals();
    const ir = await TokenAPI.identityRegistry(token, chainConfig.provider);
    o.identityRegistry = await ir.getAddress();
    o.identityRegistryAgents = await AgentRoleAPI.searchAgentsInAgentRole(o.identityRegistry, chainConfig);
    const owner = await AgentRoleAPI.searchOwnerInAgentRole(o.identityRegistry, chainConfig);
    if (owner) {
      o.identityRegistryOwner = owner;
    }

    o.identityRegistryStorage = await (
      await TokenAPI.identityRegistryStorage(token, chainConfig.provider)
    ).getAddress();
    o.identity = await token.onchainID();
    o.modularCompliance = await token.compliance();
    const mc = ModularComplianceAPI.from(o.modularCompliance, chainConfig.provider);
    o.complianceModules = await mc.getModules();
    o.topicsRegistry = await ir.topicsRegistry();
    const ctr = ClaimTopicsRegistryAPI.from(o.topicsRegistry, chainConfig.provider);
    const topics = await ctr.getClaimTopics();
    o.topics = topics;

    o.trustedIssuersRegistry = await ir.issuersRegistry();
    const tir = TrustedIssuersRegistryAPI.from(o.trustedIssuersRegistry, chainConfig.provider);
    const issuers = await tir.getTrustedIssuers();

    const issuersObj: Record<string, { topics: Array<bigint> }> = {};
    for (let i = 0; i < issuers.length; ++i) {
      const ti = issuers[i];
      const topics = await tir.getTrustedIssuerClaimTopics(ti);
      issuersObj[ti] = { topics: [...topics] };
    }
    o.issuers = issuersObj;

    console.log(
      JSON.stringify(
        o,
        (key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2, // return everything else unchanged
      ),
    );
  });

//npx hardhat --network fhevm token add-identity-agent --token 0x47DA632524c03ED15D293e34256D28BD0d38c7a4 --wallet super-bank super-bank
tokenScope
  .task(SCOPE_TOKEN_ADD_IDENTITY_AGENT)
  .addParam('token', 'Token address', undefined, string)
  .addPositionalParam('address', 'The address or wallet index of the future agent', undefined, string)
  .addOptionalParam('wallet', 'The token identity registry owner wallet (usually token owner)', 'auto', string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const chainConfig = await loadChainConfig(hre, getHistoryPath());

    throwIfInvalidAddress(taskArgs.token, hre);

    const address = loadAddressFromWalletIndexOrAliasOrAddress(chainConfig, taskArgs.address);

    const token = TokenAPI.from(taskArgs.token, chainConfig.provider);

    const ir = await TokenAPI.identityRegistry(token, chainConfig.provider);
    const irAddress = await ir.getAddress();

    const agentRoleOwner =
      taskArgs.wallet === 'auto'
        ? await chainConfig.getOwnerWallet(irAddress)
        : loadWalletFromIndexOrAliasOrAddressOrPrivateKey(chainConfig, taskArgs.wallet);

    // Will fail if the wallet is not the owner of the token's identity registry
    const agentRole = await AgentRoleAPI.fromWithOwner(irAddress, agentRoleOwner);

    if (await agentRole.isAgent(address)) {
      logInfo(`Address '${taskArgs.address}' is already an agent of the token's identity registry: '${irAddress}'`);
      return;
    }

    await AgentRoleAPI.addAgent(agentRole, address, agentRoleOwner);

    logOK(`Address '${taskArgs.address}' is an agent of the token's identity registry: '${irAddress}'`);
  });
*/
