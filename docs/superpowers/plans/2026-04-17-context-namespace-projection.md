# Context Namespace And Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `#129` and `#142` by making current Context Engine outputs part of an explicit namespace/projection model and by separating semantic context, source mirrors, and capability inventory in the vault/graph projection path.

**Architecture:** Keep the current runtime and vault layout, but add explicit namespace/projection-layer semantics around existing generated artifacts and then update graph/canvas generation to prefer semantic context by default. The implementation should not add a new UI or shadow store; it should clarify the meaning of the existing files and nodes and then reshape default projection behavior around that meaning.

**Tech Stack:** TypeScript, Vitest, vault projection services, Obsidian canvas JSON generation

---

### Task 1: Add explicit namespace/projection-layer metadata to current projection outputs

**Files:**

- Modify: `src/process/services/space/vaultLayout.ts`
- Modify: `src/process/services/space/SpaceVaultContextSyncService.ts`
- Modify: `tests/unit/process/services/spaceVaultContextSyncService.test.ts`

- [ ] **Step 1: Write the failing namespace/projection tests**

Add tests that assert generated artifacts expose projection-layer semantics:

```ts
it('writes semantic context docs with explicit projection-layer metadata', async () => {
  const baselineContent = await fs.readFile(
    path.join(vaultPath, 'Projects', projectDir, '_context', 'baseline.md'),
    'utf8'
  );

  expect(baselineContent).toContain('contextgoProjectionLayer: semantic-context');
});

it('writes capability docs as capability inventory rather than semantic context', async () => {
  const capabilityDocContent = await fs.readFile(
    path.join(vaultPath, 'Projects', 'workspace', '_context', 'capabilities', 'skills', 'Release-Guard.md'),
    'utf8'
  );

  expect(capabilityDocContent).toContain('contextgoProjectionLayer: capability-inventory');
});
```

- [ ] **Step 2: Run the focused projection tests to confirm the layer metadata is missing**

Run:

```bash
bun run test -- tests/unit/process/services/spaceVaultContextSyncService.test.ts
```

Expected: FAIL because the generated docs do not yet expose explicit projection-layer metadata.

- [ ] **Step 3: Implement the minimum explicit projection-layer metadata**

Required changes:

```ts
- introduce a small projection-layer vocabulary in vaultLayout or a nearby helper
- stamp generated semantic context docs (`baseline`, `insights`, session docs, space memory, connector digest) as `semantic-context`
- stamp source mirror docs as `source-mirror`
- stamp capability docs and capability index outputs as `capability-inventory`
```

- [ ] **Step 4: Re-run the focused namespace/projection tests**

Run:

```bash
bun run test -- tests/unit/process/services/spaceVaultContextSyncService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/process/services/space/vaultLayout.ts \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts
git commit -m "refactor(context): add projection layer metadata"
```

### Task 2: Define the namespace vocabulary on top of existing artifacts (`#129`)

**Files:**

- Modify: `src/process/services/space/SpaceVaultContextSyncService.ts`
- Modify: `src/process/services/space/ProjectContextMirrorService.ts`
- Modify: `packages/context-engine/docs/domain-model.md`
- Test: `tests/unit/process/services/spaceVaultContextSyncService.test.ts`

- [ ] **Step 1: Write the failing namespace-vocabulary tests**

Add tests that assert generated documents and anchors reflect one namespace language:

```ts
it('classifies current generated artifacts into namespace families', async () => {
  expect(projectContent).toContain('contextgoNamespaceKind: project');
  expect(sessionContent).toContain('contextgoNamespaceKind: session');
  expect(capabilitiesContent).toContain('contextgoNamespaceKind: capability-inventory');
});
```

- [ ] **Step 2: Run the focused tests to confirm namespace metadata is missing**

Run:

```bash
bun run test -- tests/unit/process/services/spaceVaultContextSyncService.test.ts
```

Expected: FAIL because the namespace vocabulary has not yet been written into current artifacts.

- [ ] **Step 3: Implement the minimum namespace layer**

Required changes:

```ts
- add a small namespace-kind vocabulary that maps directly to current outputs (`space`, `project`, `session`, `semantic-context`, `source-mirror`, `capability-inventory`)
- stamp generated files with the namespace-kind metadata
- keep file layout unchanged
- do not introduce a new tree/graph UI in this task
```

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
bun run test -- tests/unit/process/services/spaceVaultContextSyncService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  src/process/services/space/ProjectContextMirrorService.ts \
  packages/context-engine/docs/domain-model.md \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts
git commit -m "refactor(context): define namespace vocabulary"
```

### Task 3: Make graph/canvas generation semantic-first (`#142`)

**Files:**

- Modify: `src/process/services/space/SpaceVaultContextSyncService.ts`
- Modify: `tests/unit/process/services/spaceVaultContextSyncService.test.ts`
- Modify: `tests/unit/process/services/projectCapabilityService.test.ts`

- [ ] **Step 1: Write the failing graph/canvas tests**

Add tests that assert the default projection no longer flattens all node classes equally:

```ts
it('keeps semantic context nodes as the primary graph layer', async () => {
  const graphCanvas = JSON.parse(
    await fs.readFile(path.join(vaultPath, 'Projects', projectDir, 'Project Graph.canvas'), 'utf8')
  );

  expect(graphCanvas.nodes.some((node: { label?: string }) => node.label === 'workspace Baseline')).toBe(true);
  expect(graphCanvas.nodes.some((node: { label?: string }) => node.label === 'workspace Insights')).toBe(true);
});

it('keeps capability inventory out of the default semantic graph node set', async () => {
  expect(graphCanvas.nodes.some((node: { file?: string }) => node.file?.includes('_context/capabilities'))).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests to confirm graph output is still too flat**

Run:

```bash
bun run test -- tests/unit/process/services/spaceVaultContextSyncService.test.ts tests/unit/process/services/projectCapabilityService.test.ts
```

Expected: FAIL because capability/source nodes are still treated as equal graph participants.

- [ ] **Step 3: Implement semantic-first graph/canvas output**

Required changes:

```ts
- keep semantic context nodes in the default project graph/canvas
- keep source mirrors available for provenance, but not as equal-weight default semantic nodes
- keep capability inventory generated and linked, but not injected into the default semantic graph node set
- preserve browseability and linkability
```

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
bun run test -- tests/unit/process/services/spaceVaultContextSyncService.test.ts tests/unit/process/services/projectCapabilityService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts \
  tests/unit/process/services/projectCapabilityService.test.ts
git commit -m "refactor(context): make namespace projection semantic-first"
```

### Task 4: Full verification, issue closure, and PR packaging

**Files:**

- Modify: `docs/superpowers/plans/2026-04-17-context-namespace-projection.md`
- Test: `tests/unit/process/services/spaceVaultContextSyncService.test.ts`
- Test: `tests/unit/process/services/projectCapabilityService.test.ts`

- [ ] **Step 1: Run final focused verification**

Run:

```bash
bunx tsc --noEmit
bun run test -- tests/unit/process/services/spaceVaultContextSyncService.test.ts tests/unit/process/services/projectCapabilityService.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 3: Update issue state and PR packaging**

Issue actions:

```md
- close `#129`
- close `#142`
- leave closing comments explaining that namespace vocabulary and projection layering are now aligned with current runtime semantics
```

PR actions:

```md
- summarize namespace vocabulary plus semantic/source/capability projection layering
- explicitly state that runtime assembly/governance ownership remains unchanged
- include final verification evidence
```

- [ ] **Step 4: Commit any plan-tracking change if needed**

```bash
git add docs/superpowers/plans/2026-04-17-context-namespace-projection.md
git commit -m "docs(context): complete namespace projection execution"
```
