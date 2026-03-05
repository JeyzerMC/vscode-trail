# Trail - Project Memory

## Project Overview
- VSCode extension for monitoring LLM agent usage in the status bar
- TypeScript + esbuild, no framework for webview
- Provider pattern: ClaudeCodeProvider first, extensible for future agents

## Key Data Sources
- `~/.claude/usage-cache.json` — raw 5h/7d counts + reset timestamps (fallback)
- `GET https://api.anthropic.com/api/oauth/usage` — primary source for utilization %
  - Headers: `Authorization: Bearer {token}`, `anthropic-beta: oauth-2025-04-20`
  - Response: `{ five_hour, seven_day, seven_day_sonnet }` each with `utilization` (0-100) and `resets_at`
- `~/.claude/.credentials.json` — OAuth token at `creds.claudeAiOauth.accessToken` (Windows/Linux)
- macOS: Keychain `security find-generic-password` service `Claude Code-credentials`
- `~/.claude/backups/.claude.json.backup.*` — per-project token counts, cost, subscription info
- `~/.claude/projects/<project>/<session>.jsonl` — session/model data

## Reference Implementation
- `~/.claude/plugins/cache/claude-dashboard/claude-dashboard/1.15.0/` has working API client, credential reader, types

## Design Decisions
- Single configurable status bar item (all metrics compact by default)
- Rich webview panel on click (progress bars, timers, theme-aware)
- 30s refresh + FileSystemWatcher for instant updates
- Each metric tracks its own status (fresh/stale/unavailable)
- API cache TTL: 60s, credential cache: mtime-based

## Plan
- Full design: `docs/plans/2026-03-05-trail-design.md`
