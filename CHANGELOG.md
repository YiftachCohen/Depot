# Changelog

All notable changes to Depot are documented in this file.

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
