---
title: Channels
slug: /publish/channels
description: Channels are the publication and routing layer for exposing agents to external audiences.
---

# Channels

在 ContextGo 里，Channels 不应该被理解成“一个 bot 设置页”。

它更准确的角色是：

- 对外发布层
- audience 路由层
- 渠道运营层

![ContextGo IM 渠道列表](/brand/product/im-channels.png)

公开文档里先把“有哪些真实入口可被接入”讲清楚，比先讲底层协议更重要。

## Channel 解决什么问题

当一个 Agent 已经在本地能稳定工作后，你还需要决定：

- 它从哪里被触达
- 它把结果送到哪里
- 不同入口是否共享同一个能力

这就是 Channels 的工作。

## 不同 Channel 的差异不只在协议

同样叫“一个渠道”，背后常常有不同维度：

- 账号与实例
- audience 范围
- 群组或线程模型
- 消息形态和交互约束

所以 Channel 不是简单的 webhook 配置项。

## 一个更稳的理解方式

你可以把 Channel 看成“外部入口的产品定义”，而不是技术接线本身。

它至少需要回答四件事：

1. 用户从哪里进入
2. 输入内容怎样进入 Agent
3. 结果怎样返回
4. 权限边界如何控制

如果这四件事没有说清楚，就还不算一个定义良好的 Channel。

## 第一阶段应该怎么做

建议非常保守：

1. 先接一个渠道
2. 先绑定一个清晰场景
3. 先服务一个明确 audience
4. 再逐步扩展

## 选第一个 Channel 时怎么判断

优先选满足下面条件的入口：

- audience 很清楚
- 输入比较结构化
- 输出形式容易判断质量
- 权限边界容易控制

不要第一天就选择最复杂、最多变的外部入口。

## 常见误解

- “能发消息出去，就算接好了渠道”
- “把 webhook 或 bot token 配上，就等于渠道定义完成”
- “一个 Channel 只涉及技术协议，不涉及 audience 和运营”

这些理解都不够完整。

## 公开文档里应该怎么写

对外口径更适合强调：

- 场景
- audience
- 输入输出结构
- 权限和运营边界

而不是只列支持哪些协议。

## 下一步

- 想理解整个发布层：看 [Publish](./index)
- 想理解 audience 模型：看 [Audiences, Threads, Groups](./audiences-threads-groups)
- 想看真实工作流：看 [Publish-To-Channel Workflow](../use-cases/publish-to-channel-workflow)
