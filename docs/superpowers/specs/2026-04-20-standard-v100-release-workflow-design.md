# Standard v1.0.0 Release Workflow Design

## Context

The repository already publishes desktop release assets through `.github/workflows/build-and-release.yml`.

Current gaps:

- tag-driven public release does not include Android or HarmonyOS builds
- iOS uses a separate TestFlight workflow and is not part of the public GitHub Release asset model
- the existing `v1.0.0` public release was created from a manual dispatch path rather than the intended standard tag path

The user selected the conservative release model for `v1.0.0`.

## Decision

Treat the standard public release path as:

- `vX.Y.Z` tag is the canonical public release trigger
- tag-driven release must build and publish desktop artifacts
- tag-driven release must also build and attach Android artifacts
- tag-driven release must also build and attach HarmonyOS artifacts
- iOS remains outside the standard public release path and stays manual-only

Manual `workflow_dispatch` remains available for maintainers, but it is not the canonical public release entrypoint.

## Workflow Semantics

### Tag-driven release

For `push.tags: v*`:

- run the existing desktop build pipeline
- run Android shell build automatically
- run HarmonyOS shell build automatically
- do not run iOS shell build automatically
- create the public GitHub Release from the collected artifacts

### Manual release

For `workflow_dispatch` on `main`:

- keep the current desktop release behavior
- keep Android, iOS, and HarmonyOS manual boolean inputs
- preserve the existing ability to build iOS artifacts manually when needed

This keeps the standard path simple while preserving a maintainer escape hatch.

## Release Artifact Policy

The public GitHub Release for stable tags should contain:

- desktop release assets from the existing desktop matrix
- Android signed APK and optionally AAB
- HarmonyOS signed HAP or APP

It should not treat public IPA distribution as the standard release contract.

## Validation Policy

The workflow changes should preserve the existing release validation rules:

- tag must match `package.json` version
- tag must point to a commit reachable from `origin/main`
- manual public release remains restricted to `main`

No versioning rule changes are part of this design.

## v1.0.0 Recovery Plan

After the workflow changes are merged:

1. delete the existing public `v1.0.0` release from the public distribution repository
2. delete the existing `v1.0.0` tag from the source repository
3. push the workflow update to `main`
4. recreate `v1.0.0` from the intended release commit
5. let the standard tag workflow produce the clean release

## Risks And Constraints

- Android and HarmonyOS tag builds now become mandatory for a standard stable release, so missing signing material or unavailable runners will block release completion
- iOS remains a separate operational lane by design; this release does not attempt to redefine that product model
- this change should stay minimal and avoid redesigning the entire release workflow tree
