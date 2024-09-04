import { ChainConfig } from './ChainConfig';
import { Progress } from './utils';

export interface TxOptions {
  confirms?: number;
  progress?: Progress;
  chainConfig: ChainConfig;
}

export interface TREXConfig {
  idFactory?: string;
  authority?: string;
  factory?: string;
}
