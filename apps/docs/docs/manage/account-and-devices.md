---
title: Account And Devices
slug: /manage/account-and-devices
description: Understand sign-in, device binding, host availability, and how your account relates to the devices you use.
---

# Account And Devices

ContextGo 的账号主要负责：

- 登录
- 设备绑定
- 设备发现
- 多端入口的统一身份

它不是用来替代桌面主机执行工作的云端宿主。

## 这页解决什么问题

账号、设备、主机、会话，这几个词非常容易混。

如果这些对象混在一起，用户就会判断失真：

- 登录成功了，为什么任务还跑不了
- 账号是同一个，为什么设备没出现
- 手机已经打开了，为什么主机还必须在线

## 先把四个概念分开

更稳的理解方式是把它们拆成四层：

### 1. Account

账号负责统一身份。

它主要承接：

- 登录
- 远程入口身份
- 设备发现与绑定
- 多端之间的同一用户识别

### 2. Device

设备是可以被发现和打开的具体终端。

例如：

- 一台桌面主机
- 一台作为客户端接入的设备
- 后续可能承担 Host Runtime 的 Linux 机器

### 3. Host

Host 是当前真正执行工作的设备角色。

同一个账号下可以看到多个设备，但不代表每个设备都是当前执行宿主。

### 4. Session / Task

真正的工作状态仍然在会话、任务和主机环境里延续。

账号统一的是身份，不是把执行权抽离出去。

## 对用户意味着什么

如果你在多端之间切换，最需要确认的是：

1. 你是否登录到正确账号
2. 主机设备是否真的在线
3. 你打开的是不是正确那台设备
4. 当前任务是不是仍然在那台主机上继续

## 常见误解

- “只要账号一致，任何设备都能自动接管任务”
- “设备列表里能看到机器，就代表它现在可执行”
- “账号系统本身就是云端执行环境”

这些都不是当前产品模型。

## 更稳的第一阶段做法

- 先固定一台桌面主机
- 先用一个账号跑通远程设备发现
- 先确认从另一端打开后能继续同一条任务
- 再考虑更多设备和更多入口

## 下一步

- 想理解远程链路：看 [Remote Access Overview](../remote/remote-access-overview)
- 想理解主机权威：看 [Desktop Host](../remote/desktop-host)
- 想理解权限边界：看 [Security And Permissions](./security-and-permissions)
- 想按真实起步顺序进入：看 [Quick Start](../start-here/quick-start)
