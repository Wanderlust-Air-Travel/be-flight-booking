export enum DataProvider {
  OURAIRPORTS = 'ourairports',
  MOCK = 'mock',
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

export interface ProviderHealth {
  provider: DataProvider;
  isHealthy: boolean;
  latencyMs: number;
  lastChecked: Date;
  error?: string;
}
