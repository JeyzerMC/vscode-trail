import { UsageLimitsResponse } from "../../../types";

let cachedResponse: UsageLimitsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

let pendingRequest: Promise<UsageLimitsResponse | null> | null = null;

export async function fetchUsageLimits(
  token: string
): Promise<UsageLimitsResponse | null> {
  const now = Date.now();
  if (cachedResponse && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedResponse;
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = doFetch(token).finally(() => {
    pendingRequest = null;
  });

  return pendingRequest;
}

async function doFetch(token: string): Promise<UsageLimitsResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "trail/0.1.0",
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return cachedResponse;
    }

    const data = (await response.json()) as UsageLimitsResponse;
    cachedResponse = data;
    cacheTimestamp = Date.now();
    return data;
  } catch {
    return cachedResponse;
  }
}

export function clearUsageLimitsCache(): void {
  cachedResponse = null;
  cacheTimestamp = 0;
}
