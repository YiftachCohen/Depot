# Changelog

All notable changes to Depot are documented in this file.

## [1.2.5] - 2026-03-23

### Fixed

- **Remote MCP source tools not registered despite successful auth** — Bearer-auth HTTP MCP sources (e.g., Todoist) showed as connected and authenticated but registered zero tools. Root causes:
  1. The `source_test` connection validator never passed the MCP source's bearer token to the server — it checked for Claude API credentials instead, producing the misleading error "No Claude API key or OAuth token configured."
  2. After credential save, the MCP client pool wasn't synced until the next message, so tools weren't discovered immediately.
  3. No SSE transport fallback for MCP servers using the older protocol — connections failed silently.
  4. MCP pool connection failures were logged at debug level, invisible to users.

## [1.2.4] - 2026-03-23

### Fixed

- **MCP sources fail in agents but work in sources tab** — Two bugs caused MCP sources (like Todoist) to show as connected in the sources panel but fail with re-authentication errors when used through agents:
  1. URL normalization appended `/mcp` to server URLs, breaking servers that don't follow that path convention. The agent now uses the raw URL that was validated during connection testing.
  2. Expired OAuth tokens were rejected during agent startup even when the MCP server still accepted them. OAuth sources now use the token refresh manager which returns non-refreshable tokens as-is instead of rejecting them based on client-side expiry.

## [1.2.3] - 2026-03-23

### Fixed

- **Auto-update broken on macOS** — The release workflow's YAML merge script used a regex that failed to capture `sha512` and `size` fields from `latest-mac.yml`, writing `undefined` instead of real values. This caused electron-updater to fail silently on update checks. Fixed the regex to handle 4-space indented YAML properties.
- **No feedback on "Check for Updates" click** — Added fallback toast/dialog for update states that weren't previously handled, so users always see feedback when clicking the button (settings page and macOS menu).

## [1.2.1] - 2026-03-22

### Added

- **Knowledge observation scheduling** — Agents with `knowledge.observation_schedule` in their `depot.yaml` now automatically run observation loops on a cron schedule, scanning connected sources for changes and persisting findings to the knowledge store.
- **Observation guards** — Budget limits (`token_budget.per_day`), concurrency protection, entity caps, and failure tracking prevent runaway observation costs. Guards block duplicate observations and auto-clear stale locks on startup.
- **Knowledge browser panel** — Browse entities, patterns, and observation history inline on the skill dashboard. Includes domain filtering, search, confidence bars, relationship expansion, and a size warning banner for large stores (>5,000 entities).
- **Manual observation and consolidation triggers** — Run observations or consolidation on-demand from the knowledge section header with visible action buttons.
- **Observation health indicator** — Colored dot (green/yellow/red/gray) shows observation recency at a glance on skill cards and the detail view.
- **Observation history tab** — View recent observation runs with duration, token usage, and outcome.
- **Pause/resume observations** — Pause scheduled observations from the knowledge panel dropdown without disabling the skill.
- **Post-observation consolidation** — Automatic deduplication and confidence decay runs after each successful observation.
- **Failure notifications** — After 3 consecutive observation failures, a warning notification alerts the user to check source connectivity.
- **Turn limiting** — `max_observation_turns` in the manifest caps agent tool-use cycles per observation session.
- **Scrollable memory panel** — Agent memory list is now scrollable with text wrapping for long entries.
- **Consolidation scheduling** — Scheduled knowledge consolidation runs independently on its own cron schedule.

### Security

- **CVE remediation: 34 → 1 vulnerability.** Added 16 `overrides` in `package.json` to force-resolve transitive dependency CVEs (minimatch, undici, basic-ftp, underscore, axios, hono, tar, and more). Only remaining vuln is `@github/copilot` (awaiting upstream fix).
- **Removed Sentry entirely** — No external crash telemetry for enterprise deployments. Crash data stays on-device via `electron-log`. Removed from 11 files (main process, renderer, preload, build scripts, tests).
- **Replaced `markitdown-js` with `mammoth` + `turndown`** — Eliminated 4 CVEs and ~20 transitive dependencies (xmldom, xlsx, @azure/identity, axios, exiftool, ffmpeg, tesseract). DOCX conversion uses pure-JS mammoth+turndown; XLSX/PPTX falls back to the bundled Python CLI.
- **Supply chain hardening** — Pinned wildcard dependency (`beautiful-mermaid@*` → `^1.1.3`), created `.npmrc` with `audit=true`, pinned beta dependencies to exact versions.

- Unit tests for office file conversion pipeline (`files-office-convert.isolated.ts`).

## [1.1.2] - 2026-03-22

### Added

- **Knowledge Fabric** — Agents can now build structured knowledge graphs that persist across sessions. Enable `knowledge: { enabled: true }` in your `depot.yaml` to give an agent three new tools: `save_knowledge` (entities, relationships, patterns, observations), `query_knowledge` (search by tag, domain, or type), and `reset_knowledge` (clear all or by domain). Knowledge is stored in SQLite and automatically injected into the agent's system prompt for context-aware answers.
- **Automatic knowledge extraction** — At the end of each session, agents auto-extract entities, relationships, and patterns from the conversation. MCP tool responses are also scanned heuristically for entity extraction in the background.
- **Morning briefing** — Knowledge-enabled agents show a briefing of what changed since your last session, surfaced via `lastUserSessionTimestamp` tracking.
- **Dashboard knowledge indicators** — Agent cards on the skill dashboard now display entity and relationship counts, so you can see at a glance which agents have learned the most.
- **Knowledge-enabled templates** — Five built-in agent templates ship with knowledge enabled: Code Review, Docs Writer, Architecture, CI/CD, and Cloud Security.

### Fixed

- Auto-update error messages are now surfaced to the user instead of being silently masked as "up to date."
- Knowledge tool callbacks are fully async-compatible with proper size validation.
- PII stripping applied to all knowledge text fields (entities, relationships, patterns, observations).
- Project-scoped skill resolution passes `projectRoot` consistently through all code paths, preventing split knowledge stores.
- Pi agents no longer receive knowledge tool instructions for tools they don't have access to.
- Opportunistic learning no longer persists raw MCP tool output as observations (trust boundary fix).
- Session-end knowledge extraction validates field types and lengths before writing to the store.
- Dashboard knowledge badges now refresh in real time via `agentState:changed` events.
- Cached knowledge skill reference resets on manifest change via config watcher.

## [1.1.1] - 2026-03-21

- Initial open-source release with skill dashboard, cross-session memory, agent personality, source auto-resolution, and AWS Bedrock support.
