// import { subtask } from 'hardhat/config';
// import { string } from 'hardhat/internal/core/params/argumentTypes';
// import { HardhatRuntimeEnvironment } from 'hardhat/types';
// import { loadChainConfig } from '../utils';
// import { TREXImplementationAuthorityAPI } from '../../sdk/TRexImplementationAuthorityAPI';
// import { Progress } from '../../sdk/utils';
// import { ChainConfig } from '../../sdk/ChainConfig';

// subtask('BB:NewTREXFactory')
//   .addOptionalParam('wallet', undefined, '0', string)
//   .setAction(
//     async (
//       {
//         wallet,
//       }: {
//         wallet: string;
//       },
//       hre: HardhatRuntimeEnvironment,
//     ) => {
//       console.log('HI = ' + wallet);
//       const chainConfig = await loadChainConfig(hre);
//       const ownerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(wallet);
//       const trexFactory = await TREXImplementationAuthorityAPI.loadOrDeployTREXConfig({}, ownerWallet, {
//         progress: new Progress(12),
//         confirms: 1,
//         chainConfig,
//       });
//       return trexFactory;
//     },
//   );

// export async function hihih(wallet: string, chainConfig: ChainConfig) {
//   console.log('HI = ' + wallet);
//   const ownerWallet = chainConfig.loadWalletFromIndexOrAliasOrAddressOrPrivateKey(wallet);
//   const trexFactory = await TREXImplementationAuthorityAPI.loadOrDeployTREXConfig({}, ownerWallet, {
//     progress: new Progress(12),
//     confirms: 1,
//     chainConfig,
//   });
//   console.log('HI = ' + ownerWallet.address);
//   console.log('HI = ' + (await trexFactory.authority.getAddress()));
// }
