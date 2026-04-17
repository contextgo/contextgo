# Host Upload Hardening Design

## Goal

Close the remaining actionable part of issue `#184` by hardening the WebUI upload pipeline for larger remote/browser/mobile uploads without regressing conversation-bound workspace safety.

## Scope

This PR focuses on the upload half of `#184`:

- replace the current memory-backed multer flow with disk-backed temporary upload handling
- support larger file uploads safely
- preserve conversation-bound workspace validation and upload path containment
- keep the renderer-side upload size contract in sync with the server

## Audit Result

The issue text also mentions missing WeCom parity. After auditing the current repository state, that part is stale:

- the repo already contains a shipped `weixin` channel plugin
- login flow, settings form, publication/system actions, and plugin tests are already present
- no separate missing WeCom implementation gap remains that should be recreated in this PR

So this batch intentionally closes the remaining upload-hardening gap instead of inventing a parallel channel implementation.

## Non-Goals

- no new channel type or duplicated WeCom surface
- no renderer redesign of channel settings
- no changes to conversation/workbench UX handled in PR2

## Implementation Shape

- switch `/api/upload` from `multer.memoryStorage()` to disk-backed temp files
- move the temp file into the final workspace/temp upload destination after validation
- raise the upload size limit to a safer large-file threshold on both server and renderer
- add tests proving the route accepts larger uploads and rejects workspace mismatch exactly as before

## Acceptance Criteria

- `/api/upload` no longer depends on in-memory file buffers
- larger files are accepted without retaining the full payload in route memory
- conversation-bound uploads still resolve to the stored conversation workspace only
- invalid workspace mismatches still reject with the same protection semantics
