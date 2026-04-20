---
title: 接管外部 Session
slug: /agents/external-session-takeover
description: 说明 ContextGo 如何发现并接管 Gemini、Claude Code、Codex、OpenCode 的原生 session，以及它与官方 CLI 原生能力的边界。
---

# 接管外部 Session

“接管外部 session” 的意思不是把某个 runtime 的全部私有目录复制进项目。

它真正做的是：

- 识别运行时原生位置里的 session 线索
- 把已有会话导入或接续到 ContextGo
- 在不破坏 runtime-native global state 的前提下，把这些对话纳入 ContextGo 的上下文与工作流体系

## ContextGo 会从哪里发现这些 session

当前产品可接管的外部 session 提供方是：

- Claude Code
- Codex
- Gemini
- OpenCode

发现逻辑读取的是 runtime-native global state，而不是项目里的镜像目录。

典型来源包括：

- Claude Code
  - `~/.claude/projects/**/*.jsonl`
- Codex
  - `~/.codex/state_*.sqlite`
- Gemini
  - `~/.gemini/tmp/.../chats/session-*.json`
- OpenCode
  - 原生 `opencode.db`

这意味着：

- ContextGo 不要求你先把这些历史复制到 `.contextgo/`
- ContextGo 不会为了接管会话而创建一套项目级 runtime home
- `.contextgo/` 仍然只保存 ContextGo 自己的工作区元数据

## 接管时大致发生什么

当你在产品里选择接管某个外部 session，系统大致会做这几步：

1. 扫描原生 session 存储，列出仍可识别的会话
2. 过滤掉已经被 ContextGo 管理过的同一会话
3. 读取会话对应工作区，检查是否已有 `.contextgo/`、`AGENTS.md`、项目能力面等线索
4. 在 ContextGo 里创建或恢复对应对话
5. 导入可用的历史消息与会话元数据
6. 把它纳入 ContextGo 的上下文、能力包、连接器与发布体系

## 这和“官方 CLI 自己恢复会话”有什么不同

官方 CLI 的恢复会话，通常只解决一件事：

- 在同一个 runtime 里继续原来的线程

ContextGo 的“接管外部 session”解决的是更大的产品问题：

- 把原生会话带入 ContextGo 的产品工作面
- 在同一条对话上叠加 Context Engine
- 让同一份工作上下文继续连接 Context Connector
- 让同一份 Agent 能被发布到 IM 多端入口
- 继续使用 Agent Package、skills、hooks、commands、schedules

所以它不是单纯的“resume 按钮换了个地方”，而是把外部会话并入 ContextGo 的产品模型。

## 接管时 ContextGo 不会做什么

为了保持边界稳定，ContextGo 不会：

- 把 `~/.codex`、`~/.claude`、`~/.gemini`、`~/.config/opencode` 重定位到项目里
- 把项目目录伪装成某个 runtime 的 home
- 把原生 runtime 配置、缓存、插件、sqlite、auth 全部复制到 `.contextgo/`
- 把第三方 CLI 的工作区布局直接当成产品主模型

## 接管之后，多出来的产品能力是什么

### Context Engine

接管后的对话不再只是“某个 CLI 的局部历史”。

它会进入 ContextGo 的：

- session
- project
- space
- memory
- governance

这意味着后续的上下文整理、归档、提升、治理，都可以进入同一套模型。

### Context Connector

你可以继续把外部资料、网页、协作文档、代码仓库、业务系统数据接到同一条工作流里，而不是停留在某个 CLI 的本地视角。

### IM 多端发布

同一个 Agent 之后可以被发布到 Telegram、Slack、Lark、Discord 等入口，让会话和能力进入多端协同，而不只是留在本地桌面终端里。

### Agent Package 能力层

接管之后，项目仍然遵循 ContextGo 的能力包模型：

- `AGENTS.md`
- Agent Package
- skills
- hooks
- commands
- schedules

runtime-native skill 目录仍然只是 projection，不是能力的 source of truth。

## 什么时候你应该用接管，而不是新开一条会话

更适合接管的场景：

- 你已经在官方 CLI 里跑了不少上下文
- 你不想手工复制对话历史
- 你要把原有线程带入 ContextGo 的上下文系统
- 你之后还要继续接 Connector、自动化或 IM 发布

更适合新开会话的场景：

- 原生会话已经过旧或噪音太多
- 你想切一个完全新的任务边界
- 你只想在 ContextGo 里用新的 Agent Package 和规则重新开始

## 下一步

- 想先理解运行时检测和安装入口：看 [Runtime Center](./runtime-center)
- 想先分清状态差异：看 [Installed, Signed In, Ready](./installed-signed-in-ready)
- 想理解产品上下文层：看 [Context Engine](../context/context-engine)
