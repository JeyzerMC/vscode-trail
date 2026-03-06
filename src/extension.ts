import * as vscode from "vscode";
import { MetricKey } from "./types";
import { ProviderRegistry } from "./providers/registry";
import { ClaudeCodeProvider } from "./providers/claude-code/provider";
import { MetricsStore } from "./state/store";
import { StatusBarManager } from "./ui/status-bar";
import { DashboardPanel } from "./ui/webview/panel";

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("trail");

  // Initialize provider registry
  const registry = new ProviderRegistry();
  const claudeDataPath = config.get<string>("claudeDataPath") || undefined;
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  registry.register(new ClaudeCodeProvider(claudeDataPath, workspacePath));

  // Get active provider
  const providerId = config.get<string>("activeProvider", "claude-code");
  const provider = registry.get(providerId);
  if (!provider) {
    vscode.window.showWarningMessage(
      `Trail: Provider "${providerId}" not found.`
    );
    return;
  }

  // Initialize provider
  provider.initialize();

  // Create store
  const store = new MetricsStore();
  const intervalMs = config.get<number>("refreshInterval", 30) * 1000;
  store.start(provider, intervalMs);

  // Create status bar
  const position = config.get<"left" | "right">("statusBar.position", "right");
  const priority = config.get<number>("statusBar.priority", 100);
  const metrics = config.get<MetricKey[]>("statusBar.metrics", [
    "model",
    "rateLimit5h",
    "rateLimit7d",
    "context",
  ]);
  const statusBar = new StatusBarManager(position, priority, metrics);

  // Create dashboard panel with refresh callback
  const dashboard = new DashboardPanel(context.extensionUri, () => {
    store.refresh();
  });

  // Wire up updates
  store.onDidUpdate((metricsData) => {
    statusBar.updateMetrics(metricsData);
    dashboard.updateMetrics(metricsData);
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("trail.openDashboard", () => {
      dashboard.show();
      // Send current metrics immediately when opening
      dashboard.updateMetrics(store.getMetrics());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("trail.refresh", () => {
      store.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("trail.debugInfo", () => {
      const m = store.getMetrics();
      const lines = [
        `Workspace: ${workspacePath ?? "(none)"}`,
        `Model: ${m.model?.value?.id ?? m.model?.status ?? "unavailable"}`,
        `Rate limits: ${m.rateLimits?.status ?? "unavailable"}`,
        `Context: ${m.contextWindow?.status ?? "unavailable"}`,
        `Cost: ${m.cost?.status ?? "unavailable"}`,
        `Subscription: ${m.subscription?.value?.plan ?? m.subscription?.status ?? "unavailable"}`,
      ];
      vscode.window.showInformationMessage(lines.join(" | "));
    })
  );

  // React to configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("trail.refreshInterval")) {
        const newInterval =
          vscode.workspace
            .getConfiguration("trail")
            .get<number>("refreshInterval", 30) * 1000;
        store.updateInterval(newInterval);
      }
      if (e.affectsConfiguration("trail.statusBar.metrics")) {
        const newMetrics = vscode.workspace
          .getConfiguration("trail")
          .get<MetricKey[]>("statusBar.metrics", [
            "model",
            "rateLimit5h",
            "rateLimit7d",
            "context",
          ]);
        statusBar.updateConfig(newMetrics);
        statusBar.updateMetrics(store.getMetrics());
      }
    })
  );

  // Register disposables
  context.subscriptions.push(store, statusBar, dashboard, registry);
}

export function deactivate() {
  // Cleanup handled by disposables
}
