---
title: Agent System Overview
slug: /agents/agent-system-overview
description: Understand how assistants, runtimes, packages, and capabilities work together in ContextGo.
---

# Agent System Overview

在 ContextGo 里，用户看到的不应该是一堆孤立概念。

更好的理解方式是：

- Agent 是执行角色
- Runtime 是执行后端
- Agent Package 是能力包
- Skills / Hooks / Commands / Schedules 是可装配能力

## Harness Agent 是什么

如果从更狭义的 Agent 语言来描述，ContextGo 想强化的并不是“再造一个模型”，而是 `Harness Agent` 这层能力。

它的意思更接近：

- 模型继续负责推理和工具调用
- runtime 继续负责执行
- harness 负责把工作放进一个更稳定的 project 边界里

这层 harness 往往由几类稳定对象共同组成：

- `project`
- `AGENTS.md`
- `docs/`
- `skills`
- `hooks / commands / schedules`

这些对象的价值，不是为了把规则堆得越来越多，而是为了让 Agent 在更长时间的工作里仍然能保持：

- 目标不漂移
- 约束可被持续披露
- 中间状态可被治理
- 输出不脱离真实项目

## 为什么不要把 Agent 只理解成一个聊天人格

如果只把 Agent 理解成一个“会回复的助手”，很多关键边界就会被忽略：

- 它为什么能在项目里持续工作
- 为什么一次 session 结束后，下一次还能接得上
- 为什么不同 runtime 可以被放进同一套工作系统里

ContextGo 想解决的不是“一个会说话的角色”，而是“一个能在真实工作环境里持续承担责任的执行角色”。

## Related Docs

- [Agent Packages](./agent-packages)
- [Skill Market](./skill-market)
- [Runtime Center](./runtime-center)
