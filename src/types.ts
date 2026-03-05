export type MetricStatus = "fresh" | "stale" | "unavailable" | "error";

export interface MetricValue<T> {
  value: T | null;
  status: MetricStatus;
  lastUpdated?: Date;
}

export interface TokenBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface RateLimit {
  utilization: number;
  resetsAt: string | null;
}

export interface AgentMetrics {
  model?: MetricValue<{ id: string; displayName: string }>;
  contextWindow?: MetricValue<{
    usedTokens: number;
    maxTokens: number;
    breakdown?: TokenBreakdown;
  }>;
  rateLimits?: MetricValue<{
    fiveHour?: RateLimit;
    sevenDay?: RateLimit;
    sevenDaySonnet?: RateLimit;
  }>;
  subscription?: MetricValue<{
    plan: string;
    extraUsageEnabled: boolean;
  }>;
  cost?: MetricValue<{ totalCostUsd: number }>;
}

export interface AgentProvider {
  readonly id: string;
  readonly displayName: string;

  initialize(): Promise<void>;
  dispose(): void;

  getMetrics(): Promise<AgentMetrics>;
  getWatchedFiles(): string[];
  isAvailable(): Promise<boolean>;
}

export type MetricKey =
  | "model"
  | "context"
  | "rateLimit5h"
  | "rateLimit7d"
  | "rateLimit7dSonnet"
  | "cost"
  | "subscription";

export interface UsageLimitsResponse {
  five_hour: { utilization: number; resets_at: string | null } | null;
  seven_day: { utilization: number; resets_at: string | null } | null;
  seven_day_sonnet: { utilization: number; resets_at: string | null } | null;
}

export interface UsageCacheData {
  five_hour: number | null;
  seven_day: number | null;
  seven_day_sonnet: number | null;
  five_hour_resets_at: string | null;
  seven_day_resets_at: string | null;
}

export interface CredentialsData {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
  };
  subscriptionType?: string;
  organizationUuid?: string;
}
