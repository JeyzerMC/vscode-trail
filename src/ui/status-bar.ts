import * as vscode from "vscode";
import { AgentMetrics, MetricKey } from "../types";
import {
  formatPercentage,
  formatTokenCount,
  formatTimeRemaining,
  formatCost,
  getThresholdLevel,
  ThresholdLevel,
} from "../utils/formatters";

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private enabledMetrics: MetricKey[];

  constructor(
    position: "left" | "right",
    priority: number,
    metrics: MetricKey[]
  ) {
    const alignment =
      position === "left"
        ? vscode.StatusBarAlignment.Left
        : vscode.StatusBarAlignment.Right;
    this.statusBarItem = vscode.window.createStatusBarItem(
      alignment,
      priority
    );
    this.statusBarItem.command = "trail.openDashboard";
    this.enabledMetrics = metrics;
    this.statusBarItem.show();
  }

  updateMetrics(metrics: AgentMetrics): void {
    const parts: string[] = [];
    let worstLevel: ThresholdLevel = "normal";

    for (const key of this.enabledMetrics) {
      const { text, level } = this.formatMetric(key, metrics);
      if (text) parts.push(text);
      if (levelSeverity(level) > levelSeverity(worstLevel)) {
        worstLevel = level;
      }
    }

    this.statusBarItem.text = `$(sparkle) ${parts.join(" | ") || "Trail"}`;
    this.statusBarItem.tooltip = this.buildTooltip(metrics);

    // Apply color based on worst threshold
    if (worstLevel === "error") {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground"
      );
    } else if (worstLevel === "warning") {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  updateConfig(metrics: MetricKey[]): void {
    this.enabledMetrics = metrics;
  }

  private formatMetric(
    key: MetricKey,
    metrics: AgentMetrics
  ): { text: string; level: ThresholdLevel } {
    switch (key) {
      case "model": {
        const m = metrics.model;
        if (!m || !m.value) return { text: "", level: "normal" };
        return { text: m.value.displayName, level: "normal" };
      }
      case "rateLimit5h": {
        const rl = metrics.rateLimits;
        if (!rl?.value?.fiveHour) return { text: "5h: --", level: "normal" };
        const util = rl.value.fiveHour.utilization;
        return {
          text: `5h: ${formatPercentage(util)}`,
          level: getThresholdLevel(util),
        };
      }
      case "rateLimit7d": {
        const rl = metrics.rateLimits;
        if (!rl?.value?.sevenDay) return { text: "7d: --", level: "normal" };
        const util = rl.value.sevenDay.utilization;
        return {
          text: `7d: ${formatPercentage(util)}`,
          level: getThresholdLevel(util),
        };
      }
      case "rateLimit7dSonnet": {
        const rl = metrics.rateLimits;
        if (!rl?.value?.sevenDaySonnet)
          return { text: "", level: "normal" };
        const util = rl.value.sevenDaySonnet.utilization;
        return {
          text: `7dS: ${formatPercentage(util)}`,
          level: getThresholdLevel(util),
        };
      }
      case "context": {
        const ctx = metrics.contextWindow;
        if (!ctx?.value) return { text: "Ctx: --", level: "normal" };
        const pct = (ctx.value.usedTokens / ctx.value.maxTokens) * 100;
        return {
          text: `Ctx: ${formatPercentage(pct)}`,
          level: getThresholdLevel(pct),
        };
      }
      case "cost": {
        const c = metrics.cost;
        if (!c?.value) return { text: "", level: "normal" };
        return { text: formatCost(c.value.totalCostUsd), level: "normal" };
      }
      case "subscription": {
        const s = metrics.subscription;
        if (!s?.value) return { text: "", level: "normal" };
        return { text: s.value.plan, level: "normal" };
      }
      default:
        return { text: "", level: "normal" };
    }
  }

  private buildTooltip(metrics: AgentMetrics): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    md.appendMarkdown("### Trail - Claude Code Usage\n\n");

    // Model
    if (metrics.model?.value) {
      md.appendMarkdown(
        `**Model:** ${metrics.model.value.displayName} (\`${metrics.model.value.id}\`)\n\n`
      );
    }

    // Rate limits
    const rl = metrics.rateLimits?.value;
    if (rl) {
      if (rl.fiveHour) {
        md.appendMarkdown(
          `**5h Limit:** ${formatPercentage(rl.fiveHour.utilization)} — resets in ${formatTimeRemaining(rl.fiveHour.resetsAt)}\n\n`
        );
      }
      if (rl.sevenDay) {
        md.appendMarkdown(
          `**7d Limit:** ${formatPercentage(rl.sevenDay.utilization)} — resets in ${formatTimeRemaining(rl.sevenDay.resetsAt)}\n\n`
        );
      }
      if (rl.sevenDaySonnet) {
        md.appendMarkdown(
          `**7d Sonnet:** ${formatPercentage(rl.sevenDaySonnet.utilization)} — resets in ${formatTimeRemaining(rl.sevenDaySonnet.resetsAt)}\n\n`
        );
      }
    }

    // Context window
    const ctx = metrics.contextWindow?.value;
    if (ctx) {
      const pct = (ctx.usedTokens / ctx.maxTokens) * 100;
      md.appendMarkdown(
        `**Context:** ${formatTokenCount(ctx.usedTokens)} / ${formatTokenCount(ctx.maxTokens)} (${formatPercentage(pct)})\n\n`
      );
      if (ctx.breakdown) {
        md.appendMarkdown(
          `  Input: ${formatTokenCount(ctx.breakdown.inputTokens)} | Output: ${formatTokenCount(ctx.breakdown.outputTokens)} | Cache: ${formatTokenCount(ctx.breakdown.cacheReadTokens)}\n\n`
        );
      }
    }

    // Cost
    if (metrics.cost?.value) {
      md.appendMarkdown(
        `**Session Cost:** ${formatCost(metrics.cost.value.totalCostUsd)}\n\n`
      );
    }

    // Subscription
    if (metrics.subscription?.value) {
      md.appendMarkdown(
        `**Plan:** ${metrics.subscription.value.plan} | Extra: ${metrics.subscription.value.extraUsageEnabled ? "enabled" : "disabled"}\n\n`
      );
    }

    md.appendMarkdown("---\n*Click to open dashboard*");

    return md;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}

function levelSeverity(level: ThresholdLevel): number {
  switch (level) {
    case "error":
      return 2;
    case "warning":
      return 1;
    case "normal":
      return 0;
  }
}
