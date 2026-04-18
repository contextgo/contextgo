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

## 为什么一定要拆开看

如果这三个状态被合并成一个模糊的“已连接”，用户几乎一定会遇到这些误判：

- 我明明装了，为什么还不能跑
- 我明明登录了，为什么任务还是失败
- 看起来系统已经可用，但换个项目又不行了

这三个状态回答的是完全不同的问题。

## Installed

表示运行时已经在这台机器上存在。

但这通常只代表：

- 程序装上了

并不代表：

- 账号已登录
- 环境依赖完整
- 能正常工作

## Signed In

表示这个 runtime 或 provider 的身份已经配置好了。

但这仍然不一定代表：

- 当前项目和当前环境真的可用

## Ready

Ready 才表示它已经能在当前环境里真正开始执行。

对用户来说，这是最重要的状态。

Ready 的含义更接近：

- 运行时存在
- 凭证或配置存在
- 当前主机环境可用
- 当前工作区能真正发起任务

## 更稳的检查顺序

每次排查都建议按这个顺序来：

1. 先看是否 Installed
2. 再看是否 Signed In / Configured
3. 最后只把 Ready 当成真正可执行状态

## 为什么要分开

如果不分开，用户会经常遇到这种误解：

- 我明明装了，为什么还不能跑
- 我明明登录了，为什么任务还是失败

ContextGo 应该把这三种状态明确显示，而不是合并成一个“已连接”。

## 常见卡点

- CLI 已安装，但当前主机缺少依赖环境
- 已经登录过，但当前工作区没有正确使用凭证
- 看起来已配置，但实际执行动作仍然失败

## 下一步

- 想理解运行时总入口：看 [Runtime Center](./runtime-center)
- 想按真实工作方式进入：看 [Coding And Builder Workflow](../use-cases/coding-and-builder-workflow)
- 想从排障角度进入：看 [Troubleshooting](../manage/troubleshooting)
