# Host Upload Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the WebUI upload route with disk-backed temp handling and a larger safe size budget while preserving conversation/workspace containment rules.

**Architecture:** Keep the existing `/api/upload` contract, but switch multer to disk-backed temp files and finalize uploads by moving the temp file into the validated workspace or temp destination. Align the renderer-side size limit with the new server budget.

**Tech Stack:** Express, multer, Node fs/promises, TypeScript, Vitest

---

### Task 1: Add failing upload-route coverage

**Files:**

- Create: `tests/unit/process/webserver/apiUploadRoutes.test.ts`
- Modify: `tests/unit/apiRoutesUploadWorkspace.test.ts`

- [ ] Add a failing route test that posts a multipart upload through `registerApiRoutes`.
- [ ] Assert the upload writes to the expected destination while preserving workspace validation.
- [ ] Add a failure-path test for mismatched workspace requests.
- [ ] Run the focused tests and confirm at least one fails before implementation.

### Task 2: Switch upload route to disk-backed temp handling

**Files:**

- Modify: `src/process/webserver/routes/apiRoutes.ts`

- [ ] Replace `multer.memoryStorage()` with disk-backed temp storage.
- [ ] Finalize uploads by moving the temp file into the validated target directory.
- [ ] Keep duplicate-name timestamp handling and path containment checks.
- [ ] Re-run the focused upload-route tests and confirm they pass.

### Task 3: Align renderer-side size budget

**Files:**

- Modify: `src/renderer/services/FileService.ts`

- [ ] Raise the renderer-side upload limit to match the server.
- [ ] Keep `FILE_TOO_LARGE` behavior unchanged for the caller-facing contract.
- [ ] Re-run focused upload-related tests if needed.

### Task 4: Verification and issue close-out

**Files:**

- Modify: issue/PR metadata only after code is verified

- [ ] Run focused upload-route tests.
- [ ] Run `bunx tsc --noEmit --pretty false`.
- [ ] Document in the PR/issue that the upload gap was the remaining actionable part of `#184` after current channel-surface audit.
