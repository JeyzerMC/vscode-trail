import * as fs from "fs";
import * as path from "path";

interface SessionInfo {
  costUsd?: number;
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

// Read the cwd from the first line of the most recently active session JSONL.
function readLatestSessionCwd(claudeDir: string): string | null {
  const filePath = findGlobalLatestJsonl(claudeDir);
  if (!filePath) return null;
  try {
    const firstLine = fs.readFileSync(filePath, "utf-8").split("\n")[0];
    const entry = JSON.parse(firstLine);
    return (entry.cwd as string) ?? null;
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

    // Resolve the active session's project directory from its cwd field.
    // Backup keys use forward-slash paths (e.g., C:/Users/foo/bar).
    const sessionCwd = readLatestSessionCwd(claudeDir);
    if (!sessionCwd) return null;
    const normalizedCwd = sessionCwd.replace(/\\/g, "/");

    for (const [projectPath, projectData] of Object.entries(projects)) {
      if (projectPath.toLowerCase() === normalizedCwd.toLowerCase()) {
        const pd = projectData as Record<string, unknown>;
        return { costUsd: pd.lastCost as number | undefined };
      }
    }

    return null;
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
