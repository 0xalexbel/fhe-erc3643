import { Progress } from './utils';

export interface TxOptions {
  confirms?: number;
  progress?: Progress;
  gasLimit?: number;
  mute?: boolean;
}

export interface TREXConfig {
  idFactory?: string;
  authority?: string;
  factory?: string;
}
