---
title: Agents & Capabilities
slug: /agents
description: Understand how agents, runtimes, packages, skills, and automation fit together.
---

# Agents & Capabilities

这一部分解释系统如何获得能力，以及这些能力如何被组织进产品。

## 这页解决什么问题

很多用户会把下面这些概念混在一起：

- Agent
- Assistant
- Runtime
- Agent Package
- Skills
- Hooks / Commands / Schedules

如果这些概念没有分清楚，后面就会很难判断：

- 当前能力到底来自哪里
- 哪些是执行后端，哪些是产品层能力
- 出问题时应该去 Runtime Center，还是去包、技能或自动化层排查

## 一个更稳的理解方式

你可以先把它们分成三层：

### 1. 运行时层

Runtime 负责执行。

它回答的问题是：

- 用哪个后端跑任务
- 当前是否 installed / signed in / ready
- 这台主机到底能不能实际执行

### 2. 产品能力层

Agent Package、skills、hooks、commands、schedules 负责补充能力。

它们回答的问题是：

- 系统拥有哪些规则和能力
- 这些能力如何进入当前工作区
- 哪些能力是自动化的，哪些是交互式的

### 3. 用户使用层

Assistant / Agent 是用户在产品里感知到的工作入口。

它们更接近“你如何使用能力”，而不是“能力如何在底层被打包”。

## 为什么不要把 runtime 当成产品本体

一个常见误解是：选定某个 runtime，就等于选定了整个产品模型。

这不准确。

在 ContextGo 里：

- runtime 可以替换
- Agent Package 可以变化
- 技能和自动化可以继续叠加
- 远程访问和发布模型仍然属于产品整体，而不是 runtime 单独拥有

## 第一阶段最重要的两页

如果你正在起步，优先看：

- [Runtime Center](./runtime-center)
- [Installed, Signed In, Ready](./installed-signed-in-ready)

这是最容易让系统“看起来配好了，但实际上还没跑起来”的地方。

## 对大多数用户的建议

第一阶段不要追求把所有能力都启用。

更稳的顺序是：

1. 先让一个 runtime 真正 ready
2. 再确认当前工作区需要哪些能力
3. 再逐步补 skills、commands、hooks 或 schedules

## 下一步

- 想先确认执行状态：看 [Runtime Center](./runtime-center)
- 想理解状态区别：看 [Installed, Signed In, Ready](./installed-signed-in-ready)
- 想从代码场景进入：看 [Coding And Builder Workflow](../use-cases/coding-and-builder-workflow)
