# T3 Code

T3 Code is a minimal web GUI for coding agents (currently Codex and Claude, more coming soon).

## Repository overview

This repository is a Bun + Turborepo monorepo for T3 Code. The main pieces are:

- `apps/server`: the Node.js WebSocket server that wraps `Codex app-server`, manages provider sessions, and serves the web UI
- `apps/web`: the React + Vite client for sessions, conversations, and provider events
- `apps/desktop`: the Electron desktop shell around the shared app experience
- `apps/marketing`: the marketing site
- `packages/contracts`: shared schemas and TypeScript contracts for WebSocket protocol, orchestration events, and models
- `packages/shared`: shared runtime utilities used by the server and web apps

The codebase is currently TypeScript-first and centers on a server-driven architecture where the browser talks to the server over WebSockets, and the server coordinates provider runtimes such as Codex.

For a deeper walkthrough, see:

- [Workspace layout](./.docs/workspace-layout.md)
- [Architecture](./.docs/architecture.md)

## Installation

> [!WARNING]
> T3 Code currently supports Codex and Claude.
> Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://github.com/openai/codex) and run `codex login`
> - Claude: install Claude Code and run `claude auth login`

### Run without installing

```bash
npx t3
```

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/pingdotgg/t3code/releases), or from your favorite package registry:

#### Windows (`winget`)

```bash
winget install T3Tools.T3Code
```

#### macOS (Homebrew)

```bash
brew install --cask t3-code
```

#### Arch Linux (AUR)

```bash
yay -S t3code-bin
```

## Some notes

We are very very early in this project. Expect bugs.

We are not accepting contributions yet.

Observability guide: [docs/observability.md](./docs/observability.md)

## If you REALLY want to contribute still.... read this first

Before local development, prepare the environment and install dependencies:

```bash
# Optional: only needed if you use mise for dev tool management.
mise install
bun install .
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
