# ContextGo Integration

The package installs both official Remotion skills and ContextGo workflow skills. Skills are projected into runtime-native directories as an install surface; the package remains the source of truth.

## Commands

The `remotion-video-studio` automation profile provides commands for:

- project initialization
- Studio preview
- still checks
- local render
- SSR render
- Player app embedding
- captions
- AI media asset intake
- Lambda planning
- QC
- final packaging

## Schedules

Schedules are installed disabled by default:

- weekly video draft from newest source context
- render QC audit
- asset/template freshness check

Enable schedules only after the workspace has stable source locations and review ownership.
