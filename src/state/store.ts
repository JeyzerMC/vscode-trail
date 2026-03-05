import * as vscode from "vscode";
import { AgentMetrics, AgentProvider } from "../types";

export class MetricsStore implements vscode.Disposable {
  private metrics: AgentMetrics = {};
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private watchers: vscode.FileSystemWatcher[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly _onDidUpdate = new vscode.EventEmitter<AgentMetrics>();
  readonly onDidUpdate = this._onDidUpdate.event;

  private provider: AgentProvider | null = null;

  getMetrics(): AgentMetrics {
    return this.metrics;
  }

  start(provider: AgentProvider, intervalMs: number): void {
    this.stop();
    this.provider = provider;

    // Initial fetch
    this.refresh();

    // Periodic polling
    this.refreshTimer = setInterval(() => this.refresh(), intervalMs);

    // File watchers for instant updates
    for (const filePath of provider.getWatchedFiles()) {
      const pattern = new vscode.RelativePattern(
        vscode.Uri.file(filePath),
        ""
      );
      // Watch the parent directory for the specific file
      const dir = filePath.substring(0, filePath.lastIndexOf("/") >= 0 ? filePath.lastIndexOf("/") : filePath.lastIndexOf("\\"));
      const filename = filePath.substring(Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\")) + 1);
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(dir), filename)
      );
      watcher.onDidChange(() => this.debouncedRefresh());
      watcher.onDidCreate(() => this.debouncedRefresh());
      this.watchers.push(watcher);
    }
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
  }

  async refresh(): Promise<void> {
    if (!this.provider) return;
    try {
      this.metrics = await this.provider.getMetrics();
      this._onDidUpdate.fire(this.metrics);
    } catch {
      // Keep last known metrics on error
    }
  }

  updateInterval(intervalMs: number): void {
    if (!this.provider) return;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.refreshTimer = setInterval(() => this.refresh(), intervalMs);
  }

  private debouncedRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.refresh(), 100);
  }

  dispose(): void {
    this.stop();
    this._onDidUpdate.dispose();
  }
}
