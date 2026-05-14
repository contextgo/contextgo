# Agent-Browser Decision Log

Updated: 2026-03-30
PR: #90

## Current Implementation State

The current branch already ships a usable first pass of the `agent-browser` direction:

- `agent-browser` is treated as the first-party browser runtime in the data model and design docs.
- browser context assets are stored as Space-scoped context assets.
- each conversation can bind one browser context asset through `conversation.extra.browserContextAssetId`.
- the conversation header now has a browser entry button that can create or reuse the bound browser context.
- the right preview pane opens URLs in an isolated persistent `webview` partition derived from the bound browser context asset ID.
- the first UI path creates a `managed` browser context asset and records explicit consent metadata at creation time.

This is enough to validate the product direction in desktop right-pane browsing, but it intentionally does not yet finalize the full compliance and cross-space reuse model.

## Decisions Needed

### 1. What counts as compliant authorization in v1

Current implementation:

- creating a browser context from the conversation header is treated as the first explicit consent action
- the asset is created with `consentStatus: granted`
- `grantedAt` is recorded

What is still open:

- whether this is sufficient for `managed` mode launch
- whether profile takeover or fingerprint import must require a stronger authorization flow before any GA release
- whether authorization must capture domain scope, purpose, retention window, and revocation reason in structured fields

Recommended default:

- allow the current explicit in-product consent flow for `managed` mode only
- require a stronger plugin-mediated consent flow for `takeover-link` and imported profile/fingerprint flows
- add an auditable revoke/re-authorize surface before exposing non-managed modes

Why this matters:

- this defines whether the current implementation can be considered shippable for a limited v1 desktop beta
- it also determines how much compliance metadata must become mandatory in the asset schema next

### 2. How Space-level browser assets should be reused

Current implementation:

- one browser context asset can be bound per conversation
- the conversation-level entry point creates a new `managed` asset when no binding exists
- there is no Space asset picker yet

What is still open:

- whether a user should be able to select an existing browser asset from the same Space instead of auto-creating one
- whether multiple conversations in the same Space should commonly reuse one shared browser asset
- whether shared reuse should be opt-in or the default

Recommended default:

- keep the current "one bound asset per conversation" flow as the default fast path
- add an explicit "reuse an existing Space browser context" picker in the next iteration
- do not silently auto-share browser assets across conversations

Why this matters:

- silent sharing increases surprise and expands the blast radius of cookies, sessions, and browser state
- explicit reuse still preserves the Space concept without weakening user expectations of isolation

### 3. Which browser-context modes should be exposed in phase 1

Current implementation:

- schema supports `managed`, `takeover-link`, and `imported-profile`
- UI only creates `managed`
- right-pane browsing and asset binding are already usable for `managed`

What is still open:

- whether to expose `takeover-link` immediately after the browser plugin path exists
- whether `imported-profile` should be part of the same release train or wait for a stricter authorization and storage review

Recommended default:

- phase 1 public UI: `managed` only
- phase 1.5 after plugin handshake lands: add `takeover-link`
- keep `imported-profile` behind a later milestone until retention, encryption, migration, and revoke semantics are reviewed

Why this matters:

- `managed` validates the Space + right-pane + agent-browser runtime model with the smallest compliance surface
- `takeover-link` is strategically important, but it materially changes the trust and authorization model
- `imported-profile` is the most sensitive mode and should not ride in under the same product bar as `managed`

## Suggested Product Call

If the goal is to move fast without losing the model:

1. Treat the current branch as the desktop beta foundation for `managed` mode.
2. Keep browser context assets as Space-owned resources and conversation-bound runtime selections.
3. Make plugin-based `takeover-link` the next gated milestone.
4. Defer imported profile/fingerprint custody until the authorization and secure storage story is explicit enough to document.

## Immediate Next Step After Approval

Once the above decisions are confirmed, the next implementation slice should be:

- a Space-scoped browser context picker and manager UI
- explicit revoke / re-authorize actions
- plugin handshake contract for `takeover-link`
- structured authorization metadata instead of relying mainly on freeform metadata
