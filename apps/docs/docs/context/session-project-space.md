---
title: Session, Project, Space
slug: /context/session-project-space
description: Understand the three context layers that separate immediate work, project truth, and long-running shared context.
---

# Session, Project, Space

ContextGo 里最容易混淆、但也最重要的概念之一，就是这三层上下文边界：

- Session
- Project
- Space

## Session

Session 是一次具体执行视图。

它更接近：

- 当前任务
- 当前对话
- 当前工作流的一次推进

## Project

Project 是当前工作事实更稳定的层。

它更接近：

- 这个任务所属项目
- 可见、可编辑、可版本化的项目上下文
- 当前项目的长期工作材料

## Space

Space 是更长期、更高层的逻辑容器。

它适合承接：

- 长期上下文归属
- 多个 project 的共享背景
- 长期文档、资料、artifact 和 context 治理

## 为什么要分三层

因为：

- 不是所有东西都该留在一次 session 里
- 也不是所有东西都该直接晋升为 project truth
- 更不是所有信息都应该立刻进入 space 级长期上下文

这三层的存在，是为了让 ContextGo 不会退化成“所有东西都堆在一个对话里”。

## Related Docs

- [Context Engine](./context-engine)
- [Context Governance](./context-governance)
