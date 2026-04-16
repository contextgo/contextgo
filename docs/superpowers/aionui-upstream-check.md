# AionUi Upstream Check

## Purpose

Track the delta between `contextgo` and upstream `AionUi` after the fork point so future periodic checks can append new findings in one place.

## Fork Baseline

- Checked on: `2026-04-16`
- Current `contextgo` branch: `main`
- Current `AionUi` branch: `main`
- Last shared commit:
  - `a6b4976a870dd76ccf9aaeb012029ced8dc30da1`
  - `2026-03-26 10:29:56 +0800`
  - `Merge pull request #1722 from iOfficeAI/test/acp-custom-workspace-skill-fallback`

## Comparison Notes

This file should record only **AionUi-only additions that are still not aligned into current `contextgo`**.

Do not list:

- features that `contextgo` already has under a different name
- `contextgo`-only product directions such as `Space`, official remote, publication, cloud handoff, or context engine work
- pure refactors without user-visible effect unless they unblock a planned adoption

## Initial Gap Snapshot

As of this check, the most visible upstream-only product features are:

1. Team mode / multi-agent workspace orchestration
   - `AionUi` added a dedicated `team` product slice with team route, member tabs, horizontal multi-panel layout, drag sorting, leader/teammate lifecycle, and team-specific coordination UX.
   - Current `contextgo` has discussion groups, but not the same dedicated Team mode product line.

2. Native runtime coverage beyond current `contextgo`
   - `AionUi` added `aionrs` / Aion CLI integration.
   - `AionUi` also added Hermes and Snow CLI ACP backend support.
   - Current `contextgo` has ACP/Codex/Gemini/OpenClaw-oriented runtime work, but not these upstream runtime additions.

3. Workspace change-tracking UI
   - `AionUi` has a workspace `files / changes` tab model with tracked file-change views.
   - Current `contextgo` workspace does not expose the same `FileChangeList` / `WorkspaceTabBar` style panel.
   - Tracking issue: `#185`

4. Workspace-side chat affordances still not matched
   - `AionUi` added `@workspace` file mention flow.
   - `AionUi` added upload progress feedback and send-disable behavior during upload.
   - Current `contextgo` does not expose these same conversation-workspace affordances.
   - Tracking issue: `#183`

5. AionUi-specific assistant pack growth
   - `AionUi` added and expanded OfficeCLI-oriented assistants such as Financial Model Creator, Pitch Deck Creator, dashboard/office generation presets, and 3D Morph PPT variants.
   - `contextgo` has its own package and skill-market direction, but not this same upstream assistant catalog.

6. Desktop pet / lightweight agent-presence UX
   - `AionUi` added desktop pet behavior and related animation states.
   - No equivalent product slice is currently present in `contextgo`.

7. Additional channel + WebUI conveniences
   - `AionUi` has a full WeCom channel implementation.
   - `AionUi` also upgraded WebUI upload handling toward larger disk-backed uploads.
   - Current `contextgo` has WeCom connector metadata and existing WebUI upload routes, but not the same end-to-end feature alignment.
   - Tracking issue: `#184`

## Already Aligned Or Not Counted As Gap

The following upstream items were checked and should **not** be treated as missing just because naming differs:

- top titlebar conversation tabs
- preview panel with multi-tab file viewing
- preview history / snapshot flow
- Mermaid support
- titlebar back/forward navigation
- Weixin QR login flow
- PWA/mobile-shell related support
- Skill market / skills hub direction
- OpenClaw compatibility runtime

## Log

### 2026-04-16

- Added formal design doc:
  - `docs/superpowers/workbench/2026-04-16-ai-native-workbench-host-design.md`
- Opened root architecture Epic:
  - `#188` `Evolve ContextGo from ChatLayout to AI Native Workbench Host`
- Created the upstream delta tracking file.
- Confirmed the fork baseline at shared commit `a6b4976a870dd76ccf9aaeb012029ced8dc30da1`.
- Recorded the first gap snapshot for future periodic updates.
- Opened `#183` for workspace file mentions + upload state parity.
- Opened `#184` for WeCom channel + WebUI upload pipeline parity.
- Opened `#185` for workspace `files / changes` panel parity.
- Opened `#186` for browser context / URL preview discoverability in normal conversations.
