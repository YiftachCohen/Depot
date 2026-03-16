# Depot -- Skill-first agent interface for enterprise teams

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

## What is Depot

Depot is a desktop application for running AI agents organized around **skills** -- reusable task templates that encode how an agent should accomplish a specific type of work. Instead of starting from a blank chat, teams build and share skill packs that capture institutional knowledge, standard operating procedures, and best practices. Depot turns the agent from a general-purpose chatbot into a purpose-built tool for each workflow.

## Why Fork

Depot is a fork of [Craft Agents](https://github.com/lukilabs/craft-agents-oss) by [Craft Docs Ltd.](https://github.com/lukilabs), diverging in several key ways:

- **Skill-first UX**: Skills are the home screen, not chat sessions. The primary interaction model is selecting a skill and running it, rather than opening a blank conversation.
- **AWS Bedrock native support**: First-class integration with AWS Bedrock as an LLM provider, alongside Anthropic, Google AI Studio, and others.
- **`depot.yaml` manifest format**: Skills are defined declaratively in YAML with template variables, icons, descriptions, and quick commands.
- **Enterprise-oriented**: Designed for teams that need repeatable, auditable agent workflows with shared skill libraries across workspaces and organizations.

## Key Features

- **Skill Dashboard**: Browse, search, and launch skills from a central dashboard instead of navigating chat sessions
- **Quick Commands with template variables**: Define parameterized commands in `depot.yaml` that prompt for input before execution (e.g., `{{repo_url}}`, `{{ticket_id}}`)
- **AWS Bedrock provider**: Connect to Claude and other models through AWS Bedrock with IAM authentication
- **Skill-grouped sessions**: Sessions are organized under the skill that spawned them, providing clear lineage and traceability
- **Cross-session search**: Search across all sessions and skills in a workspace
- **Multi-level skill loading**: Skills resolve from three layers -- `~/.depot/skills/` (global), workspace-level, and project-level -- with deeper scopes overriding shallower ones
- **Multi-session inbox**: Desktop app with session management, status workflow, and flagging
- **Sources**: Connect to MCP servers, REST APIs, and local filesystems
- **Permission modes**: Three-level system (Explore, Ask to Edit, Auto)
- **Automations**: Event-driven automation triggered by label changes, schedules, tool use, and more

## Installation

Download the latest release for your platform from the [GitHub Releases](../../releases) page:

| Platform | Download |
|----------|----------|
| macOS | `.dmg` installer |
| Windows | `.exe` installer |
| Linux | `.AppImage` |

Open the downloaded file and follow your platform's standard install process. Once installed, Depot checks for updates automatically and installs them in the background.

## Development Setup

To build Depot from source:

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Bun](https://bun.sh/) runtime

### Clone and Install

```bash
git clone <repo-url>
cd depot
bun install
```

**Development mode** (hot reload):

```bash
bun run electron:dev
```

**Production build and run**:

```bash
bun run electron:build
bun run electron:start
```

**Run tests**:

```bash
bun test
```

**Type checking**:

```bash
bun run typecheck:all
```

## Skill Packs

Skill packs are collections of related `depot.yaml` files organized by domain. Example packs (found in the `examples/` directory) include:

- **PM Pack**: Sprint planning, standup summaries, ticket triage
- **DevOps Pack**: Incident response, deployment checklists, runbook execution
- **Code Review Pack**: PR review workflows, security audit templates, architecture review

Each pack is a directory containing one or more `depot.yaml` files that can be dropped into any workspace's `skills/` folder.

## depot.yaml Format

Skills are defined using a declarative YAML manifest:

```yaml
name: Triage Incoming Ticket
icon: ticket
description: >
  Reads a support ticket, classifies severity, and drafts an initial response.

sources:
  - linear
  - slack

quick_commands:
  - label: Triage ticket
    command: >
      Read ticket {{ticket_id}} from Linear, classify its severity
      (P0-P3), and draft a customer response.
    variables:
      ticket_id:
        prompt: "Enter the Linear ticket ID"
        placeholder: "ENG-1234"

  - label: Summarize open tickets
    command: >
      List all open tickets assigned to me and produce a summary
      grouped by severity.
```

## Architecture

Depot is structured as a Bun monorepo:

```
depot/
  apps/
    electron/          # Desktop GUI (Electron + React + Vite)
    cli/               # Terminal client for scripting and CI/CD
    viewer/            # Session viewer web app
  packages/
    core/              # Shared type definitions
    shared/            # Business logic (agents, auth, config, sessions)
    server-core/       # Server-side RPC handlers and transport
    server/            # Headless server entry point
    ui/                # Shared React components (shadcn/ui + Tailwind)
    session-tools-core/  # Session tool definitions
    session-mcp-server/  # MCP server for session access
    pi-agent-server/     # Pi SDK agent backend
```

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh/) |
| AI | [@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) |
| Desktop | [Electron](https://www.electronjs.org/) + React |
| UI | [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS v4 |
| Build | esbuild (main) + Vite (renderer) |

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Acknowledgments

Depot is a fork of [Craft Agents](https://github.com/lukilabs/craft-agents-oss) by [Craft Docs Ltd.](https://github.com/lukilabs). We're grateful to the Craft Agents team for building and open-sourcing the foundation that Depot builds on. The original project is also licensed under Apache 2.0. "Craft Agents" is a trademark of Craft Docs Ltd.

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and PR guidelines.
