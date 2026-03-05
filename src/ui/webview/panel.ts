import * as fs from "fs";
import * as vscode from "vscode";
import { AgentMetrics } from "../../types";

export class DashboardPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private readonly extensionUri: vscode.Uri;
  private onRefreshRequest?: () => void;

  constructor(extensionUri: vscode.Uri, onRefreshRequest?: () => void) {
    this.extensionUri = extensionUri;
    this.onRefreshRequest = onRefreshRequest;
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    const mediaUri = vscode.Uri.joinPath(this.extensionUri, "media");

    this.panel = vscode.window.createWebviewPanel(
      "trailDashboard",
      "Trail Dashboard",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [mediaUri],
      }
    );

    this.panel.webview.html = this.buildHtml(this.panel.webview, mediaUri);

    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "refresh" && this.onRefreshRequest) {
        this.onRefreshRequest();
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = null;
    });
  }

  updateMetrics(metrics: AgentMetrics): void {
    if (!this.panel) return;
    this.panel.webview.postMessage({ type: "update", metrics });
  }

  get isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  dispose(): void {
    this.panel?.dispose();
    this.panel = null;
  }

  private buildHtml(webview: vscode.Webview, mediaUri: vscode.Uri): string {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaUri, "dashboard.css")
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaUri, "dashboard.js")
    );

    const htmlPath = vscode.Uri.joinPath(mediaUri, "dashboard.html").fsPath;
    return fs
      .readFileSync(htmlPath, "utf-8")
      .replace(/\{\{cssUri\}\}/g, cssUri.toString())
      .replace(/\{\{jsUri\}\}/g, jsUri.toString())
      .replace(/\{\{cspSource\}\}/g, webview.cspSource);
  }
}
