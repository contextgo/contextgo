---
title: Audiences, Threads, Groups
slug: /publish/audiences-threads-groups
description: Publishing is not one bot to one chat. ContextGo routes by audience, group, topic, or thread.
---

# Audiences, Threads, Groups

一个渠道里，真正被服务的对象不只是“这个平台”。

## 为什么这页重要

如果只盯着渠道平台本身，你会很快遇到三个问题：

- 同一个平台里其实有多个不同服务对象
- 同一个群组里不同话题可能需要不同能力
- 一个 Agent 面向谁，决定了它的输入、输出和权限边界

所以真正需要建模的不是“上了哪个平台”，而是“到底在服务谁”。

## 先分清四层对象

更重要的是：

- audience
- group
- topic
- thread

你可以先这样理解：

- `Channel` 是外部渠道类型
- `Account / Instance` 是实际承载入口的账号或实例
- `Audience / Group` 是被服务的人群或组织单元
- `Topic / Thread` 是更细的互动上下文

## 为什么这件事重要

因为发布的真实问题不是“接入了哪个平台”，而是：

- 你到底在服务谁
- 一个入口和另一个入口是不是不同 audience
- 群组里的 topic/thread 是否应该绑定不同能力

## 一个更稳的建模顺序

第一阶段不要一口气把所有层都做复杂。

更稳的顺序是：

1. 先定义一个清楚的 audience
2. 再定义这个 audience 主要在哪个 group 或入口里被服务
3. 如果平台存在 topic 或 thread，再决定是否需要更细路由
4. 只有当输入输出确实不同，才拆成多套能力

## 常见路由方式

常见而稳定的路由方式包括：

- 一个 Agent 服务一个明确 audience
- 同一渠道下，不同群组绑定不同发布能力
- 同一群组里，不同 thread/topic 绑定不同任务流
- 一个共享 Agent 根据 thread 上下文决定如何继续

没有必要为了“看起来高级”而一开始就把所有层都拆满。

## 用户应该怎么理解它

简单理解：

- Channel 是渠道
- Account 是入口账号
- Audience / Group / Thread 是被服务的对象层

## 常见误解

- “只要平台接上了，服务对象自然就清楚了”
- “一个群里所有话题都应该共用同一套能力”
- “thread 只是消息形式，不影响产品定义”

这些理解都容易导致后续路由混乱。

## 下一步

- 想理解渠道层：看 [Channels](./channels)
- 想理解账号与实例：看 [Channel Accounts And Instances](./channel-accounts-and-instances)
- 想理解多入口运营：看 [Publish One Agent To Many Places](./publish-one-agent-to-many-places)
- 想理解持续管理：看 [Managing Published Agents](./managing-published-agents)
