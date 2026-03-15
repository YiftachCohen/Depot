# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Depot

Depot is a skill-first desktop agent interface for enterprise teams, built as an Electron app. Skills are reusable task templates (`depot.yaml`) that encode how an agent should accomplish specific work. Fork of Craft Agents with divergent UX (skill dashboard as home screen), AWS Bedrock support, and `depot.yaml` manifest format.

## Build & Development Commands

Runtime is **Bun** (not npm/node). All commands from repo root:

```bash
bun install                    # Install dependencies
bun run electron:dev           # Dev mode with hot reload
bun run electron:build         # Build main/preload/renderer bundles
bun run electron:start         # Build + launch Electron
bun run server:dev             # Headless server with debug flags
bun test                       # Run all tests (includes isolated test files)
bun run typecheck:all          # TypeScript checks across all packages/apps
bun run lint                   # IPC send checks + ESLint (electron/shared/ui)
bun run validate:dev           # Full validation: typecheck + shared tests + doc tools
```

### Single-package commands

```bash
cd packages/shared && bun test                    # Shared package tests only
cd packages/shared && bun run tsc --noEmit        # Typecheck shared only
cd packages/core && bun run tsc --noEmit          # Typecheck core only
cd apps/electron && bun run typecheck             # Typecheck electron only
bun run test:shared:all                           # Shared config/LLM tests
bun run test:doc-tools                            # Python doc tool smoke tests
```

### Distribution builds

```bash
bun run electron:dist:dev:mac   # Unsigned dev build for macOS
bun run electron:dist:mac       # Signed production build
```

## Monorepo Structure

Bun workspaces monorepo. Packages reference each other via TypeScript path imports (no build step between packages).

### `packages/core` — Type layer (`@depot/core`)
Shared type definitions (workspaces, sessions, messages, agent events). Dependency-light; prefer type-only changes. Public exports from `src/index.ts`.

### `packages/shared` — Business logic (`@depot/shared`)
Core domain logic: agent backends (`src/agent/`), sessions, config, credentials, MCP integration, skills, sources, permissions. `ClaudeAgent` in `src/agent/claude-agent.ts` is the primary agent class. Permission modes: `safe`, `ask`, `allow-all`. Source types: `mcp`, `api`, `local`. Has many subpath exports (e.g., `@depot/shared/agent`, `@depot/shared/auth`).

### `packages/server-core` — Server runtime
RPC handler implementations in `src/handlers/rpc/` (sessions, skills, auth, settings, sources, etc.). Domain services in `src/domain/`, session management in `src/sessions/`, transport layer in `src/transport/`.

### `packages/server` — Server entrypoint
Thin wrapper that boots the server-core runtime.

### `packages/session-tools-core` — Agent tools
Tool definitions and runtime for session-scoped agent tools. Tool defs in `src/tool-defs.ts`, handler implementations in `src/handlers/`.

### `packages/ui` — Shared UI components (`@depot/ui`)
Reusable React components and styles shared across apps.

### `apps/electron` — Desktop app (`@depot/electron`)
Electron app with standard main/preload/renderer split:
- **Main process** (`src/main/`): window management, deep links, notifications, auto-update, browser pane management, network proxy
- **Preload** (`src/preload/`): `bootstrap.ts` and `browser-toolbar.ts` bridge IPC
- **Renderer** (`src/renderer/`): React SPA with Jotai atoms for state, Radix UI primitives, TailwindCSS v4 styling
- **Transport** (`src/transport/`): `channel-map.ts` maps API methods to IPC channels via `buildClientApi()`

### `apps/cli` — CLI app
### `apps/viewer` — Web viewer app

## Architecture Patterns

### IPC / RPC System
`packages/shared/src/protocol/channels.ts` defines `RPC_CHANNELS` — the canonical channel name registry organized by domain (sessions, workspaces, window, settings, etc.). Wire-format strings are the stable API contract. `apps/electron/src/transport/channel-map.ts` maps renderer method names to these channels. A lint script (`bun run lint:ipc-sends`) ensures no raw IPC sends bypass the channel map.

### Skill System
Skills use a `depot.yaml` manifest with metadata, sources, and quick commands with template variables (`{{var_name}}`). Skills resolve from three layers: `~/.depot/skills/` (global), workspace-level, and project-level (deeper overrides shallower). Skill types defined in `packages/shared/src/skills/types.ts`. Manifest parsing in `packages/shared/src/skills/depot-manifest.ts`.

### State Management (Renderer)
Jotai atoms in `apps/electron/src/renderer/atoms/` for sessions, skills, sources, browser pane, panel stack, overlays, and automations.

### Agent System
`BaseAgent` in `packages/shared/src/agent/base-agent.ts` is the abstract base. `ClaudeAgent` (Anthropic), `PiAgent` (Pi AI) are concrete implementations. Agent tools are defined in `packages/session-tools-core/src/tool-defs.ts`.

## Key Conventions

- TypeScript strict mode with `noUncheckedIndexedAccess` enabled
- `bunfig.toml` preloads the network interceptor (`packages/shared/src/unified-network-interceptor.ts`) for all Bun processes
- React 18 with JSX transform (`react-jsx`), not React 19
- TailwindCSS v4 (via `@tailwindcss/vite` plugin)
- UI components use Radix primitives + `class-variance-authority` + `tailwind-merge`
- Path alias `@/*` maps to `src/*` in tsconfig
- ESM throughout (`"type": "module"` in all packages), except Electron main process outputs CJS (`dist/main.cjs`)
