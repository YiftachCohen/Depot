# Contributing to Depot

Thank you for your interest in contributing to Depot. This guide covers development setup, coding standards, and how to submit changes.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Bun](https://bun.sh/) runtime
- macOS, Linux, or Windows

### Getting Started

1. Clone the repository and install dependencies:

   ```bash
   git clone <repo-url>
   cd depot
   bun install
   ```

2. Start the app in development mode (hot reload):

   ```bash
   bun run electron:dev
   ```

3. Verify everything works:

   ```bash
   bun test
   bun run typecheck:all
   ```

## Project Structure

```
depot/
  apps/
    electron/            # Desktop GUI (Electron + React + Vite)
      src/main/          # Electron main process
      src/preload/       # Context bridge
      src/renderer/      # React UI
    cli/                 # Terminal client
    viewer/              # Session viewer web app
  packages/
    core/                # Shared type definitions (@depot/core)
    shared/              # Business logic (@depot/shared)
      src/agent/         # Agent backends (Claude, Pi)
      src/config/        # Storage, preferences
      src/sessions/      # Session persistence
    server-core/         # Server RPC handlers and transport
    server/              # Headless server entry point
    ui/                  # Shared React components (@depot/ui)
    session-tools-core/  # Session tool definitions
    session-mcp-server/  # MCP server for session access
    pi-agent-server/     # Pi SDK agent backend
  examples/              # Skill packs (PM, DevOps, Code Review)
```

## PR Guidelines

### Branch Naming

Use descriptive prefixes:

- `feature/add-bedrock-provider` -- new functionality
- `fix/skill-loading-order` -- bug fixes
- `refactor/session-manager` -- code improvements
- `docs/update-contributing` -- documentation

### Commit Messages

Write clear, imperative commit messages:

```
Add AWS Bedrock connection handler

Implement IAM-based authentication for Bedrock provider,
including credential resolution and region configuration.
```

### Pull Request Process

1. Create a branch from `main`.
2. Make your changes.
3. Ensure all checks pass (see Testing below).
4. Push and open a pull request.
5. In the PR description, explain **what** the change does and **why**.
6. Include screenshots for any UI changes.

## Testing

All tests must pass before a PR can be merged:

```bash
# Run the full test suite
bun test

# Type-check all packages
bun run typecheck:all

# Lint
bun run lint
```

If you are changing agent logic or config:

```bash
bun run test:shared:all
```

For Electron-specific type checks:

```bash
bun run typecheck:electron
```

## Code Style

- **TypeScript strict**: The codebase uses TypeScript throughout. Do not use `any` -- prefer `unknown` and narrow with type guards.
- **Follow existing patterns**: Match the conventions of the file you are editing. If the surrounding code uses a particular structure, follow it.
- **Keep files under 500 lines**: If a file grows past this, split it into focused modules.
- **Typed interfaces for public APIs**: All exported functions and components should have explicit type annotations.
- **Meaningful names**: Variable and function names should describe intent, not implementation.
- **Comments for complex logic**: Straightforward code should be self-documenting. Add comments when the *why* is not obvious.

## Skill Pack Contribution Guide

Skill packs live in the `examples/` directory. Each pack is a directory containing one or more `depot.yaml` files.

### Adding a New Skill Pack

1. Create a directory under `examples/` with a descriptive name:

   ```
   examples/my-pack/
   ```

2. Add one or more `depot.yaml` files. Each file defines a single skill:

   ```yaml
   name: My Skill Name
   icon: wrench
   description: >
     One or two sentences explaining what this skill does.

   sources:
     - github

   quick_commands:
     - label: Run the thing
       command: >
         Do the thing with {{input_var}}.
       variables:
         input_var:
           prompt: "What should we process?"
           placeholder: "example-value"
   ```

3. Follow these conventions:
   - Use lowercase-kebab-case for directory and file names.
   - Keep descriptions concise (one to two sentences).
   - Use `{{variable}}` syntax for template variables and always provide a `prompt` and `placeholder`.
   - List only the sources the skill actually uses.
   - Test the skill by placing it in a workspace's `skills/` directory and running it.

4. Open a PR with the new pack. In the description, explain the use case and target audience.

## Questions

- Open an issue for bugs or feature requests.
- Start a discussion for questions or ideas.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
