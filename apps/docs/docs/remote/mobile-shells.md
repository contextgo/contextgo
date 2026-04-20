---
title: Mobile Shells
slug: /remote/mobile-shells
description: iPhone, Android, and HarmonyOS shells reuse the remote model instead of replacing the desktop host.
---

# Mobile Shells

手机端在 ContextGo 里的角色，不是“另一套完整产品”，而是远程使用面。

## 核心定义

iPhone、Android、HarmonyOS 都应复用同一套远程产品模型：

- 桌面主机继续负责执行
- 手机端负责接入、查看、继续和上传
- 包装方式可以不同，但产品定义应保持一致

![ContextGo 手机端远程控制入口](/brand/remote/mobile-remote-control.png)

手机端最适合做远程查看和继续，而不是替代主机成为长期执行宿主。

## 更具体一点

手机端更像是：

- 随时接入当前主机任务的入口
- 在外面查看进度和结果的界面
- 发起一个小动作、继续一条任务、补一份材料的控制面

而不是：

- 替代桌面主机的独立工作机
- 自己长期托管 runtime 和 connector 的宿主

## 哪些事更适合在手机上做

- 看当前任务走到哪
- 接收结果和继续下一步
- 上传一份文件到主机
- 发起一个明确的小请求

## 哪些事仍然更适合主机

- 大量文件整理
- 重 runtime 任务
- 复杂多窗口工作
- 依赖本地环境的开发或自动化流程

## 文件流应该怎样理解

在当前产品模型里，手机本地文件的合理路径是：

1. 用户在手机上选择本地文件
2. 文件通过当前上传链路送到主机
3. 主机保存并继续处理这份文件
4. 后续预览、Agent 工作和结果都围绕主机侧文件继续

也就是说，**文件可以从手机发起，但处理权仍然在主机。**

## 平台差异主要体现在哪里

iPhone、Android、HarmonyOS 的壳层可以不同，但差异应该主要体现在：

- 打包方式
- 权限和签名要求
- 平台接入与账号体系
- 上架或分发渠道

而不应该体现在“产品逻辑变成三套不同定义”。

## 当前发布口径

如果从对外分发角度理解：

- iOS 更适合走 TestFlight
- Android 可以先走签名 APK 直装
- HarmonyOS 可以先走签名包私下分发或后续 AppGallery 路径

但无论分发方式如何，产品模型都应保持一致。

## 下一步

- 想理解整体远程模型：看 [Remote & Devices](./index)
- 想理解主机权威：看 [Desktop Host](./desktop-host)
- 想理解实际远程场景：看 [Personal Remote Workbench](../use-cases/personal-remote-workbench)
