import * as fs from "fs";
import * as path from "path";

interface SessionInfo {
  modelId?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  costUsd?: number;
}

export function readLatestBackupMetrics(claudeDir: string): SessionInfo | null {
  const backupsDir = path.join(claudeDir, "backups");
  try {
    const files = fs.readdirSync(backupsDir).filter((f) =>
      f.startsWith(".claude.json.backup.")
    );
    if (files.length === 0) return null;

    // Find the latest backup by timestamp in filename
    const latest = files.sort((a, b) => {
      const tsA = parseInt(a.split(".").pop() ?? "0", 10);
      const tsB = parseInt(b.split(".").pop() ?? "0", 10);
      return tsB - tsA;
    })[0];

    const content = fs.readFileSync(
      path.join(backupsDir, latest),
      "utf-8"
    );
    const data = JSON.parse(content);

    // Find the current project's metrics
    const projects = data.projects;
    if (!projects || typeof projects !== "object") return null;

    // Get the current workspace folder to match against project keys
    const cwd = process.cwd().replace(/\\/g, "/");

    for (const [projectPath, projectData] of Object.entries(projects)) {
      const normalizedProject = projectPath.replace(/\\/g, "/");
      if (
        cwd.startsWith(normalizedProject) ||
        normalizedProject.startsWith(cwd)
      ) {
        const pd = projectData as Record<string, unknown>;
        return {
          totalInputTokens: pd.lastTotalInputTokens as number | undefined,
          totalOutputTokens: pd.lastTotalOutputTokens as number | undefined,
          cacheCreationTokens: pd.lastTotalCacheCreationInputTokens as
            | number
            | undefined,
          cacheReadTokens: pd.lastTotalCacheReadInputTokens as
            | number
            | undefined,
          costUsd: pd.lastCost as number | undefined,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function readLatestSessionModel(claudeDir: string): string | null {
  // Try to find model info from the most recent session JSONL
  const projectsDir = path.join(claudeDir, "projects");
  try {
    if (!fs.existsSync(projectsDir)) return null;

    // Encode current working directory to match project folder naming
    const cwd = process.cwd().replace(/\\/g, "/");
    const encoded = cwd.replace(/[/:]/g, "-");

    const projectDirs = fs.readdirSync(projectsDir);
    const matchDir = projectDirs.find(
      (d) =>
        d.toLowerCase().includes(encoded.toLowerCase()) ||
        encoded.toLowerCase().includes(d.toLowerCase())
    );

    if (!matchDir) return null;

    const sessionDir = path.join(projectsDir, matchDir);
    const jsonlFiles = fs
      .readdirSync(sessionDir)
      .filter((f) => f.endsWith(".jsonl") && !f.includes("subagent"));

    if (jsonlFiles.length === 0) return null;

    // Find the most recently modified session file
    const latestFile = jsonlFiles
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(sessionDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)[0];

    const content = fs.readFileSync(
      path.join(sessionDir, latestFile.name),
      "utf-8"
    );
    const lines = content.trim().split("\n");

    // Read from the end to find the most recent model reference
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
