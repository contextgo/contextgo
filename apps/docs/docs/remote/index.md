---
title: Remote & Devices
slug: /remote
description: Desktop host, web client, mobile shells, and Linux host modes all belong to one remote model.
---

# Remote & Devices

ContextGo 的多端模型不是多套独立产品，而是一个长期稳定的远程产品模型：

- 桌面主机负责执行
- 网页和手机负责接入与控制
- Linux 也可以承担 Host Runtime 角色

![ContextGo 远程网页客户端](/brand/docs/remote-web-client.png)

上图展示的是同一台 Host 通过网页继续被使用：界面看起来像网页，但真正执行仍然回到主机侧。

## 一句话理解

桌面端是主机，网页和手机是远程使用面，不是另一套独立运行环境。

## 这页解决什么问题

很多用户在多端问题上最容易混淆三件事：

- 哪台设备是真正执行任务的主机
- 网页和手机到底能做到什么
- 多端接入是不是意味着出现了新的云端运行时

Remote & Devices 这部分，就是用来把这些边界讲清楚。

## 稳定产品模型

当前最稳定的模型是：

1. **Host Runtime 是执行权威**
   主任务、本地文件、本地工具、本地 runtime 和长任务默认都在这里。
2. **网页和手机是远程客户端**
   它们复用主机提供的真实产品界面和能力，而不是自己再托管一套完整产品。
3. **远程访问不等于把运行时搬到客户端**
   客户端负责接入、查看、继续、上传；执行仍然在主机。

## 这个模型解决什么问题

真实工作里，你不一定一直坐在主机前，但任务、文件、runtime 和上下文又都还在主机侧。

ContextGo 的远程模型，解决的是：

- 主机继续工作
- 你在网页或手机上继续查看和推进
- 上传、控制、继续任务都回到同一条主机链路

## 哪些东西仍然在主机侧

这些能力默认仍然属于桌面主机或 Host Runtime：

- 本地文件访问
- 本地 runtime 执行
- 依赖本机环境的 connector
- 长任务和持续运行中的工作会话
- 任何需要主机权限才能完成的动作

## 哪些事更适合客户端

网页和手机更适合：

- 查看当前任务状态
- 继续一个明确的小步骤
- 查看结果和做跟进决策
- 上传一份本地文件到主机

## 不要把它理解成什么

不要把网页端或手机端理解成：

- 完整独立产品
- 独立云端运行时
- 可以脱离主机长期工作的替代宿主

## 平台差异应该体现在哪里

不同平台之间可以有差异，但差异主要应该落在：

- 包装方式
- 签名与分发
- 权限模型
- 平台文件选择和系统接入

而不应该把产品定义拆成三套完全不同的逻辑。

## 下一步

- 看 [Desktop Host](./desktop-host)
- 看 [Web Client](./web-client)
- 看 [Mobile Shells](./mobile-shells)
- 看 [Same Experience Across Devices](./same-experience-across-devices)
