---
title: Team And Collaboration Workflow
slug: /use-cases/team-and-collaboration-workflow
description: Move from single-agent execution toward group workflows and harness-style collaboration.
---

# Team And Collaboration Workflow

ContextGo 不只是在走向“多个 Agent 一起说话”。更重要的方向，是让复杂任务可以被拆解、分工、评审和迭代，逐步形成真正的协作型工作流。

:::warning Preview

这一页描述的方向里，部分能力仍属于 Preview，包括更明确的 Harness 风格 workflow 和未来的 Agent Team 语义。

:::

## This Mode Is For You If...

- 一个任务明显超出单 Agent 单线程处理范围
- 你需要不同角色参与，例如规划、执行和评审
- 你希望任务在共享上下文里持续推进

## Why ContextGo Fits This Scenario

复杂任务的问题通常不是“没有更强的单个 Agent”，而是：

- 任务需要分阶段
- 不同阶段需要不同角色
- 需要反复评审和修订
- 共享上下文必须保持一致

ContextGo 已经在产品结构上具备这条路线的底盘：

- group container
- parent / child sessions
- shared workspace
- 多 runtime 协作方向

## Starter Kit

- Recommended Workbench: `Conversation Cowork Workbench`
- Recommended Connectors: `Shared Docs`, `Artifacts`, `Context Surfaces`
- Recommended Runtime: `Multiple complementary runtimes`
- Recommended Agent Package: `Planner / Writer / Evaluator style packages`
- Recommended Skills: `workflow`, `review`, `handoff`, `artifact analysis`
- Recommended Automation: `loop orchestration`, `scheduled review`
- Recommended Publish Path: `optional`

## First-Day Workflow

1. 选一个确实需要两种角色的任务。
2. 明确一个角色负责规划，一个角色负责执行。
3. 把上下文和产物都放在共享工作区里。
4. 让规划角色先给出目标和验收标准。
5. 让执行角色围绕这个标准推进。
6. 最后再加第三种评审角色。

## When To Level Up

这类模式用顺后，再考虑：

- 更长的 workflow loops
- 更强的评审机制
- 多个 runtime 的角色分工
- 与 publish、automation 和 context 治理结合

## Related Docs

- [Collaboration Overview](../collaboration/collaboration-overview)
- [Publish-To-Channel Workflow](./publish-to-channel-workflow)
- [Context System Overview](../context/context-system-overview)
