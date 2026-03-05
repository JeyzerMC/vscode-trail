# Trail - VSCode Extension for LLM Agent Usage Monitoring

## Context

There's no way to see Claude Code usage limits (5h session, 7d rolling, context window) from within VSCode without switching to the terminal. Trail solves this by surfacing these metrics directly in the VSCode status bar with a rich dashboard panel on click. The architecture is designed as a provider pattern so other LLM agents can be added later.

## Data Sources

All data comes from local files + one authenticated API call (using existing OAuth token):

| Data | Source | Notes |
|------|--------|-------|
| Rate limits (5h/7d) | Anthropic OAuth API (`/api/oauth/usage`) | Returns utilization % + reset times |
| Rate limit fallback | `~/.claude/usage-cache.json` | Raw counts + reset timestamps |
| OAuth token | `~/.claude/credentials.json` | Used to authenticate API calls |
| Per-project tokens | `~/.claude/backups/.claude.json.backup.*` | Input/output/cache token counts, cost |
| Session/model info | `~/.claude/projects/<project>/<session>.jsonl` | Model ID, session metadata |
| Subscription info | `~/.claude/credentials.json` | Plan type, extra usage status |

### API Details

**Endpoint:** `GET https://api.anthropic.com/api/oauth/usage`

**Headers:**
```
Accept: application/json
Content-Type: application/json
User-Agent: trail/{VERSION}
Authorization: Bearer {oauth_token}
anthropic-beta: oauth-2025-04-20
```

**Response:**
```typescript
interface UsageLimits {
  five_hour: { utilization: number; resets_at: string | null } | null;
  seven_day: { utilization: number; resets_at: string | null } | null;
  seven_day_sonnet: { utilization: number; resets_at: string | null } | null;
}
```

**Credential reading:**
- macOS: Keychain via `security find-generic-password` (service: `Claude Code-credentials`)
- Windows/Linux: `~/.claude/.credentials.json` → `creds.claudeAiOauth.accessToken`

## Architecture

### Project Structure

```
trail/
  src/
    extension.ts                   # activate/deactivate entry point
    types.ts                       # Shared interfaces (AgentMetrics, AgentProvider)
    providers/
      registry.ts                  # Provider registry
      claude-code/
        provider.ts                # ClaudeCodeProvider implements AgentProvider
        readers/
          usage-cache.ts           # Reads usage-cache.json
          credentials.ts           # Reads OAuth token
          session.ts               # Reads session JSONL files
          api-client.ts            # Calls Anthropic /api/oauth/usage
    state/
      store.ts                     # EventEmitter-based metrics store
    ui/
      status-bar.ts                # Configurable status bar items
      webview/
        panel.ts                   # WebviewPanel lifecycle + messaging
        dashboard.html             # HTML template
        dashboard.css              # Styles (uses VSCode CSS variables)
        dashboard.js               # Client-side update logic
    utils/
      file-watcher.ts              # Debounced FileSystemWatcher wrapper
      formatters.ts                # Token counts, time remaining, percentages
  media/
    icon.svg                       # Extension icon
  package.json                     # Manifest + contributes (settings, commands)
  tsconfig.json
  esbuild.config.mjs
  .vscodeignore
```

### Core Interfaces

```typescript
interface AgentMetrics {
  model?: { id: string; displayName: string };
  contextWindow?: { usedTokens: number; maxTokens: number; breakdown?: TokenBreakdown };
  rateLimits?: {
    fiveHour?: { utilization: number; resetsAt: string | null };
    sevenDay?: { utilization: number; resetsAt: string | null };
    sevenDaySonnet?: { utilization: number; resetsAt: string | null };
  };
  subscription?: { plan: string; extraUsageEnabled: boolean };
  cost?: { totalCostUsd: number };
}

interface AgentProvider {
  readonly id: string;
  readonly displayName: string;
  initialize(): Promise<void>;
  dispose(): void;
  getMetrics(): Promise<AgentMetrics>;
  getWatchedFiles(): string[];
  isAvailable(): Promise<boolean>;
}
```

### Data Flow

```
[FileSystemWatcher on usage-cache.json]  +  [30s Timer]
                |                              |
                v                              v
         ClaudeCodeProvider.getMetrics()
          |-- reads usage-cache.json (fallback)
          |-- calls /api/oauth/usage (primary, cached 60s)
          |-- reads latest session JSONL (model, tokens)
          |-- reads credentials.json (subscription)
                |
                v
          MetricsStore (EventEmitter)
           |                    |
           v                    v
    StatusBarManager      WebviewPanel (on click)
```

### Settings Schema

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `trail.refreshInterval` | number | 30 | Refresh interval in seconds (5-300) |
| `trail.activeProvider` | string | `claude-code` | Active LLM agent provider |
| `trail.statusBar.metrics` | string[] | `["model","rateLimit5h","rateLimit7d","context"]` | Which metrics to show |
| `trail.statusBar.position` | `left`/`right` | `right` | Status bar side |
| `trail.statusBar.priority` | number | 100 | Priority (higher = more left) |
| `trail.claudeDataPath` | string | `""` | Override ~/.claude path |

### Status Bar Display

Single status bar item, configurable metrics, pipe-delimited:
```
$(sparkle) Opus | 5h: 15% | 7d: 32% | Ctx: 47%
```

Color coding: green (default), yellow (50-80%), red (>80%)

### Webview Dashboard

Rich HTML panel with progress bars, countdown timers, token breakdown, subscription info. Uses VSCode CSS variables for theme compatibility. Updates via postMessage from extension host.

### Error Handling

Each metric independently tracks status: `fresh`, `stale`, `unavailable`. Status bar shows `--` for unavailable metrics.

## Implementation Steps

1. Project scaffold (npm, TypeScript, esbuild, package.json manifest)
2. Types and provider interface
3. Claude Code data readers (usage-cache, credentials, api-client, session)
4. Claude Code provider (wire readers together)
5. Metrics store (EventEmitter + polling + file watchers)
6. Status bar UI (configurable, color-coded)
7. Webview dashboard (HTML/CSS/JS, progress bars, timers)
8. Settings and commands (configuration, onDidChangeConfiguration)
