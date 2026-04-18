# Agent Package Connectors Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class `connectors` payload support to `agent-package.json`, expose it through the bundled package registry, and carry the new install surface into workspace bootstrap metadata.

**Architecture:** Extend the manifest parser with a minimal connector capability payload that declares connector types and installs into `.contextgo/connectors/`. Keep authenticated bindings out of the package model; registry helpers and workspace scaffold metadata only expose package-declared connector requirements and install surfaces.

**Tech Stack:** TypeScript, Vitest 4, bundled JSON manifests

---

### Task 1: Lock the Connector Payload Contract with Tests

**Files:**

- Modify: `tests/unit/common/config/agentPackageManifest.test.ts`
- Modify: `tests/unit/initAgent.skills.test.ts`
- Test: `tests/unit/common/config/agentPackageManifest.test.ts`
- Test: `tests/unit/initAgent.skills.test.ts`

- [ ] **Step 1: Write the failing manifest and registry assertions**

Add tests that assert:

```ts
expect(manifest.payloads.connectors?.connectorTypes).toEqual(['figma']);
expect(manifest.payloads.connectors?.installSurface).toBe('.contextgo/connectors/');
```

and:

```ts
expect(getBundledAgentPackageConnectorTypes('builtin-figma-closed-loop')).toEqual(['figma']);
expect(hasBundledAgentPackageConnectorsPayload('builtin-figma-closed-loop')).toBe(true);
```

- [ ] **Step 2: Write the failing workspace bootstrap surface assertion**

Add a bootstrap-facing assertion that the generated install surface list includes:

```ts
'.contextgo/connectors/';
```

for a package that declares connector requirements.

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
bun run vitest tests/unit/common/config/agentPackageManifest.test.ts tests/unit/initAgent.skills.test.ts
```

Expected: FAIL because `connectors` payload parsing and registry helpers do not exist yet.

### Task 2: Implement Manifest Schema and Registry Helpers

**Files:**

- Modify: `src/common/config/presets/agentPackageManifest.ts`
- Modify: `src/common/config/presets/bundledAgentPackageRegistry.ts`

- [ ] **Step 1: Add the connectors payload type and parser**

Implement a minimal payload contract with:

```ts
type AgentPackageConnectorsPayload = {
  logicalId: 'connectors';
  sources: AgentPackageSourceDescriptor[];
  runtimeProjection: 'none';
  installSurface: '.contextgo/connectors/';
  connectorTypes: string[];
};
```

- [ ] **Step 2: Extend manifest parsing**

Parse `payloads.connectors`, validate `connectorTypes`, and include the payload in `AgentPackageManifest`.

- [ ] **Step 3: Extend bundled registry helpers**

Add helpers for:

```ts
getBundledAgentPackageConnectorTypes();
hasBundledAgentPackageConnectorsPayload();
```

and keep the helper behavior parallel to existing `skills` / `hooks` helpers.

- [ ] **Step 4: Run tests to verify GREEN for schema and registry**

Run:

```bash
bun run vitest tests/unit/common/config/agentPackageManifest.test.ts
```

Expected: PASS

### Task 3: Add Built-In Manifest Usage and Bootstrap Surface Support

**Files:**

- Modify: `src/process/resources/assistant/design/figma-closed-loop/agent-package.json`
- Modify: `src/process/utils/initAgent.ts`
- Modify: `src/process/resources/assistant/README.md`

- [ ] **Step 1: Add a concrete bundled connectors payload**

Update the Figma package manifest with:

```json
"connectors": {
  "logicalId": "connectors",
  "sources": [{ "kind": "package-relative", "root": "docs" }],
  "installSurface": ".contextgo/connectors/",
  "runtimeProjection": "none",
  "connectorTypes": ["figma"]
}
```

- [ ] **Step 2: Include connectors in workspace scaffold install surfaces**

Update bootstrap metadata assembly so package-generated workspace docs can mention `.contextgo/connectors/` when present.

- [ ] **Step 3: Refresh bundled package README wording**

Document that bundled packages may also declare `connectors` requirements and that these install into `.contextgo/connectors/`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
bun run vitest tests/unit/common/config/agentPackageManifest.test.ts tests/unit/initAgent.skills.test.ts
```

Expected: PASS

### Task 4: Verify the Full Slice

**Files:**

- Modify: none
- Test: `tests/unit/common/config/agentPackageManifest.test.ts`
- Test: `tests/unit/initAgent.skills.test.ts`

- [ ] **Step 1: Run the final focused verification**

Run:

```bash
bun run vitest tests/unit/common/config/agentPackageManifest.test.ts tests/unit/initAgent.skills.test.ts
```

Expected: PASS

- [ ] **Step 2: Run static type verification for the touched config code**

Run:

```bash
bunx tsc --noEmit
```

Expected: PASS
