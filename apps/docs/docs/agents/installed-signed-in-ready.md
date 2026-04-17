---
title: Installed, Signed In, Ready
slug: /agents/installed-signed-in-ready
description: A runtime being installed is not the same as being signed in, and neither is the same as being truly ready to work.
---

# Installed, Signed In, Ready

很多用户第一次接 runtime 时，最容易混淆这三个状态：

- Installed
- Signed In
- Ready

## Installed

表示运行时已经在这台机器上存在。

但这通常只代表：

- 程序装上了

并不代表：

- 能正常工作

## Signed In

表示这个 runtime 或 provider 的身份已经配置好了。

但这仍然不一定代表：

- 当前项目和当前环境真的可用

## Ready

Ready 才表示它已经能在当前环境里真正开始执行。

对用户来说，这是最重要的状态。

## 为什么要分开

如果不分开，用户会经常遇到这种误解：

- 我明明装了，为什么还不能跑
- 我明明登录了，为什么任务还是失败

ContextGo 应该把这三种状态明确显示，而不是合并成一个“已连接”。

## Related Docs

- [Runtime Center](./runtime-center)
- [Coding And Builder Workflow](../use-cases/coding-and-builder-workflow)
