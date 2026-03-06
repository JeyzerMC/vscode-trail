import * as fs from "fs";
import * as path from "path";

interface SessionInfo {
  costUsd?: number;
  billingType?: string;
  hasExtraUsageEnabled?: boolean;
}

// Pricing per million tokens (MTok) for each model family.
// Source: https://www.anthropic.com/pricing
const MODEL_PRICING: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  opus: { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  sonnet: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  haiku: { input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 },
};

function getPricing(modelId: string) {
  if (modelId.includes("opus")) return MODEL_PRICING.opus;
  if (modelId.includes("haiku")) return MODEL_PRICING.haiku;
  return MODEL_PRICING.sonnet; // default / sonnet
}

export function computeSessionCost(claudeDir: string): number | null {
  const filePath = findGlobalLatestJsonl(claudeDir);
  if (!filePath) return null;

  try {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    let totalCost = 0;
    let found = false;

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const usage = entry.message?.usage ?? entry.usage;
        const modelId: string = entry.message?.model ?? entry.model ?? "";
        if (!usage || usage.input_tokens === undefined || !modelId) continue;

        const p = getPricing(modelId);
        totalCost +=
          ((usage.input_tokens ?? 0) * p.input +
            (usage.output_tokens ?? 0) * p.output +
            (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite +
            (usage.cache_read_input_tokens ?? 0) * p.cacheRead) /
          1_000_000;
        found = true;
      } catch {
        continue;
      }
    }

    return found ? totalCost : null;
  } catch {
    return null;
  }
}

export interface SessionTokens {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

// Find the globally most recently modified session JSONL across all projects.
// This represents the currently active (or most recently active) Claude Code session.
function findGlobalLatestJsonl(claudeDir: string): string | null {
  const projectsDir = path.join(claudeDir, "projects");
  try {
    if (!fs.existsSync(projectsDir)) return null;

    let bestPath: string | null = null;
    let bestMtime = 0;

    for (const dir of fs.readdirSync(projectsDir)) {
      const dirPath = path.join(projectsDir, dir);
      try {
        for (const f of fs.readdirSync(dirPath)) {
          if (!f.endsWith(".jsonl") || f.includes("subagent")) continue;
          const filePath = path.join(dirPath, f);
          const mtime = fs.statSync(filePath).mtimeMs;
          if (mtime > bestMtime) {
            bestMtime = mtime;
            bestPath = filePath;
          }
        }
      } catch {
        continue;
      }
    }

    return bestPath;
  } catch {
    return null;
  }
}

// Read the cwd from the most recently active session JSONL.
// The first lines may not have cwd, so scan until we find one.
function readLatestSessionCwd(claudeDir: string): string | null {
  const filePath = findGlobalLatestJsonl(claudeDir);
  if (!filePath) return null;
  try {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.cwd) return entry.cwd as string;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function readLatestBackupMetrics(claudeDir: string): SessionInfo | null {
  const backupsDir = path.join(claudeDir, "backups");
  try {
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith(".claude.json.backup."));
    if (files.length === 0) return null;

    const latest = files.sort((a, b) => {
      const tsA = parseInt(a.split(".").pop() ?? "0", 10);
      const tsB = parseInt(b.split(".").pop() ?? "0", 10);
      return tsB - tsA;
    })[0];

    const data = JSON.parse(fs.readFileSync(path.join(backupsDir, latest), "utf-8"));
    const projects = data.projects;
    if (!projects || typeof projects !== "object") return null;

    // Read subscription info from oauthAccount (always available).
    const oauthAccount = data.oauthAccount as Record<string, unknown> | undefined;
    const billingType = oauthAccount?.billingType as string | undefined;
    const hasExtraUsageEnabled = oauthAccount?.hasExtraUsageEnabled as boolean | undefined;

    // Resolve the active session's project directory from its cwd field.
    // Backup keys use forward-slash paths (e.g., C:/Users/foo/bar).
    let costUsd: number | undefined;
    const sessionCwd = readLatestSessionCwd(claudeDir);
    if (sessionCwd) {
      const normalizedCwd = sessionCwd.replace(/\\/g, "/");
      for (const [projectPath, projectData] of Object.entries(projects)) {
        if (projectPath.toLowerCase() === normalizedCwd.toLowerCase()) {
          const pd = projectData as Record<string, unknown>;
          costUsd = pd.lastCost as number | undefined;
          break;
        }
      }
    }

    return { costUsd, billingType, hasExtraUsageEnabled };
  } catch {
    return null;
  }
}

export function readLatestSessionModel(claudeDir: string): string | null {
  const filePath = findGlobalLatestJsonl(claudeDir);
  if (!filePath) return null;

  try {
    const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.model) return entry.model;
        if (entry.message?.model) return entry.message.model;
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function readLatestSessionTokens(claudeDir: string): SessionTokens | null {
  const filePath = findGlobalLatestJsonl(claudeDir);
  if (!filePath) return null;

  try {
    const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        const usage = entry.message?.usage ?? entry.usage;
        if (usage && usage.input_tokens !== undefined) {
          return {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
            cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
            cacheReadTokens: usage.cache_read_input_tokens ?? 0,
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}
