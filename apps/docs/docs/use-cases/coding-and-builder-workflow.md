---
title: Coding And Builder Workflow
slug: /use-cases/coding-and-builder-workflow
description: Combine code runtimes, project context, browser work, files, and automation into a long-running builder workflow.
---

# Coding And Builder Workflow

ContextGo 不是另一个 code agent 包装层。  
它的价值在于把代码工作、项目上下文、浏览器研究、文件结果、自动化和远程继续任务组织进一个长期系统。

## 适合谁

如果你符合下面两条以上，就很适合从这个入口开始：

- 你经常使用 Codex、Claude Code、Gemini、OpenClaw 一类 runtime 做代码工作
- 你不满足于“只开一个命令行窗口跑 Agent”
- 你需要把项目说明、网页研究、文档和代码变更放到同一条链路里
- 你希望离开电脑时还能继续查看状态和推进任务

## 这个场景下，ContextGo 的价值是什么

代码型 Agent 往往已经很强，但很多问题出在它们之外：

- 项目上下文不连续
- 浏览器研究和代码工作割裂
- 结果只留在终端里
- 自动化与人工继续之间没有统一入口
- 远程继续工作时缺少稳定主机

ContextGo 的价值，是把这些外围能力组织起来，而不是只增加一个“再来一个 Agent”。

## 建议准备什么

第一阶段建议只准备这些：

- 一个最常用、最稳定的代码型 runtime
- 一个真实项目目录
- 一组关键项目文档
- 一组当前正在研究的网页或资料

如果这些材料没有进入系统，后面的结果质量很容易失真。

## 第一条工作流怎么跑

推荐顺序：

1. 在真实项目里打开 ContextGo，不要从空目录开始
2. 确认至少一个 runtime 真正 ready
3. 把项目说明、规范、关键网页一起纳入上下文
4. 先要求一个小任务，例如定位问题、列出改动计划、整理待办
5. 在工作区里查看结果，而不是只盯住对话本身

## 更适合它做的事

这个模式最适合：

- 代码问题定位
- 方案比较和修改计划整理
- 项目文档、网页和代码之间的联动工作
- 需要跨多次会话延续的构建工作

## 第一阶段不建议做什么

- 一开始就接很多 runtime
- 一开始就做很复杂的 hooks 和 schedules
- 一开始就把它当作纯自动编程流水线
- 没有项目材料时只用一句抽象要求让它开始

## 用顺以后再升级什么

当本地闭环已经稳定后，再考虑补这些层：

- hooks 驱动的检查流
- commands 和定时任务
- 更完整的上下文治理
- 多 Agent 协作
- 远程继续开发任务

## 下一步

- 想确认 runtime 状态：看 [Runtime Center](../agents/runtime-center)
- 想理解系统能力构成：看 [Agent System Overview](../agents/agent-system-overview)
- 想补远程继续能力：看 [Personal Remote Workbench](./personal-remote-workbench)
