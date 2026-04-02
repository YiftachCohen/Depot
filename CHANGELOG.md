# Changelog

All notable changes to Depot are documented in this file.

## [Unreleased]

## [1.2.14] - 2026-04-02

### Changed

- **Memory v2 removed** — The legacy `save_agent_memory` tool and flat-fact memory system has been removed. All cross-session persistence now uses the Knowledge Fabric (`save_knowledge` / `query_knowledge`). Existing memory facts are auto-migrated to knowledge entities on first knowledge store open.
- **`memory: { enabled: true }` deprecated** — Manifests using the old memory field are auto-promoted to `knowledge: { enabled: true }` at parse time with a deprecation warning. Update your `depot.yaml` to use `knowledge` instead.
- **Personality pinned for prompt caching** — Agent personality is now injected into the static system prompt (instead of per-turn context blocks), enabling SDK prompt caching across turns.
- **Skill manifest caching** — `BaseAgent` caches the resolved skill manifest in memory, avoiding repeated disk reads every turn.
- **Workspace capabilities cached** — `PromptBuilder` caches the workspace capabilities string since it doesn't change during a session.

### Removed

- `save_agent_memory` session tool
- `AgentMemoryPanel` component and memory CRUD UI (replaced by Knowledge Browser)
- 4 memory RPC channels (`addMemory`, `getMemory`, `deleteFact`, `clearMemory`)
- Memory operations from `agent-state.ts` (`addMemoryFacts`, `deleteMemoryFact`, `replaceMemoryFacts`, `formatAgentMemoryForPrompt`)
- Session-end LLM-based memory summarization (superseded by knowledge extraction)
- `memory: { enabled: true }` from all built-in agent templates (all use `knowledge` now)

## [1.2.13] - 2026-03-28

### Added

- **Agent color picker** — Per-agent custom accent color from the warm ACCENT_PALETTE. Swatches appear in the icon picker area on the agent profile page. Color persists to `depot.yaml` and overrides the default slug-based hash.
- **Agent model selector** — Dropdown in the agent profile Vital Signs section to set a default model per agent (from MODEL_REGISTRY). Clears with "Default" option.
- **Agent quick rename** — Pencil icon on hover next to the agent name opens a rename dialog. Saves to both `depot.yaml` and syncs to `SKILL.md` frontmatter.
- **Automations card in agent detail** — Full automations panel embedded in the agent profile view with test, toggle, delete, and execution history.

### Changed

- **Dashboard layout** — Agent grid now uses a responsive multi-column layout (up to 3 columns) with card-based design replacing the flat list. Max width increased to 960px.
- **Amber design system** — Activity dots, CTA buttons, recent activity feed, and command chips use warm amber accents per DESIGN.md. Pill-shaped chips with amber hover states.
- **Recent activity feed** — Shows agent icons, processing spinners, unread indicators, and amber-tinted hover states. Filtered to enabled agents only.
- **"+ Add Agent" button** — Moved from grid footer to header bar as an amber pill CTA.

### Fixed

- **Duplicate color palette** — Consolidated `getAccentColor` and `ACCENT_PALETTE` into canonical `dashboard/utils.tsx`. Removed DESIGN.md-violating violet/magenta from the old SkillDashboard copy.
- **Custom colors in grid and feed** — AgentGrid and recent activity feed now pass custom colors through `getAccentColor`, fixing inconsistency with the profile page.

## [1.2.12] - 2026-03-26

### Added

- **Sources quick setup wizard** — New "Quick Setup" dialog with a grid of 12 popular integrations (Linear, GitHub, Notion, Slack, Google Calendar, Google Drive, Gmail, Todoist, Jira, Exa, Microsoft Outlook, Local Folder). Click a service, authenticate inline, and the source appears ready to use — no manual config needed.
- **Template-based source creation** — Source templates with pre-filled configs for MCP, API, and local sources. Includes `resolveTemplateFields()` for safe placeholder resolution with domain validation to prevent URL injection.
- **Agent detail page redesign** — Living dossier layout with profile column, shift handoff cards, activity timeline, and knowledge story cards. Modular component architecture replacing the previous monolithic view.

### Changed

- **"+" button opens Quick Setup** — The sources panel "+" button now opens the Quick Setup wizard as the primary add-source path. Manual AI-chat setup is accessible via a "Manual setup" link at the bottom.
- **Connected source matching** — Quick setup grid correctly identifies connected sources by matching provider + service type (e.g., Google Calendar vs Gmail), not just provider name.

### Fixed

- **Zod schema parity** — Added `slackService`, `slackUserScopes`, `microsoftService`, `microsoftScopes` fields to `ApiSourceConfigSchema` to match TypeScript type definitions, preventing validation failures for Slack and Microsoft templates.
- **Service logo resolution** — Added `useTemplateLogo` hook for reliable service logo display with emoji fallback.

## [1.2.8] - 2026-03-24

### Changed

- **Dashboard refactored into modular components** — Extracted the monolithic SkillDashboard (1050+ lines) into focused components: TeamHealthBar, AgentGrid, AgentCard, ActivityFeed, and AgentDetailView. Improves maintainability and enables independent iteration on each section.
- **All quick commands visible on agent cards** — Agent cards now show all commands inline instead of truncating with "+N more". Commands fold/collapse when there are more than 6.
- **Accent palette aligned with DESIGN.md** — Removed violet and magenta from the agent color palette. All agents now use warm tones (amber, green, blue, red, teal, yellow, brown, sky) consistent with the Depot design system.
- **Search persists during no-results** — Health bar, action buttons, and activity feed remain visible when search returns no results. The "No agents enabled" empty state no longer incorrectly appears during active search.

### Added

- **Card skeleton loading** — Agent cards show subtle skeleton placeholders while stats load, distinguishing "loading" from "no data".
- **Warm activity empty state** — The empty activity feed now shows a friendly prompt ("Your agents are ready — run a quick command above to get started") instead of generic italic text.
- **TODO-DASH-002** — Deferred keyboard navigation optimization (roving tabindex for agent cards).

### Fixed

- **Duplicate accent palette** — Removed the old palette definition from SkillDashboard.tsx that still contained DESIGN.md-violating violet/magenta colors. All imports now use the canonical palette from dashboard/utils.tsx.
- **Dead code removed** — Removed unused AgentRoster, DetailPane components and unused state variables (selectedAgentSlug, selectedAgentSessions, accentMap).
- **Sort stability** — Agent sort now uses alphabetical slug as tiebreaker when timestamps are equal, preventing non-deterministic ordering.
- **Dock icon now matches the selected amber icon set and survives restarts** — The bundled macOS/Windows/Linux app icons were still on the old cyan/violet palette, so the Dock showed an icon that didn’t match any selectable option. Rebuilt the bundled icon assets from the default amber “Starburst Grid” source, persist the selected dock icon PNG to the Depot config directory, validate it before writing, and restore it on startup with fallback to the bundled icon if the persisted file is missing or invalid.

- **Remote MCP tools still not discoverable after v1.2.5 fix** — Despite the bearer auth fix in v1.2.5, ToolSearch still returned zero tools because:
  1. `markSourceAuthenticated()` set `connectionStatus: 'connected'` before any MCP handshake — the agent saw "Active" but had no tools. Now sets `'connecting'` and only transitions to `'connected'` after pool sync confirms tools are available.
  2. When `buildMcpServer` returned null for a freshly-authenticated source, `markSourceNeedsReauth()` destructively reset `isAuthenticated=false`, creating an infinite re-auth loop. Freshly-authenticated sources now skip this destructive cycle.
  3. Pool sync failures were invisible to the agent — no `<source_issue>` block was generated for `'error'` or `'connecting'` statuses. Both now surface diagnostic information.
  4. Connection status was never reconciled after pool sync — added `reconcileSourceConnectionStatus()` at all 6 `setSourceServers` call sites to reflect actual MCP connection state.
  5. Local/stdio sources were incorrectly marked as `'error'` when local MCP was disabled. Now excluded from remote connection reconciliation.

- **Stdio MCP sources with bearer auth fail silently** — Sources like `todoist-mcp` that run as stdio subprocesses and require an API key as an environment variable (e.g., `API_KEY`) would fail with "Connection closed" because `buildMcpServer` ignored the bearer token for stdio sources entirely. Added `McpSourceConfig.tokenEnvVar` field: when set, the bearer credential is injected into the subprocess env as `env[tokenEnvVar]`. Auto-infers the env var name from common patterns (`API_KEY`, `TOKEN`, etc.) during credential input.

## [1.2.8] - 2026-03-24

### Added

- **GitHub changelog links in update flows** — Update notifications now expose the exact GitHub release page from the ready-to-install toast, the Settings > About page, and the macOS app menu when an update is available.

### Changed

- **Updater state now carries release URLs** — Auto-update events include the matching GitHub release URL so renderer and native menu surfaces stay in sync without extra network requests.

### Fixed

- **Update CTA dismissals no longer suppress future prompts** — Clicking `Restart` or `View Changelog` on the ready-update toast no longer marks that version as dismissed. Only an actual manual dismiss persists the suppression.

## [1.2.7] - 2026-03-24

### Added

- **Per-agent model selection via depot.yaml** — Skills can now specify a default `model` and `llm_connection` in their manifest. Sessions created from that skill use the specified model/connection instead of the workspace default. Resolution chain: session option → manifest default → workspace default.
- **Per-action model override on quick commands** — Quick commands can specify a `model` field that overrides the agent's model for that single message turn only, then restores the previous model. Enables skills with mixed-model workflows (e.g., fast triage with Haiku, deep analysis with Opus).

### Changed

- **Quick command model field sanitized** — Non-string or empty `model` values in depot.yaml quick commands are now coerced to undefined instead of passing raw YAML values through to the runtime.

## [1.2.6] - 2026-03-23

### Fixed

- **Knowledge store fails to initialize in packaged Electron builds** — Knowledge-enabled skills errored with "Knowledge store failed to initialize" because the `sql-wasm.wasm` binary was never copied to the Electron dist bundle. In packaged builds, `node_modules` is excluded and sql.js couldn't find its WASM file. Now copied during both production and dev builds.

### Changed

- **Dev mode uses Depot icon instead of default Electron icon** — macOS dev builds now replace the generic Electron icon with the Depot app icon for easier identification in the Dock.

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
