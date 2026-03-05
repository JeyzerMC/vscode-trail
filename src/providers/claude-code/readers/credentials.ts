import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";
import { CredentialsData } from "../../../types";

let cachedToken: string | null = null;
let cachedTokenMtime: number = 0;

function readFromKeychain(): string | null {
  try {
    const result = execFileSync(
      "security",
      [
        "find-generic-password",
        "-s",
        "Claude Code-credentials",
        "-w",
      ],
      { encoding: "utf-8", timeout: 5000 }
    ).trim();
    const parsed = JSON.parse(result);
    return parsed?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

function readFromFile(claudeDir: string): {
  token: string | null;
  data: CredentialsData | null;
} {
  const filePath = path.join(claudeDir, ".credentials.json");
  try {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;

    if (cachedToken && mtime === cachedTokenMtime) {
      return { token: cachedToken, data: null };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const data: CredentialsData = JSON.parse(content);
    const token = data.claudeAiOauth?.accessToken ?? null;

    cachedToken = token;
    cachedTokenMtime = mtime;

    return { token, data };
  } catch {
    return { token: null, data: null };
  }
}

export function readOAuthToken(claudeDir: string): string | null {
  if (os.platform() === "darwin") {
    const keychainToken = readFromKeychain();
    if (keychainToken) return keychainToken;
  }
  return readFromFile(claudeDir).token;
}

export function readCredentials(claudeDir: string): CredentialsData | null {
  const filePath = path.join(claudeDir, ".credentials.json");
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
