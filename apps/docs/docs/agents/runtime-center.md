---
title: Runtime Center
slug: /agents/runtime-center
description: Manage supported runtimes and understand the difference between installed, signed in, and ready.
---

# Runtime Center

ContextGo 支持多种 runtime，但对普通用户来说最重要的不是协议名称，而是三件事：

- 已安装了吗
- 已登录或已配置了吗
- 真的 ready 了吗

## 为什么这页重要

很多时候，系统的失败并不是因为模型能力不够，而是因为用户误以为：

- 装好了就等于能用
- 登录过就等于当前项目 ready
- 在别的终端可用就等于在 ContextGo 里也可用

Runtime Center 的价值，就是把这些状态明确拆开。

## 三种状态的区别

### Installed

表示这台主机上已经存在对应 runtime 或 CLI。

它回答的是：

- 这台机器上有没有这个执行后端

但它不回答：

- 账号是否已登录
- 配置是否完整
- 当前项目是否真的可执行

### Signed In / Configured

表示这台主机上的必要鉴权或配置已经完成。

它回答的是：

- 凭证是否存在
- 基本配置是否已经具备

但它仍然不等于：

- 现在就能在当前工作区正常运行

### Ready

这是最重要的状态。

Ready 的含义应该是：

- 运行时已安装
- 账号或配置已就绪
- 当前主机和当前工作区可以真正发起任务

只有 Ready，才值得被当作“可用执行后端”。

## 第一阶段应该怎么做

最稳的策略很简单：

1. 只选一个最贴近日常工作的 runtime
2. 把它真正调到 ready
3. 跑通一条真实任务
4. 再考虑第二个 runtime

不要一上来追求“常见 runtime 全覆盖”。

## 哪些情况最容易误判

- 在系统终端里可用，但在当前产品环境里并没有 ready
- 登录动作做过了，但凭证没有被当前工作区正确使用
- CLI 已经存在，但依赖环境并不完整

## 对外公开时更稳的口径

公开文档里，最稳的表达不是“支持多少种 runtime”，而是：

- 如何确认它们的状态
- 如何判断当前主机是否 ready
- 遇到问题时应该先排查哪一层

## 下一步

- 想理解能力结构：看 [Agents & Capabilities](./index)
- 想理解状态差异：看 [Installed, Signed In, Ready](./installed-signed-in-ready)
- 想从真实工作方式进入：看 [Coding And Builder Workflow](../use-cases/coding-and-builder-workflow)
