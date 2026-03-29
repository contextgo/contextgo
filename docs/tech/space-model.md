# Space 模型

## 状态

- 方向已确认
- 初始实现尚未开始

## 背景

AionUi 当前对 workspace 的理解，更多还是执行侧概念：通常绑定某个会话或某个工作目录。这种模型足以支撑短生命周期的 agent 任务，但不足以承载长期上下文沉淀、多端同步以及未来的 connector 接入。

产品目标已经更大：

- AionUi 继续作为多 Agent 编排平台
- 上下文需要沉淀到一个持久、local-first 的空间中
- 文档和白板需要成为一等上下文资产
- 外部系统应该通过 connector 进入，而不是临时塞进聊天消息

AFFiNE 之所以适合作为第一个高能力 space engine，是因为它已经具备：

- local-first 的 workspace 存储
- 文档和白板能力
- 知识组织能力
- 多端同步基础

但与此同时，AionUi 不应该退化成 AFFiNE 的薄壳。AionUi 仍然必须保留自己的核心方向：

- agent orchestration
- multi-agent session
- remote channels
- automation 和 task execution

本文档定义的就是这样一种空间模型：既能让 AFFiNE 能力被吸收进来，又不改变 AionUi 的产品主轴。

## 核心决策

产品顶层对象应该是 `Space`，而不是 `Conversation`。

- `Space` 是持久上下文容器
- `Thread` 是空间内的执行视图
- `Artifact` 是空间内的执行产物
- `Mount` 是设备本地执行挂载点，不等于空间本体

这意味着心智模型要从：

```text
Conversation -> working directory -> agent task
```

转向：

```text
Space -> Thread -> Agent execution
```

## 设计原则

### 1. Space 是逻辑空间，不是磁盘目录

`Space` 不能被定义成一个绑定的磁盘目录。

原因：

- 同一个 space 可能存在于多台设备上
- 移动端和服务端没有统一的本地路径模型
- 很多上下文来源根本不是文件夹
- 一个 space 可能同时关联多个本地执行目录

因此：

- `Space` 是逻辑对象
- 文件系统路径只是可选的设备本地挂载点
- local-first 存储应通过 replica 实现，而不是通过路径身份实现

### 2. 同步的是空间内容，不是设备状态

多端同步应该复制的是持久上下文对象，而不是某一台机器上的运行现场。

应该同步的内容：

- documents
- boards
- tags 和 collections
- artifact metadata
- source items
- task definitions
- thread 的结构化记录
- space settings

不应被当成全局同步内容的对象：

- 本机绝对路径
- 本机 credentials 或 tokens
- 机器本地缓存
- 临时 agent runtime state
- host-specific tool permissions

### 3. Space 由人和 Agent 共同构建

Space 不只是给人写笔记的地方。
它应该是一个同时对人和 agent 友好的上下文底座。

人应该能够：

- 写和整理文档
- 在白板中组织计划
- 审核和提升执行结果
- 决定长期的信息结构

Agent 应该能够：

- 读取和搜索空间内容
- 创建和更新文档
- 创建和补充白板
- 把执行结果写回空间
- 基于空间对象组装 task-scoped context pack

### 4. AionUi 负责编排，AFFiNE 负责第一个 Space Engine

AFFiNE 应该作为一个 space engine 被吸收，而不是直接成为新的顶层产品壳。

AFFiNE 贡献：

- workspace 模型
- workbench 概念
- 文档和白板表面
- local-first 数据底座
- 知识组织能力

AionUi 继续负责：

- multi-agent orchestration
- task execution
- remote channels 和 remote access
- automation / cron
- connector ingestion
- agent-facing tool 和 skill runtime

## 核心对象

### Space

顶层逻辑上下文容器。

职责：

- 组织持久上下文资产
- 为 thread 和 task 提供默认上下文边界
- 定义 connector 和 sync 的归属
- 支持产品中的全局切换

例子：

- 一个项目空间
- 一个客户空间
- 一个个人研究空间
- 一个团队知识空间

### Replica

某个 space 在某个设备或 runtime 上的 local-first 存储副本。

职责：

- 在本地持久化 space 内容
- 支持离线工作
- 后续参与同步

说明：

- 一个 space 可以有多个 replica
- replica 是设备或 runtime 维度的
- replica 是存储状态，不是 UI 状态

### Mount

某个 space 在当前设备上的本地执行挂载点。

职责：

- 暴露本地文件系统路径或运行时资源
- 给 agent 提供 working directory 或 resource root
- 作为可选能力存在

例子：

- 一个代码仓库路径
- 一个素材目录
- 一个导出目录
- 一个临时执行目录

说明：

- 一个 space 可以有零个、一个或多个 mount
- mount 不是全局同步的空间身份

### Thread

空间内的执行视图。

职责：

- 承载任务导向的 conversation 或 workflow
- 引用空间内被选中的上下文
- 记录 agent 交互和审批过程
- 在需要时绑定本地 mount

说明：

- thread 属于某个 space
- thread 不是长期知识归档容器

### Artifact

空间内的一等执行产物。

例子：

- 生成的报告
- PPT 或表格
- 图片输出
- 代码 patch 摘要
- 抽取后的笔记
- 结构化计划

职责：

- 保存中间结果和最终结果
- 支持预览、复用、搜索和提升
- 可回链到文档或白板中

### Document

空间中的长期知识对象。

职责：

- 保存计划、报告、笔记、SOP、分析、决策和总结
- 承接由 artifact 提升而来的稳定结果
- 成为人和 agent 都可复用的长期上下文来源

### Board

空间中的长期空间化知识对象。

职责：

- 支持发散思考和视觉化计划
- 组织文档、产物和来源之间的关系
- 后续可作为任务拆解和编排表面

### SourceItem

通过 connector 进入空间的标准化外部上下文对象。

例子：

- 剪藏网页
- Notion 页面快照
- 飞书文档镜像
- 剪贴板捕获结果

职责：

- 保存来源元数据
- 进入和原生空间内容一致的组织与搜索体系
- 参与 context pack 装配

### ConnectorBinding

某个外部上下文来源在某个 space 中的绑定配置和同步状态。

职责：

- 保存 provider-specific connection metadata
- 跟踪 ingestion 和 refresh 状态
- 定义外部来源归属于哪个 space

### Context Pack

某次 agent 执行真正拿到的上下文包。

职责：

- 从 space 中筛选出任务所需的最小上下文集合
- 避免把整个 space 直接塞给模型
- 组合 docs、board nodes、artifacts、source items 和 thread history

这一定义刻意与整个 space 区分开：

- space 保存全量上下文
- context pack 只发送任务所需子集

## 关系模型

```text
User
└── Space
    ├── Replica (per device/runtime)
    ├── Mount (per device/runtime)
    ├── Document
    ├── Board
    ├── Artifact
    ├── SourceItem
    ├── Thread
    ├── Task
    ├── ConnectorBinding
    └── Space Memory / Index
```

关键归属规则：

- `Thread belongs to Space`
- `Artifact belongs to Space`
- `Document belongs to Space`
- `Board belongs to Space`
- `SourceItem belongs to Space`
- `ConnectorBinding belongs to Space`
- `Mount belongs to Space`，但只在当前设备或 runtime 生效
- `Replica belongs to Space`，但属于 local-first 存储状态

## UI 影响

产品壳最终应该演进成 space-centric navigation。

目标导航模型：

- global space switcher
- space overview
- docs
- boards
- threads
- artifacts
- connectors
- tasks
- search

当前 conversation-first shell 在迁移期可以保留，但最终的归属关系必须变成 space-first。

## AFFiNE 融合策略

AFFiNE 应该作为第一个 `Space Engine` 被集成，而不是作为新的产品壳整体替换 AionUi。

优先吸收的能力：

- 类似 workbench 的内容工作台
- 文档和白板编辑能力
- local-first 存储能力
- workspace 组织能力
- search 和 indexing 能力

应继续保留在 AionUi 的能力：

- agent management
- multi-agent sessions
- remote channels
- cron automation
- connector orchestration
- skill 和 tool runtime

AFFiNE Copilot 不在第一阶段集成范围内。
目标是复用 AFFiNE 作为空间和内容底座，而不是采用它的 AI chat runtime。

## 实现路线

### Phase 1. 把 Space 引入为一等产品对象

- 在 AionUi 领域模型中增加 `Space`
- 让 conversation/thread 归属到 `spaceId`
- 让 artifacts、cron tasks、connector state 归属到 `spaceId`
- UI 可以暂时保持现状，但 conversation 不再是最高层容器

### Phase 2. 接入 AFFiNE 内容表面

- 在 renderer shell 中接入 AFFiNE 的文档和白板能力
- 不引入 AFFiNE 的 Electron shell
- AionUi 继续作为 runtime shell 和 orchestration owner

### Phase 3. 把执行结果重新绑定回 Space

- 从当前 Space 发起 thread
- 默认从当前 Space 读取上下文
- 把执行结果先写回 artifact 层
- 支持从 artifact 提升为 document 或 board 内容

### Phase 4. 引入统一 Context Service

- 在 AionUi 内部定义 provider-agnostic 的 space 操作能力
- 先由 AFFiNE 实现第一个 provider
- 在内部对象模型稳定前，不急着设计 CLI 表面

### Phase 5. 在 Context Service 之上暴露 Agent Skills

- 读取 space context
- 搜索和读取文档
- 写和更新文档
- 创建和补充白板
- 挂载 artifacts
- 组装 task-scoped context pack

### Phase 6. 扩展 Connector 覆盖面

- 浏览器剪藏
- 剪贴板接入
- 本地文件系统镜像
- 飞书或 Notion provider
- 等模型稳定后再逐步接入更多 provider

### Future Phase. 通过 `cgo` 统一对外入口

最终的命令和自动化表面应该是 `ContextGo CLI`，即 `cgo`，而不是某个 AFFiNE 专属 CLI。

`cgo` 应成为统一上下文能力入口，服务于：

- humans
- agents
- skills
- automation
- 未来的多种 provider

这个 CLI 只有在内部 space 模型和 provider surface 稳定后才应该开始设计。

## 非目标

本文档不打算做这些事：

- 用 AFFiNE 替换 AionUi
- 把一个 space 绑定成一个磁盘目录
- 采用 AFFiNE Copilot 作为主 agent 层
- 现在就设计完整 `cgo` 命令面
- 把设备本地 runtime state 当成持久空间内容同步

## 总结

AionUi 应该从 conversation-centered agent app 演进为
space-centered 的上下文与执行平台。

在这个目标架构里：

- `Space` 是持久逻辑容器
- `Replica` 是 local-first 存储状态
- `Mount` 是设备本地执行挂载点
- `Thread` 是任务导向的执行视图
- `Artifact` 是执行结果层

AFFiNE 是首个预期接入的 space engine，而 AionUi 继续作为其上的编排与执行平台。
