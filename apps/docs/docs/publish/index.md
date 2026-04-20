---
title: Publish
slug: /publish
description: Publish agents into real channels and route them to real audiences.
---

# Publish

ContextGo 不只支持本地使用，也支持把 Agent 发布到真实渠道，让它服务多个入口和多个 audience。

![ContextGo 发布与渠道回流](/brand/docs/publishing-flow.png)

这条链路的重点不是“把消息发出去”，而是把一个已经跑顺的本地 Agent 接到真实渠道，并把结果回到真实 audience 所在的工作流里。

## Publish 在产品里的位置

Publish 不是一个附属 bot 功能，而是 ContextGo 从“自己用”走向“对外服务”的关键层。

当一条本地工作流已经跑顺后，Publish 才开始有价值。

## 它回答的不是“能不能发消息”

它更关键回答的是：

- 这个 Agent 通过哪个渠道对外提供能力
- 面向哪些 audience、group、thread 或 topic
- 同一个能力如何在多个真实入口复用
- 权限边界和运营边界应该放在哪里

## Publish 不是市场上架页

在 ContextGo 里，Publish 更接近：

- 渠道接入层
- audience 路由层
- 对外服务编排层

而不只是“把一个 bot 开关打开”。

## 更稳的起步顺序

不要一开始就做发布。

更稳的顺序是：

1. 先跑顺一个本地 Agent 或工作流
2. 先明确一个真实入口
3. 先服务一个清晰 audience
4. 再逐步扩到多个渠道和多个入口

## 第一阶段应该发布什么

第一阶段最适合发布的，不是“功能最多”的 Agent，而是：

- 本地已经稳定
- 输入边界清楚
- 输出形式清楚
- 权限边界清楚

越清晰，越适合作为第一条外部服务链路。

## 不适合第一时间发布的情况

- 本地流程还不稳定
- 结果质量高度依赖人工临场修正
- audience 边界不清楚
- 入口很多，但没有一个真正稳定场景

## 对外发布时应该强调什么

公开文档里，Publish 更应该强调：

- 渠道和 audience 的关系
- 对外服务的责任边界
- 从本地闭环到外部服务的演进顺序

而不是先强调“支持多少渠道”。

## 下一步

- 想理解渠道层：看 [Channels](./channels)
- 想理解 audience 模型：看 [Audiences, Threads, Groups](./audiences-threads-groups)
- 想看真实发布场景：看 [Publish-To-Channel Workflow](../use-cases/publish-to-channel-workflow)
