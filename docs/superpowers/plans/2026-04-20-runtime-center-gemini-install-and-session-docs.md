# Runtime Center Gemini Install And Session Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Gemini to managed runtime installation, then document runtime detection, configuration, and external session takeover in both the docs site and repository docs.

**Architecture:** Extend the existing managed-runtime bridge and settings UI rather than introducing a Gemini-specific path. Keep runtime-boundary documentation aligned with the current product model: runtime-native global state remains external, while ContextGo adds detection, takeover, context governance, connectors, and publishing on top.

**Tech Stack:** TypeScript, React, Vitest, Mintlify docs, Markdown

---

### Task 1: Add Gemini to managed runtime installation

**Files:**

- Modify: `src/common/types/acpTypes.ts`
- Modify: `src/process/bridge/acpConversationBridge.ts`
- Modify: `src/renderer/pages/settings/AgentSettings/CustomAcpAgent.tsx`
- Test: `tests/unit/acpConversationBridge.test.ts`
- Test: `tests/unit/renderer/RuntimeSettings.configDock.dom.test.tsx`

- [ ] **Step 1: Write the failing bridge and UI assertions**

Add assertions that Gemini is installable:

```ts
expect(result).toEqual({
  success: true,
  data: {
    backend: 'gemini',
    command: 'npm install -g @google/gemini-cli',
    stdout: '',
    stderr: '',
  },
});
```

```ts
const geminiCard = await screen.findByTestId('runtime-card-gemini');
expect(within(geminiCard).getByRole('button', { name: 'Install locally' })).toBeInTheDocument();
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `bun run vitest tests/unit/acpConversationBridge.test.ts tests/unit/renderer/RuntimeSettings.configDock.dom.test.tsx`

Expected: failures mentioning Gemini managed install support or missing install button.

- [ ] **Step 3: Implement the minimal managed-install changes**

Update the managed-install backend list and install command:

```ts
export const MANAGED_RUNTIME_INSTALLABLE_BACKENDS = ['gemini', 'claude', 'codex', 'opencode'] as const;
```

```ts
const MANAGED_RUNTIME_INSTALL_COMMANDS = {
  gemini: 'npm install -g @google/gemini-cli',
  claude: 'npm install -g @anthropic-ai/claude-code',
  codex: 'npm install -g @openai/codex',
  opencode: 'npm install -g @opencode-ai/cli',
};
```

Point the Gemini guide URL at the official Gemini CLI docs page rather than the repo root.

- [ ] **Step 4: Re-run the targeted tests**

Run: `bun run vitest tests/unit/acpConversationBridge.test.ts tests/unit/renderer/RuntimeSettings.configDock.dom.test.tsx`

Expected: PASS

### Task 2: Expand docs site runtime guidance

**Files:**

- Modify: `apps/docs/navigation.js`
- Modify: `apps/docs/scripts/sync-lib.mjs`
- Modify: `apps/docs/docs/agents/runtime-center.md`
- Modify: `apps/docs/i18n/en/docs/agents/runtime-center.md`
- Add: `apps/docs/docs/agents/external-session-takeover.md`
- Add: `apps/docs/i18n/en/docs/agents/external-session-takeover.md`

- [ ] **Step 1: Write the missing-doc wiring changes**

Add the new docs page to the Agents navigation and localized page-title map so the docs build exposes it.

- [ ] **Step 2: Document the runtime matrix and official links**

Update `runtime-center.md` to cover:

```md
- install / login / config / ready are separate states
- ContextGo runtime detection order
- product-managed install support matrix
- official docs links for Gemini, Claude Code, Codex, and OpenCode
- ContextGo-only capabilities layered above the runtimes
```

- [ ] **Step 3: Add the external-session takeover page**

Document:

```md
- which runtimes can be discovered
- that discovery reads runtime-native global state
- how ContextGo imports or resumes those sessions
- how Context Engine, connectors, and IM publishing differ from vendor-native CLIs
```

- [ ] **Step 4: Verify docs references render cleanly**

Run: `bun run vitest tests/unit/web/seoMetadata.test.ts`

Expected: PASS

### Task 3: Add repository-facing runtime integration documentation

**Files:**

- Add: `docs/conventions/runtime-integration-and-session-takeover.md`
- Modify: `docs/conventions/runtime-support.md`

- [ ] **Step 1: Write the repository doc**

Add a concise engineering document describing:

```md
- runtime detection flow
- managed install boundary
- external session discovery/import boundary
- product-owned layers: Context Engine, Context Connector, IM publication, package projections
```

- [ ] **Step 2: Link the new repository doc from the runtime support document**

Add a short cross-reference near the top of `runtime-support.md`.

- [ ] **Step 3: Run repo-level verification**

Run:

```bash
bunx tsc --noEmit
bun run test
```

Expected: both commands pass.
