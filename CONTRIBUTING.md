# Contributing To ContextGo

Thanks for taking the time to improve ContextGo.

## Development Setup

ContextGo uses Bun for the main desktop and renderer workspace.

```bash
bun install
bun run start
```

Useful commands:

```bash
bun run lint:fix
bun run format
bunx tsc --noEmit
bun run test
```

Cloud service tests:

```bash
bun run cloud:test
```

Documentation checks:

```bash
bun run docs:broken-links
```

## Pull Request Checklist

Before opening a pull request:

- keep process boundaries intact: main process code under `src/process/`, renderer code under `src/renderer/`, shared code under `src/common/`
- use Arco components for interactive renderer UI
- keep user-facing renderer text behind i18n keys
- update tests for changed behavior
- run `bun run format`, `bunx tsc --noEmit`, and `bun run test`
- do not commit credentials, generated local caches, packaged app output, or runtime state

## Commit Messages

Use this format:

```text
<type>(<scope>): <subject>
```

Common types:

```text
feat, fix, refactor, chore, docs, test, style, perf
```

Do not add AI-generated signatures or co-author trailers unless they identify a real human collaborator.

## Product Terminology

Keep these terms distinct:

- `Context Connector`: context access into external sources such as browser activity, Feishu context, Google Workspace, GitHub, documents, and files
- `IM Bot Channel`: publication and transport surfaces such as Telegram, Slack, Discord, Lark, DingTalk, and WeChat
- `Space`: a first-class ContextGo product object, not a wrapper around a third-party editor

When in doubt, prefer the product model described in `AGENTS.md` and `docs/tech/`.

## Security

Report vulnerabilities privately through GitHub Security Advisories. See `SECURITY.md`.
