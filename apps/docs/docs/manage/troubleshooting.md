---
title: Troubleshooting
slug: /manage/troubleshooting
description: Start troubleshooting from user-facing symptoms rather than internal implementation details.
---

# Troubleshooting

排障最好按用户能感受到的症状来开始，而不是先按内部系统组件来想。

## 一个更稳的排障顺序

先不要急着问“是不是某个模块坏了”。

更稳的顺序通常是：

1. 先确认你看到的症状是什么
2. 再确认症状发生在哪一层
3. 最后才进入具体配置或实现细节

这样更容易把问题范围缩小。

## 常见入口包括：

- 登录没有完成
- 设备没有出现或离线
- runtime 显示 installed 但不能工作
- 手机端无法继续桌面任务
- 发布到渠道后行为不符合预期

## 1. 登录没有完成

先确认：

- 当前是不是正确账号
- 登录动作是否真正完成
- 远程入口和目标主机是否都在同一身份链路下

如果这里都没对齐，后面的设备发现和远程访问都会失真。

## 2. 设备没有出现或看起来离线

先确认：

- 主机是否真的在线
- 目标设备是否完成绑定
- 当前账号下是否应该能看到这台设备

设备“出现”与“可用”也不是一回事，后者还依赖主机状态。

## 3. Runtime 显示 Installed 但不能工作

优先检查这三个状态有没有被混淆：

- Installed
- Signed In / Configured
- Ready

很多失败并不是安装失败，而是配置、权限或当前工作区并没有真正 ready。

## 4. 手机或网页不能继续桌面任务

先不要把它当成客户端 bug。

优先检查：

- 主机是否仍在持有当前任务环境
- 主机上的任务是否还在继续
- 远程访问是否真的连到了正确主机

远程客户端本身不是新的执行宿主。

## 5. 发布后的行为不符合预期

优先检查：

- 你服务的 audience 是否定义正确
- group、topic、thread 是否走到了预期路由
- 当前入口绑定的是不是正确的 Agent 或能力

很多问题其实不是渠道协议错误，而是发布建模不清楚。

## 排障时最容易犯的错误

- 一开始就钻进内部模块名
- 把“能看到”当成“能执行”
- 把“已安装”当成“已就绪”
- 把“接入了渠道”当成“发布模型已经定义清楚”

## 下一步

- 账号和设备问题：看 [Account And Devices](./account-and-devices)
- runtime 状态问题：看 [Runtime Center](../agents/runtime-center)
- 远程链路问题：看 [Remote Access Overview](../remote/remote-access-overview)
- 发布链路问题：看 [Publish Overview](../publish/publish-overview)
