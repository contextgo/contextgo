# Karpathy Coding Guard Design

This document records the first-pass absorption design for the built-in `Karpathy Coding Guard` agent package.

The goal is not to copy the upstream repository as a single-file `CLAUDE.md` plugin. The goal is to absorb its strongest coding-constraint ideas into a first-party ContextGo engineering assistant that ships out of the box with stronger assumption control, tighter change boundaries, and clearer success criteria.

## Upstream Reference Read And Verified

### 1. `forrestchang/andrej-karpathy-skills`

- Local repository: `/Users/bytedance/contextgo/agent-repo/andrej-karpathy-skills`
- Commit: `c9a44ae835fa2f5765a697216692705761a53f40`
- License: MIT

The concrete files read for this absorption pass:

- `README.md`
- `skills/karpathy-guidelines/SKILL.md`
- `.claude-plugin/plugin.json`

## Why This Should Be A Separate Built-In Agent Package

ContextGo already has:

- `Superpowers Harness`
  - a full engineering discipline package centered on spec, planning, TDD, review, and verification
- `Everything Claude Code Harness`
  - a broader absorbed engineering harness with a large skill catalog

But there is still no built-in assistant focused specifically on coding-behavior constraints:

- stopping silent assumptions before implementation
- suppressing unnecessary abstraction
- constraining unrelated edits
- requiring explicit success criteria before code is written

In one sentence:

- `Superpowers` governs full engineering workflow discipline
- `Everything Claude Code` packages a broad absorbed harness
- `Karpathy Coding Guard` governs coding judgment and minimal verifiable change boundaries

## Distillation Boundary

This package should absorb **coding-behavior methodology**, not the upstream plugin packaging model.

### Keep

- `Think Before Coding`
- `Simplicity First`
- `Surgical Changes`
- `Goal-Driven Execution`
- explicit resistance to silent assumptions, overengineering, drive-by edits, and weak validation criteria

### Do Not Carry Over Directly

- the upstream `.claude-plugin` structure as a product boundary
- the single monolithic skill as-is
- a fallback to a runtime-owned `CLAUDE.md` plugin model
- unnecessary hooks, schedules, or workflow sprawl in the first version

### ContextGo-Native Absorption

This package should become:

- assistant rules that shape coding judgment
- a small set of packaged skills with clearer invocation boundaries
- a workspace scaffold that keeps assumptions, change boundaries, and verification visible
- a standard `agent-package.json` driven built-in package

## Proposed Package Identity

- `packageId`: `karpathy-coding-guard`
- `assistantPresetId`: `builtin-karpathy-coding-guard`
- `displayName`: `Karpathy Coding Guard`
- recommended domain: `Engineering`

## Proposed Packaged Skills

The upstream single skill should be split into five packaged skills:

1. `assumption-audit`
   Audit ambiguity, hidden assumptions, missing constraints, and clarification needs before coding.

2. `simplicity-first`
   Keep the implementation minimal, avoid speculative abstractions, and cut unnecessary complexity.

3. `surgical-change`
   Limit edits to the requested scope and allow cleanup only when the current change created the orphan.

4. `goal-driven-execution`
   Turn requests into explicit success criteria, then implement and verify against them.

5. `diff-minimization-review`
   Review the final diff for unrelated changes, overbuilt structure, and weakly verified additions.

## Why Version 1 Should Skip Hooks, Commands, And Schedules

This package's value is behavioral, not automation-heavy.

If the first version adds:

- hooks
- commands
- schedules

it starts to look like another engineering harness instead of a new assistant type.

So version 1 should ship only:

- `workspaceScaffold`
- `skills`

That keeps the package complete while preserving its product identity as a coding-constraint assistant.

## Proposed Workspace Scaffold

The workspace scaffold should route repository context into:

- `docs/assumptions/`
  - unresolved and resolved assumptions before coding
- `docs/changes/`
  - the allowed task boundary and explicit non-goals
- `docs/verification/`
  - success criteria, verification commands, and result capture

This matches the package's core operating model:

- clarify assumptions first
- bound the change second
- close with verification third

## Package Surface

Recommended package root:

- `src/process/resources/assistant/engineering/karpathy-coding-guard/`

Recommended contents:

- `agent-package.json`
- `AGENTS.md`
- `docs/`
- `workspace/`
- `skills/`

The installation boundary remains the existing protocol:

- `.contextgo/` is canonical
- only `skills` project into runtime-native skill directories
- the package stays runtime-neutral

## Expected Outcome

Once implemented, users should get a new built-in engineering agent that:

- requires no upstream plugin installation
- appears directly in the built-in assistant catalog
- works with linked workspaces out of the box
- ships its own packaged skills and scaffold
- defaults to fewer assumptions, smaller diffs, and sharper verification discipline during coding tasks
