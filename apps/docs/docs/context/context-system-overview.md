---
title: Context System Overview
slug: /context/context-system-overview
description: ContextGo is not just conversation history. It uses a full context system built around connectors, memory, and context assembly.
---

# Context System Overview

ContextGo 不是把历史消息简单拼起来。

## 这页解决什么问题

很多产品都会把“上下文”说成一件模糊的事，但真正落地时常常只是：

- 把聊天记录接长一点
- 多塞几份文件
- 临时把网页摘要贴进去

ContextGo 这层不是这样工作的。

## 它的长期价值，在于一个完整的上下文系统：

- 外部资料和工作流通过 Context Connector 进入
- Context Engine 负责形成、提炼和组装上下文
- Session、Project、Space 形成长期工作边界
- Memory、Profile、Context Pack 为后续任务持续提供高质量输入

这里还有一个很重要但容易被忽略的点：

- 这套系统最终要服务上下文治理，而不是无限堆积上下文

## 一个更稳的四层理解方式

你可以先把系统看成四层：

### 1. 来源层

网页、文件、文档、外部系统记录先进入系统，形成可引用的来源。

### 2. 沉淀层

系统不会把所有来源都原样塞回任务，而是逐步沉淀出更高价值的长期信息。

这包括：

- 可以检索的结构化内容
- 更稳定的 Memory
- 更高层的 Profile

### 3. 边界层

Session、Project、Space 不是同一个东西。

它们用来区分：

- 当前任务视图
- 某个工作单元
- 更长期的上下文容器

### 4. 组装层

真正送给 Agent 的是一次任务相关的 Context Pack。

它应该是经过筛选、提炼和组装后的结果，而不是原始历史的简单拼接。

### 5. 治理层

上下文系统不是只在“塞给 Agent 之前”工作一次。

它还应该持续判断：

- 哪些信号值得晋升
- 哪些材料已经过时
- 哪些约束正在污染后续任务
- 哪些经验应该跨 session 或跨 project 继续保留

## 为什么这层最重要

如果没有这层，Agent 每次都像从零开始。

有了这层之后：

- 当前任务会更连贯
- 长期主题可以积累
- 工作可以跨会话延续
- 远程和发布也更有意义
- 项目上下文不会因为长期堆积而越来越脏

## 常见误解

- “上下文就是聊天历史”
- “只要把资料都传进去，质量自然会变好”
- “记忆就是原始消息存档”

这些都过于粗糙。

## 对用户真正有帮助的理解

普通用户最需要把握的是：

- 真实来源如何进入系统
- 长期信息如何被沉淀
- 当前任务最终拿到的到底是什么

当你理解这三件事时，就更容易判断为什么某次输出有根据，或者为什么某次输出还不够稳。

## 下一步

- 想理解资料入口：看 [Context Connector](./context-connector)
- 想理解长期边界：看 [Session, Project, Space](./session-project-space)
- 想理解长期沉淀：看 [Memory, Profile, Context Pack](./memory-profile-context-pack)
- 想从实际起步场景进入：看 [Bring Your Workflow Into ContextGo](../use-cases/bring-your-workflow-into-contextgo)
