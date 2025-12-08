import { ChildProcess } from 'child_process';

export interface Service {
  name: string;
  script: string;
  port: number;
  useNodemon?: boolean;
  watchDir?: string;
}

export interface ProcessInfo {
  name: string;
  process: ChildProcess;
}

