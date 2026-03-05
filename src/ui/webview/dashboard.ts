import type { AgentMetrics, RateLimit, TokenBreakdown } from "../../types";

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};

const vscode = acquireVsCodeApi();

document.getElementById("refreshBtn")!.addEventListener("click", () => {
  vscode.postMessage({ type: "refresh" });
});

// ── Formatting helpers ──────────────────────────────────────────────────────

function formatTokens(count: number): string {
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + "M";
  if (count >= 1_000) return (count / 1_000).toFixed(1) + "k";
  return String(count);
}

function formatTimeRemaining(resetsAt: string | null): string {
  if (!resetsAt) return "--";
  const diffMs = new Date(resetsAt).getTime() - Date.now();
  if (diffMs <= 0) return "now";
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function thresholdClass(pct: number): string {
  if (pct >= 80) return "error";
  if (pct >= 50) return "warning";
  return "";
}

// ── Meter update ────────────────────────────────────────────────────────────

function updateMeter(
  barId: string,
  valueId: string,
  detailId: string | null,
  limit: RateLimit | null | undefined
): void {
  const bar = document.getElementById(barId)!;
  const value = document.getElementById(valueId)!;
  const detail = detailId ? document.getElementById(detailId) : null;

  if (!limit) {
    value.textContent = "--";
    bar.style.width = "0%";
    bar.className = "meter-fill";
    if (detail) detail.textContent = "";
    return;
  }

  const pct = Math.round(limit.utilization);
  value.textContent = `${pct}%`;
  bar.style.width = `${Math.min(pct, 100)}%`;
  bar.className = `meter-fill ${thresholdClass(pct)}`.trimEnd();
  if (detail) detail.textContent = `Resets in ${formatTimeRemaining(limit.resetsAt)}`;
}

// ── Token breakdown ─────────────────────────────────────────────────────────

function renderBreakdown(
  container: HTMLElement,
  breakdown: TokenBreakdown | null | undefined
): void {
  while (container.firstChild) container.removeChild(container.firstChild);
  if (!breakdown) return;

  for (const text of [
    `Input: ${formatTokens(breakdown.inputTokens)}`,
    `Output: ${formatTokens(breakdown.outputTokens)}`,
    `Cache: ${formatTokens(breakdown.cacheReadTokens)}`,
  ]) {
    const span = document.createElement("span");
    span.textContent = text;
    container.appendChild(span);
  }
}

// ── Message handler ─────────────────────────────────────────────────────────

window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as { type: string; metrics: AgentMetrics };
  if (msg.type !== "update") return;
  const m = msg.metrics;

  // Model
  const modelName = document.getElementById("modelName")!;
  const modelId = document.getElementById("modelId")!;
  if (m.model?.value) {
    modelName.textContent = m.model.value.displayName;
    modelName.className = "model-display";
    modelId.textContent = m.model.value.id;
  } else {
    modelName.textContent = "No model detected";
    modelName.className = "model-display unavailable";
    modelId.textContent = "";
  }

  // Rate limits
  const rl = m.rateLimits?.value;
  updateMeter("fiveHourBar", "fiveHourValue", "fiveHourDetail", rl?.fiveHour);
  updateMeter("sevenDayBar", "sevenDayValue", "sevenDayDetail", rl?.sevenDay);

  const sonnetRow = document.getElementById("sevenDaySonnetRow")!;
  if (rl?.sevenDaySonnet) {
    sonnetRow.style.display = "";
    updateMeter("sevenDaySonnetBar", "sevenDaySonnetValue", "sevenDaySonnetDetail", rl.sevenDaySonnet);
  } else {
    sonnetRow.style.display = "none";
  }

  // Context window
  const ctx = m.contextWindow?.value;
  const contextValue = document.getElementById("contextValue")!;
  const contextBar = document.getElementById("contextBar")!;
  const tokenBreakdown = document.getElementById("tokenBreakdown")!;

  if (ctx) {
    const pct = (ctx.usedTokens / ctx.maxTokens) * 100;
    contextValue.textContent = `${formatTokens(ctx.usedTokens)} / ${formatTokens(ctx.maxTokens)} (${Math.round(pct)}%)`;
    contextBar.style.width = `${Math.min(pct, 100)}%`;
    contextBar.className = `meter-fill ${thresholdClass(pct)}`.trimEnd();
    renderBreakdown(tokenBreakdown, ctx.breakdown);
  } else {
    contextValue.textContent = "--";
    contextBar.style.width = "0%";
    renderBreakdown(tokenBreakdown, null);
  }

  // Session info
  document.getElementById("costValue")!.textContent =
    m.cost?.value ? `$${m.cost.value.totalCostUsd.toFixed(2)}` : "--";
  document.getElementById("planValue")!.textContent =
    m.subscription?.value?.plan ?? "--";
  document.getElementById("extraUsageValue")!.textContent =
    m.subscription?.value
      ? m.subscription.value.extraUsageEnabled ? "Enabled" : "Disabled"
      : "--";
});
