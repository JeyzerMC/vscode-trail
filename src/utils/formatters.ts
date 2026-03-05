export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}

export function formatTimeRemaining(resetsAt: string | null): string {
  if (!resetsAt) return "--";
  const now = Date.now();
  const resetTime = new Date(resetsAt).getTime();
  const diffMs = resetTime - now;

  if (diffMs <= 0) return "now";

  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export type ThresholdLevel = "normal" | "warning" | "error";

export function getThresholdLevel(utilization: number): ThresholdLevel {
  if (utilization >= 80) return "error";
  if (utilization >= 50) return "warning";
  return "normal";
}
