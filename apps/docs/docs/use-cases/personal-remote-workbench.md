---
title: Personal Remote Workbench
slug: /use-cases/personal-remote-workbench
description: Keep the desktop host working while using the web client and phone as long-running remote surfaces.
---

# Personal Remote Workbench

ContextGo 不是让你把手机变成另一台主机，而是让桌面主机继续工作，而你可以在网页和手机端随时接入、查看、控制和继续任务。

## 适合谁

这个入口适合：

- 不想长时间守在电脑前的人
- 希望主机继续跑任务，自己只在需要时介入的人
- 需要在浏览器和手机上维持任务连续性的人

## 它和普通远程控制的差别

很多远程控制产品只是把桌面画面搬到另一块屏幕上。

ContextGo 更强调的是：

- 桌面主机继续作为执行权威
- 网页和手机变成产品级远程入口
- 文件、上下文和任务状态留在同一个系统里
- 手机负责继续、查看、上传，而不是替代执行主机

## 先准备什么

开始之前，请先确认：

- 桌面主机稳定可用
- 至少一个 runtime ready
- 当前任务已经在主机侧跑起来
- 网页端可以接入同一台主机

如果主机本身还不稳定，不建议直接从远程模式开始。

## 第一条远程工作流怎么跑

推荐顺序：

1. 先在桌面主机把真实任务启动起来
2. 在浏览器里打开同一台主机，确认可以继续查看
3. 再在手机上接入，优先体验查看状态、继续一小步、上传文件
4. 先用它做轻量控制，不要一开始就做复杂重任务

## 更适合远程面做什么

- 看任务进度
- 接收结果并继续下一步
- 上传一份本地文件到主机
- 做一次小的确认、补充或跟进

## 仍然更适合在主机上做什么

- 大量文件整理
- 重 runtime 任务
- 复杂多窗口工作
- 依赖本机环境的开发和自动化流程

## 常见误解

不要把这个模式理解成：

- 手机端是完整替代宿主
- 网页端自己长期托管运行时
- 远程访问等于把权限完全放到客户端

更准确的理解是：**执行仍在主机，客户端只是持续可用的远程使用面。**

## 下一步

- 想理解主机权威：看 [Desktop Host](../remote/desktop-host)
- 想理解手机壳层定位：看 [Mobile Shells](../remote/mobile-shells)
- 想看设备和账号边界：看 [Account And Devices](../manage/account-and-devices)
