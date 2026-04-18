<p align="center">
  <img src="./resources/contextgo_readme_header_0807.png" alt="ContextGo" width="100%">
</p>

<p align="center">
  <img src="./resources/contextgo_logo_no_border.png" alt="ContextGo Logo" width="120">
</p>

<p align="center">
  <strong>下一代 AI 原生工作台</strong><br>
  让顶尖大模型、Code Agent、项目上下文、连接器和远程协作真正进入同一个工作系统。
</p>

<p align="center">
  <a href="./README_EN.md">English</a> ·
  <a href="https://github.com/contextgo/contextgo/releases">下载发行版</a> ·
  <a href="https://contextgo.io">官方网站</a>
</p>

---

## ContextGo 是什么

ContextGo 不是另一个聊天壳，也不是把 API 包成一个消息框的桌面工具。

它是一套面向真实工作的 AI 原生工作台，用来解决一件更难的事：**怎么稳定地驾驭 Agent，让它在项目里持续干活，而不是在几轮对话之后失控、遗忘、污染上下文，或者脱离你的真实工作流。**

对普通用户来说，ContextGo 是一个可以真正帮你做事的下一代 AGI 助手。

对开发者和团队来说，ContextGo 是一套把 `project`、`Agent harness`、上下文治理、连接器、远程访问和多端产品层组织在一起的完整系统。

一句话概括：

> **Code Agent 不止 code。给它稳定的 harness、上下文和连接器，它就可以 build anything。**

---

## 它解决什么问题

今天的大模型已经很强，但真正进入长期工作时，常见问题仍然没有被解决：

- Agent 能推理，但缺少一套稳定的驾驭机制，长任务容易偏航
- 项目知识、人的偏好、成功模式和失败模式没有被持续沉淀
- AI 和原有软件、IM、文档、浏览器、本地文件之间仍然割裂
- 跨设备、跨会话、跨项目使用 Agent 的摩擦很高
- 普通人真正关心的是“它能不能帮我干活”，而不是背后用了哪家模型

ContextGo 的产品核心，就是把这些问题收敛成一个可持续运行的工作系统。

---

## 核心抽象

### 1. Harness Agent

Harness Agent 是 ContextGo 的狭义 Agent 定语。

它的重点不在“又造了一个模型”，而在于：**如何给顶尖大模型加上一套约束、披露和治理机制，让长时间的人机协作或纯 Agent 工作保持有序。**

这套机制通常围绕几个稳定对象展开：

- `project`：所有工作都基于项目目录展开
- `AGENTS.md`：规则入口与渐进式披露的起点
- `docs/`：更深层的背景、规范和领域文档
- `skills/`：任务型可执行上下文
- `hooks`、`commands`、`schedules`：自动化切面与快捷能力

模型本身负责推理和函数调用，Harness 负责让它更长时间地、在真实项目里可控地工作。

### 2. Agent Group

单个 Agent 已经能工作很久，但不是所有问题都适合一个 Agent 单线程解决。

ContextGo 的 Agent Group 更接近一种简单高效的协作机制，而不是复杂编排系统：

- 计划者只负责方向对齐
- 生成者持续产出
- 评估者持续判断
- 多个 Agent 也可以并行调研、交叉验证、赛马式产出

重点不是把编排做重，而是让多个被 harness 强化过的 Agent 在关键节点形成更高质量的判断。

### 3. Context Engine

Context Engine 是 ContextGo 的上下文稳定器。

它是 local-first 的上下文引擎，用来持续组织、提炼、更新和治理 Agent 工作过程中产生的高价值信号。它不是简单的聊天记录存档，也不是只有向量检索的传统 RAG。

它负责的事情包括：

- 从会话里抽取长期有效的偏好、风格、成功模式和失败模式
- 对项目上下文做熵增治理，减少脏上下文污染
- 支持跨 session、跨 project 的逻辑上下文空间 `context space`
- 在你不工作时继续整理和压缩上下文，反哺后续 Agent 工作

### 4. Context Connector

真正聪明的 Agent，不只是“会回答”，而是**能接入你的现有工作流，也能回到你的现有工作流。**

Context Connector 就是这层打通能力：

- 接入知识来源、文档、浏览器、本地文件和外部产品
- 连接 Feishu、Telegram、Slack、微信、钉钉等工作渠道
- 让 Agent 既能消费上下文，也能把结果重新发布回原有流程

它解决的是“上下文打通”和“软件能力打通”，让你的工作台尽量收敛到 ContextGo，而不是在多个产品之间来回复制粘贴。

### 5. Host / Client

ContextGo 默认采用 `Host Runtime + Client Shell` 模型：

- `Host` 是真正执行运行时、工具、浏览器、文件和复杂任务的设备
- `Client` 是远程访问和控制端，可以是桌面、浏览器或手机

这意味着：

- 桌面仍然是第一执行主机
- 手机是天然的远程控制端
- 远程体验复用同一套 WebUI / server runtime
- 未来 Host 可以运行在 macOS、Windows、Linux，甚至云端机器

---

## 你可以用 ContextGo 做什么

- 在一个项目里长期协作开发软件，而不是只做一次性问答
- 把 Agent 接入文档、浏览器、本地文件、云端服务和发布渠道
- 让 Agent 持续做调研、分析、整理、产出和回流
- 在桌面开始任务，在手机或浏览器上远程发起、监督和接管
- 构建自己的 Agent 助手、技能组合和自动化能力
- 让你的 Agent 越用越懂你，而不是每次都从零开始

---

## 产品层是什么样子

ContextGo 在产品层不是一堆抽象概念，而是一套可直接使用的工作台：

- 内置 Agent 与 Agent Package
- 可组合的 skills、hooks、commands、schedules
- 项目级 harness 初始化能力
- 多端访问与远程控制
- 可回到 IM / 业务渠道的发布与交互能力
- 逐步接入更多本地工具、浏览器操作和外部产品能力

它既服务开发者，也服务不懂底层技术、但只想让 Agent 真的替自己做事的人。

---

## ContextGo 项目矩阵

| 仓库                                                                    | 角色                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`contextgo`](https://github.com/contextgo/contextgo)                   | 主产品与主品牌仓库，承载桌面端、WebUI、mobile shell、Agent Package、Context Engine 等核心产品能力 |
| [`connector`](https://github.com/contextgo/connector)                   | ContextGo 的连接与执行边界层，负责外部产品、本地资源、浏览器和受控操作的接入                      |
| [`skillmarket`](https://github.com/contextgo/skillmarket)               | ContextGo 的技能发现、镜像、精选、组合与分发基础设施                                              |
| [`contextgo-releases`](https://github.com/contextgo/contextgo-releases) | 公共发行与分发出口，承载安装包、版本清单、更新元数据和公开内容导出                                |

---

## 快速开始

### 作为用户

1. 前往 [Releases](https://github.com/contextgo/contextgo/releases) 下载适合你平台的版本
2. 启动 ContextGo，选择本地 Host 或远程访问路径
3. 在项目目录中开始你的 Agent 工作流

### 作为开发者

```bash
bun install
bun run start
```

常用开发命令：

```bash
bun run webui
bun run test
bun run lint:fix
bun run format
bunx tsc --noEmit
```

---

## 技术与产品架构入口

如果你希望深入理解当前产品模型，建议从这些文档开始：

- [架构概览](./docs/tech/architecture.md)
- [Context Engine 事件架构](./docs/tech/context-engine-event-architecture.md)
- [Space 产品模型](./docs/tech/space-model.md)
- [移动端 / 远程访问模型](./docs/tech/mobile-remote-control.md)
- [Release / Distribution 标准](./docs/tech/release-distribution-standards.md)
- [Agent Package 架构](./docs/tech/agent-package-architecture.md)

---

## 开源状态

ContextGo 正在把 Agent 产品化、上下文化和连接化这三件事同时往前推。

这意味着它既是一个可直接使用的产品，也是一套持续演进的开源工程系统。部分能力已经稳定，部分能力仍在快速变化，但整体方向很明确：

- Agent 不应该只是聊天
- 上下文不应该只是历史记录
- 软件不应该只为人类界面设计，也应该对 Agent 友好

---

## 社区

- 官网: <https://contextgo.io>
- GitHub: <https://github.com/contextgo/contextgo>
- Releases: <https://github.com/contextgo/contextgo/releases>
