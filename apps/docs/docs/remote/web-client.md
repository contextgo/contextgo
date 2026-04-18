---
title: Web Client
slug: /remote/web-client
description: The web client is a remote surface for opening, inspecting, and continuing work on a host runtime.
---

# Web Client

网页端在 ContextGo 里不是另一套独立产品，而是最通用的远程使用面。

## 这页解决什么问题

网页端最容易被误解成两种东西：

- 一个公开 SaaS 后台
- 一个可以脱离主机独立运行的在线工作区

这两种理解都不准确。

## Web Client 的稳定定位

更稳的定位是：

- 它通过浏览器打开主机工作环境
- 它复用同一套远程产品模型
- 它主要承担查看、继续、控制和上传
- 它不取代主机作为执行权威

## 它最适合什么场景

Web Client 特别适合下面这些情况：

- 查看任务状态
- 打开一台已经在线的主机
- 在浏览器里继续一次对话或一个任务
- 查看主机侧结果并做下一步决策
- 临时从另一台设备接入，而不要求本地完整安装桌面端

## 它不应该被当成什么

Web Client 不应该被当成：

- 与桌面端平行的一套云托管产品
- 新的执行宿主
- 绕过主机权限的入口

如果任务依赖本地文件、CLI、长任务或主机权限，它仍然应回到主机侧完成。

## 一个合理的使用顺序

更稳的顺序通常是：

1. 先让桌面主机处于正常可用状态
2. 再从浏览器打开这台主机
3. 在网页里继续查看、总结、推进和上传
4. 需要重执行或复杂环境时，仍然交给主机

## Web 和 Mobile 的区别

Web 与 Mobile 都属于远程客户端，但侧重点不同：

- Web 更适合通用访问和临时接入
- Mobile 更适合在外快速查看和推进一小步
- 两者都不改变主机是执行权威这个事实

## 常见误解

- “既然能在网页里工作，那一定已经不依赖桌面”
- “网页端能上传文件，所以文件就存在网页端”
- “浏览器里能看到结果，说明 runtime 也在浏览器里”

这些都不是当前产品模型。

## 下一步

- 想理解整体远程模型：看 [Remote Access Overview](./remote-access-overview)
- 想理解主机权威：看 [Desktop Host](./desktop-host)
- 想理解跨端一致性：看 [Same Experience Across Devices](./same-experience-across-devices)
- 想理解上传链路：看 [Uploads, Files, And Host Processing](./uploads-files-and-host-processing)
