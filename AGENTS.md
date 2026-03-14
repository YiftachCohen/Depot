# Repository Guidelines

## Project Structure & Module Organization
- `apps/` holds end-user apps: `electron/` (desktop UI), `cli/`, and `viewer/`.
- `packages/` contains shared libraries: `core/`, `shared/` (agents/config/sessions), `server-core/`, `server/`, `ui/`, and session tool/server packages.
- `examples/` stores skill packs (`depot.yaml` files) used by the app.
- `docs/` contains documentation assets; `scripts/` holds build/release tooling.

## Build, Test, and Development Commands
- `bun install`: install dependencies for the Bun monorepo.
- `bun run electron:dev`: run the desktop app with hot reload.
- `bun run electron:build`: build Electron main/preload/renderer bundles.
- `bun run server:dev`: start the headless server with debug flags.
- `bun test`: run Bun tests (plus isolated test files).
- `bun run typecheck:all`: run TypeScript checks across core packages/apps.
- `bun run lint`: run IPC send checks and ESLint for Electron/shared/ui.
- `bun run validate:dev`: full local validation (typecheck + shared tests + doc tools).

## Coding Style & Naming Conventions
- TypeScript-first codebase; avoid `any` and use narrow `unknown` types.
- Follow conventions in the file you edit; keep modules focused and under ~500 lines.
- Naming: use clear, intent-revealing names; exported APIs should be typed.
- Formatting/linting: ESLint is used in `apps/electron`, `packages/shared`, and `packages/ui`.

## Testing Guidelines
- Frameworks: `bun test` for TS/JS tests; Python `unittest` for doc tool smoke tests.
- Conventions: follow existing test folder patterns (e.g., `tests/` or `__tests__/`).
- Targeted runs: `bun run test:shared:all` for shared config/LLM coverage, `bun run test:doc-tools` for document tool smoke tests.

## Commit & Pull Request Guidelines
- Commit messages are imperative and descriptive; include a short summary line (see `CONTRIBUTING.md`).
- Branch naming: `feature/*`, `fix/*`, `refactor/*`, `docs/*`.
- PRs: describe what changed and why, ensure checks pass, and add screenshots for UI changes.

## Security & Configuration Tips
- Review `SECURITY.md` before reporting vulnerabilities.
- Skills live in `examples/` and use `depot.yaml` manifests; keep names in lowercase kebab-case.
