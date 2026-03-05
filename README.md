# Trail

Monitor your LLM agent usage directly in the VSCode status bar.

Trail reads Claude Code's local data files and API to surface rate limits, context window usage, model info, and more — without leaving your editor.

## Features

- **Status bar metrics** — configurable, compact display with color-coded thresholds
- **Rich dashboard** — click the status bar to open a detailed panel with progress bars and countdown timers
- **Live updates** — 30-second polling + file watchers for instant changes
- **Configurable** — choose which metrics to show, refresh interval, and position

### Status Bar

```
$(sparkle) Opus | 5h: 15% | 7d: 32% | Ctx: 47%
```

Color coding:
- Green (default): < 50% usage
- Yellow: 50–80% usage
- Red: > 80% usage

### Dashboard

Click the status bar item to open a rich dashboard showing:
- Current model
- 5-hour and 7-day rate limit progress bars with reset countdowns
- Context window token usage with input/output/cache breakdown
- Session cost, subscription plan, and extra usage status

## Metrics

| Metric | Source |
|--------|--------|
| Rate limits (5h/7d) | Anthropic OAuth API |
| Context window | Local session data |
| Model | Session JSONL files |
| Cost | Backup state files |
| Subscription | Credentials file |

No API key needed — Trail reuses Claude Code's existing OAuth token.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `trail.refreshInterval` | `30` | Refresh interval in seconds (5–300) |
| `trail.statusBar.metrics` | `["model", "rateLimit5h", "rateLimit7d", "context"]` | Metrics to show |
| `trail.statusBar.position` | `"right"` | Status bar side (`left` or `right`) |
| `trail.statusBar.priority` | `100` | Status bar priority |
| `trail.activeProvider` | `"claude-code"` | Active LLM agent provider |
| `trail.claudeDataPath` | `""` | Override `~/.claude` path |

## Commands

- **Trail: Open Dashboard** — open the rich webview panel
- **Trail: Refresh Metrics** — force an immediate data refresh

## Development

```bash
npm install
npm run build    # one-time build
npm run watch    # rebuild on changes
```

Press **F5** in VSCode to launch the Extension Development Host for testing.

## Architecture

Trail uses a provider pattern — `ClaudeCodeProvider` is the first implementation, with the interface designed for adding other LLM agents in the future.

```
src/
  extension.ts              # Entry point
  types.ts                  # Shared interfaces
  providers/
    registry.ts             # Provider registry
    claude-code/
      provider.ts           # Claude Code provider
      readers/              # Data source readers
  state/
    store.ts                # Reactive metrics store
  ui/
    status-bar.ts           # Status bar manager
    webview/                # Dashboard panel
  utils/
    formatters.ts           # Display formatting
```

## License

MIT
