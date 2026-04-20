---
title: Channel Accounts And Instances
slug: /publish/channel-accounts-and-instances
description: A channel account is the real ingress boundary that receives messages and exposes agent publications.
---

# Channel Accounts And Instances

当你把 Agent 发布到渠道时，真正重要的不是一个“平台名”，而是一个真实入口。

这就是 Channel Account / Instance 的作用。

## 它回答什么问题

- 哪个渠道入口正在接消息
- 哪个实例属于哪个平台
- 这个实例当前是否健康
- 它现在为哪个 published agent 提供入口

![ContextGo 多实例渠道账号详情](/brand/product/multi-channel-account.png)

一个平台下面通常不是一个抽象“已接入”状态，而是多个真实实例和各自生命周期。

## 为什么用户需要理解它

因为一旦进入发布场景，你面对的就不再只是“我选了 Telegram”。

你真正面对的是：

- 哪个账号
- 哪个实例
- 哪个 audience
- 当前绑定到哪个能力

## Related Docs

- [Channels](./channels)
- [Audiences, Threads, Groups](./audiences-threads-groups)
