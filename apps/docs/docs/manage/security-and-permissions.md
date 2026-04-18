---
title: Security And Permissions
slug: /manage/security-and-permissions
description: ContextGo uses a local-first trust model, so permissions, remote access, and runtime authority need to stay explicit.
---

# Security And Permissions

ContextGo 是 local-first 工作系统，所以权限边界非常重要。

## 最重要的三条边界

- 主机权限
- remote access 权限
- runtime 执行权限

## 为什么这件事不能省略

因为用户真正关心的是：

- 我的文件谁能动
- 手机和网页到底能做到什么
- 哪些动作仍然需要主机授权
- 对外发布时权限边界有没有扩大

## 1. 主机权限

桌面主机是当前产品里的执行权威。

这意味着：

- 主机能访问什么，系统才能访问什么
- 主机上的本地文件、工具和执行环境需要被认真看待
- 客户端能力默认不应绕过主机权限模型

如果用户没有理解这条边界，就很容易误判远程访问的实际能力。

## 2. Remote Access 权限

远程访问的核心不是“页面打开了”，而是：

- 谁能接入这台主机
- 接入后能看到什么
- 接入后能执行哪些动作

更稳的原则是：

- 远程入口以继续、查看、上传和小步推进为主
- 不默认把所有主机权限直接放给客户端

## 3. Runtime 执行权限

Runtime 负责执行，但执行仍然依赖主机环境。

这意味着需要区分：

- runtime 是否已安装
- 是否已登录或配置
- 是否真的 ready
- 当前动作是否超出了它在这台主机上的权限边界

## 对用户意味着什么

如果你在公开环境里使用 ContextGo，最需要明确的是：

- 任务在哪台主机执行
- 哪些文件会进入系统
- 哪些客户端能继续任务
- 哪些外部入口已经连接到发布链路

## 更稳的使用建议

- 不要把不需要的高权限入口长期打开
- 不要在主机权限边界不清楚时直接扩展远程或发布能力
- 不要把“能操作”误解成“应该默认允许”

## 下一步

- 想理解主机权威：看 [Desktop Host](../remote/desktop-host)
- 想理解设备边界：看 [Account And Devices](./account-and-devices)
- 想理解发布后的外部边界：看 [Publish](../publish)
