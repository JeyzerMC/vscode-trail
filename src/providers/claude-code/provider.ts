import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { AgentMetrics, AgentProvider, MetricValue } from "../../types";
import { readUsageCache } from "./readers/usage-cache";
import { readOAuthToken, readCredentials } from "./readers/credentials";
import { fetchUsageLimits } from "./readers/api-client";
import {
  readLatestBackupMetrics,
  readLatestSessionModel,
  readLatestSessionTokens,
} from "./readers/session";

function modelDisplayName(modelId: string): string {
  if (modelId.includes("opus")) return "Opus";
  if (modelId.includes("sonnet")) return "Sonnet";
  if (modelId.includes("haiku")) return "Haiku";
  return modelId;
}

function fresh<T>(value: T): MetricValue<T> {
  return { value, status: "fresh", lastUpdated: new Date() };
}

function unavailable<T>(): MetricValue<T> {
  return { value: null, status: "unavailable" };
}

export class ClaudeCodeProvider implements AgentProvider {
  readonly id = "claude-code";
  readonly displayName = "Claude Code";

  private claudeDir: string;

  constructor(claudeDataPath?: string) {
    this.claudeDir = claudeDataPath || path.join(os.homedir(), ".claude");
  }

  async initialize(): Promise<void> {
    // No-op for now; file watchers are managed by the store
  }

  dispose(): void {
    // No-op
  }

  async isAvailable(): Promise<boolean> {
    return fs.existsSync(this.claudeDir);
  }

  getWatchedFiles(): string[] {
    return [
      path.join(this.claudeDir, "usage-cache.json"),
      path.join(this.claudeDir, ".credentials.json"),
    ];
  }

  async getMetrics(): Promise<AgentMetrics> {
    const metrics: AgentMetrics = {};

    // Rate limits — try API first, fall back to local cache
    const token = readOAuthToken(this.claudeDir);
    const apiLimits = token ? await fetchUsageLimits(token) : null;

    if (apiLimits) {
      metrics.rateLimits = fresh({
        fiveHour: apiLimits.five_hour
          ? {
              utilization: apiLimits.five_hour.utilization,
              resetsAt: apiLimits.five_hour.resets_at,
            }
          : undefined,
        sevenDay: apiLimits.seven_day
          ? {
              utilization: apiLimits.seven_day.utilization,
              resetsAt: apiLimits.seven_day.resets_at,
            }
          : undefined,
        sevenDaySonnet: apiLimits.seven_day_sonnet
          ? {
              utilization: apiLimits.seven_day_sonnet.utilization,
              resetsAt: apiLimits.seven_day_sonnet.resets_at,
            }
          : undefined,
      });
    } else {
      // Fallback to local cache file (raw counts, no percentages)
      const cache = readUsageCache(this.claudeDir);
      if (cache) {
        metrics.rateLimits = {
          value: {
            fiveHour:
              cache.five_hour != null
                ? {
                    utilization: cache.five_hour,
                    resetsAt: cache.five_hour_resets_at,
                  }
                : undefined,
            sevenDay:
              cache.seven_day != null
                ? {
                    utilization: cache.seven_day,
                    resetsAt: cache.seven_day_resets_at,
                  }
                : undefined,
          },
          status: "stale",
          lastUpdated: new Date(),
        };
      } else {
        metrics.rateLimits = unavailable();
      }
    }

    // Model info from session data
    const modelId = readLatestSessionModel(this.claudeDir);
    if (modelId) {
      metrics.model = fresh({
        id: modelId,
        displayName: modelDisplayName(modelId),
      });
    } else {
      metrics.model = unavailable();
    }

    // Context window from latest session JSONL usage data
    const sessionTokens = readLatestSessionTokens(this.claudeDir);
    if (sessionTokens) {
      const maxTokens = 200_000;
      const usedTokens = sessionTokens.inputTokens + sessionTokens.outputTokens +
        sessionTokens.cacheCreationTokens + sessionTokens.cacheReadTokens;
      metrics.contextWindow = fresh({
        usedTokens,
        maxTokens,
        breakdown: {
          inputTokens: sessionTokens.inputTokens,
          outputTokens: sessionTokens.outputTokens,
          cacheCreationTokens: sessionTokens.cacheCreationTokens,
          cacheReadTokens: sessionTokens.cacheReadTokens,
        },
      });
    } else {
      metrics.contextWindow = unavailable();
    }

    // Cost from backup file
    const backup = readLatestBackupMetrics(this.claudeDir);
    if (backup?.costUsd != null) {
      metrics.cost = fresh({ totalCostUsd: backup.costUsd });
    }

    // Subscription info from credentials
    const creds = readCredentials(this.claudeDir);
    if (creds?.subscriptionType) {
      metrics.subscription = fresh({
        plan: creds.subscriptionType,
        extraUsageEnabled: true, // Default; could be read from backup data
      });
    } else {
      metrics.subscription = unavailable();
    }

    return metrics;
  }
}
