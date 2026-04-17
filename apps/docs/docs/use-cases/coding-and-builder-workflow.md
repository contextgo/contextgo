---
title: Coding And Builder Workflow
slug: /use-cases/coding-and-builder-workflow
description: Combine code runtimes, project context, browser work, files, and automation into a long-running builder workflow.
---

# Coding And Builder Workflow

ContextGo 不是另一个 code agent 包装层。它的价值在于把代码工作、项目上下文、浏览器、文件结果、自动化和多端远程一起组织起来。

## This Mode Is For You If...

- 你用 Codex、Claude Code、Gemini、OpenClaw 等 runtime 做代码工作
- 你不满足于“只跑一个命令行 Agent”
- 你希望让代码工作和项目资料、网页、自动化连接起来

## Why ContextGo Fits This Scenario

代码型 Agent 往往已经很强，但问题通常在它们之外：

- 项目上下文不连续
- 浏览器研究和代码工作割裂
- 结果只留在终端里
- 手机上很难继续看和控制

ContextGo 把这些外围问题接起来，所以更适合长期构建工作。

## Starter Kit

- Recommended Workbench: `Conversation Cowork Workbench`
- Recommended Connectors: `Project Files`, `Browser Context`, `Project Docs`
- Recommended Runtime: `Codex / Claude Code / Gemini / OpenClaw compatible runtime`
- Recommended Agent Package: `Engineering / Builder package`
- Recommended Skills: `coding`, `git`, `test`, `browser`, `docs`
- Recommended Automation: `hooks`, `commands`, `scheduled checks`
- Recommended Publish Path: `not required`

## First-Day Workflow

1. 在真实项目里打开 ContextGo，不要从空目录开始。
2. 确认至少一个 runtime 真正 ready。
3. 把项目说明、关键文档和相关网页一起纳入上下文。
4. 让 Agent 先做小任务，例如定位问题或整理修改计划。
5. 在工作区里查看产物和结果，而不是只盯对话流。

## When To Level Up

用顺以后再加：

- hooks 驱动的检查流
- 定时任务
- 共享 project context
- 多 Agent 协作

## Related Docs

- [Runtime Center](../agents/runtime-center)
- [Agent System Overview](../agents/agent-system-overview)
- [Collaboration Overview](../collaboration/collaboration-overview)
