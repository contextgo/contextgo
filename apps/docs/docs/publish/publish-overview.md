---
title: Publish Overview
slug: /publish/publish-overview
description: Publish turns a working local agent into a service surface for real channels and real audiences.
---

# Publish Overview

Publish 是 ContextGo 从“自己用”走向“对外服务”的关键能力。

## 这页解决什么问题

很多团队一说到发布，就会把它理解成：

- 开一个 bot
- 接一个 webhook
- 把消息发到另一个平台

这只是很小的一部分。

## Publish 的稳定定义

Publish 更接近一套对外服务层。

它的重点不是把聊天搬到另一个地方，而是建立：

- 渠道入口
- audience 路由
- publication binding
- 长期管理

## 从本地工作流到对外服务

一条更稳的顺序通常是：

1. 本地 Agent 或工作流先在主机侧跑顺
2. 再选择一个真实渠道作为入口
3. 再定义它要服务的 audience、group、thread 或 topic
4. 最后才进入长期运营和多入口扩展

如果第一步还没有稳定，后面越往外接，问题只会越多。

## Publish 至少包含哪些层

一个可持续的 Publish 方案，通常至少要想清楚：

- 通过哪个 Channel 对外触达
- 由哪个账号或实例承载
- 面向哪些 audience 或群体
- 输入和输出如何路由
- 权限和运营边界放在哪里

这也是为什么 Publish 不应被压缩成一个“是否发消息成功”的问题。

## 第一阶段最适合发布什么

第一阶段更适合发布的能力通常具备这些特征：

- 本地已经稳定
- 输入边界清楚
- 输出形式清楚
- audience 很明确
- 出问题时容易回滚或人工接管

## 先不要急着发布什么

下面这些情况不适合第一时间外放：

- 本地流程还不稳定
- 强依赖人工临场修正
- 还没有明确 audience
- 一个能力想同时接很多入口，但没有一个场景先跑顺

## 对外文档更该强调什么

公开文档里更应该强调：

- 服务谁
- 从哪里进入
- 结果如何返回
- 谁负责权限与运营

而不是只强调“支持哪些平台协议”。

## 下一步

- 想理解整体发布层：看 [Publish](./index)
- 想理解渠道定义：看 [Channels](./channels)
- 想理解 audience 模型：看 [Audiences, Threads, Groups](./audiences-threads-groups)
- 想看一条真实工作流：看 [Publish-To-Channel Workflow](../use-cases/publish-to-channel-workflow)
