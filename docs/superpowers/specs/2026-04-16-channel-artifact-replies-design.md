# Channel Artifact Replies Design

## Goal

Allow IM-published agents to return a generated local artifact as a channel reply through a shared gateway path, instead of only replying with a filesystem path.

## Product Boundary

This is not a Weixin-only business rule.

- project-owned publication and reply intent live in `.contextgo/channels/`
- gateway logic decides whether an artifact may be elevated into a channel reply
- each channel plugin remains responsible only for transport-specific upload/send behavior

## v1 Scope

- extend `IAgentProfile` with `channelReplyPolicy`
- default IM publication profiles to `capabilities: ['text', 'file']` with `fallbackMode: 'text_path'`
- detect a local file artifact candidate from final file-written agent messages
- elevate that candidate into `IUnifiedOutgoingMessage { type: 'file' }` in the shared channel gateway
- validate Weixin as the first transport implementation

## Non-Goals

- multi-attachment replies
- channel-specific business prompts
- changing all agent runtimes to emit a brand-new artifact event protocol in this patch
- Telegram/Lark/Slack file delivery support in this patch

## Follow-Up

A later phase should replace file-written text parsing with a first-class structured artifact event from agent runtimes, while keeping the same gateway/publication boundary.
