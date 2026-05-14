---
title: Operations And Automation Workflow
slug: /use-cases/operations-and-automation-workflow
description: Turn repeated work into a context-aware automation workflow that can keep running and be managed remotely.
---

# Operations And Automation Workflow

ContextGo 适合把“每天都要做、但又不值得你每天亲自重复做”的事情，变成有上下文、有状态、可远程管理的自动化流程。

## This Mode Is For You If...

- 你有大量重复性工作
- 这些任务依赖上下文和历史结果
- 你希望任务不仅能执行，还能持续管理

## Why ContextGo Fits This Scenario

传统自动化工具擅长固定脚本，但不擅长变化中的上下文。纯聊天工具又能理解需求，却很难持续运行。

ContextGo 适合中间这层：

- 有上下文
- 能持续跑
- 能远程看
- 能逐步变成工作系统

## Starter Kit

- Recommended Workbench: `Conversation Cowork Workbench`
- Recommended Connectors: `Project Docs`, `External Sources`, `Channel Targets`
- Recommended Runtime: `Stable general runtime`
- Recommended Agent Package: `Operations / Automation package`
- Recommended Skills: `schedules`, `commands`, `summary`, `notifications`
- Recommended Automation: `schedules + hooks + commands`
- Recommended Publish Path: `optional`

## First-Day Workflow

1. 先挑一个每周至少会重复 2 到 3 次的任务。
2. 先把它做成“可重复描述”的任务，不要一上来全自动。
3. 先让 Agent 跑一次，确认上下文够不够。
4. 再把它变成 schedule 或 command。
5. 观察几次结果后，再决定是否加 hooks。

## When To Level Up

先不要一开始就：

- 同时加很多 schedule
- 让高风险任务直接无人值守

用顺后再加：

- 失败后的恢复逻辑
- 状态通知
- 发布到渠道
- 手机端远程观察和干预

## Related Docs

- [Skill Market](../agents/skill-market)
- [Publish Overview](../publish/publish-overview)
- [Remote Access Overview](../remote/remote-access-overview)
