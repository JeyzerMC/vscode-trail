import * as fs from "fs";
import * as path from "path";
import { UsageCacheData } from "../../../types";

export function readUsageCache(
  claudeDir: string
): UsageCacheData | null {
  const filePath = path.join(claudeDir, "usage-cache.json");
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    return {
      five_hour: data.five_hour ?? null,
      seven_day: data.seven_day ?? null,
      seven_day_sonnet: data.seven_day_sonnet ?? null,
      five_hour_resets_at: data.five_hour_resets_at ?? null,
      seven_day_resets_at: data.seven_day_resets_at ?? null,
    };
  } catch {
    return null;
  }
}
