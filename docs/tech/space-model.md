# Space 模型

## 状态

- 方向已确认
- `spaceId / mountId / workingDirectory` 的基础字段与部分运行时接线已经开始
- 完整产品模型、`Project` 层对象和 space-first UI 仍未完成

## 背景

ContextGo 当前对 workspace 的理解，更多还是执行侧概念：通常绑定某个会话或某个工作目录。这种模型足以支撑短生命周期的 agent 任务，但不足以承载长期上下文沉淀、多端同步以及未来的 connector 接入。

产品目标已经更大：

- ContextGo 继续作为多 Agent 编排平台
- 上下文需要沉淀到一个持久、local-first 的空间中
- 文档和白板需要成为一等上下文资产
- 外部系统应该通过 connector 进入，而不是临时塞进聊天消息

AFFiNE 之所以适合作为第一个高能力 space engine，是因为它已经具备：

- local-first 的 workspace 存储
- 文档和白板能力
- 知识组织能力
- 多端同步基础

但与此同时，ContextGo 不应该退化成 AFFiNE 的薄壳。ContextGo 仍然必须保留自己的核心方向：

- agent orchestration
- multi-agent session
- remote channels
- automation 和 task execution

本文档定义的就是这样一种空间模型：既能让 AFFiNE 能力被吸收进来，又不改变 ContextGo 的产品主轴。

## 产品定位

### ContextGo 要解决的问题

ContextGo 不是单纯的 AI 聊天窗口，也不是把本地目录直接包一层 Agent UI。

它要解决的是：

- 用户的长期工作上下文分散在会话、目录、文件、浏览器、外部系统和不同设备里
- Agent 的执行窗口通常是短期的，每次都像从零开始
- 本地目录对执行很重要，但并不能代表完整的长期工作语义
- 移动端、浏览器和远程入口需要接入同一套工作系统，但不能破坏桌面主机上的本地所有权

因此，ContextGo 的长期方向不是“会话驱动的聊天产品”，而是一个：

- desktop-first
- local-first
- multi-agent
- long-lived context driven

的工作系统。

一句话定义：

```text
ContextGo 是一个以本地为主权基础、以长期上下文为核心、由桌面主机驱动的多 Agent 工作系统。
```

### 当前可发版产品

当前最适合对外表达的产品定义是：

```text
ContextGo 是一个 desktop-first 的 Agent Workbench。
```

它当前已经清晰成立的部分包括：

- 桌面端作为真实执行宿主
- session / conversation 驱动的 Agent 工作流
- 本地工作目录与运行时工具接入
- WebUI / browser 访问
- Android / iOS / HarmonyOS 远程壳接入
- 持续演进中的 context engine 基础设施

当前不应对外过度承诺的部分包括：

- 完整成熟的 Space-first 信息架构
- 完整多人协作语义
- 完整 `Project` 层对象模型
- 完整可操作的 `Mount` 管理产品面
- 把 context engine 直接包装成面向用户的独立主功能

### 长期目标产品

长期目标可以定义为：

```text
Space-first 的 local-first Agent Work System。
```

也就是：

- `Workbench` 是执行入口
- `Space` 是长期上下文与协作容器
- `Project` 是 Space 内的工作单元
- `Session / Thread` 是具体执行视图
- `Context Engine` 负责长期沉淀、检索、压缩和组装上下文
- 桌面主机负责执行，移动端和浏览器作为远程使用面接入

## 核心决策

产品顶层对象应该是 `Space`，而不是 `Conversation`。

- `Space` 是持久上下文容器
- `Project` 是 `Space` 内的工作单元
- `Thread` 是空间内的执行视图
- `Artifact` 是空间内的执行产物
- `Mount` 是设备本地执行挂载点，不等于空间本体

这意味着心智模型要从：

```text
Conversation -> working directory -> agent task
```

转向：

```text
Space -> Project -> Thread -> Agent execution
```

## 术语边界

这一节补充几个容易混淆、但必须区分清楚的术语。

### Space

`Space` 是产品层的一等逻辑空间。

它负责：

- 持久上下文归属
- connector 归属
- channel / publication 归属
- thread / task 默认边界
- 长期文档、画板、artifact、source item 组织

`Space` 不是某个会话，也不是某个本地文件夹。

同时，`Space` 是长期上下文边界。
它可以管理：

- 某个单独项目的长期上下文
- 某个客户、团队或课题的跨项目上下文
- 一个用户在多个执行线程之上共享的长期知识与规则

因此：

- `Space` 可以只对应一个项目
- 也可以高于单个项目，承载跨项目共享上下文

### Connector

`Connector` 是外部产品访问与操作边界。

它回答的问题是：

- agent 通过什么受管执行面访问外部产品
- 这个产品能力由哪个控制面负责安装、鉴权、调用和状态管理
- 这些访问结果如何沉淀进 space context

在当前方向里：

- `connector` 由 `cgo` 统一承载
- `connector` 代表外部产品能力边界，而不是产品内 UI 模块
- `connector` 可以对应官方 CLI、官方 SDK、官方 API、MCP 或受管本地 runtime
- `connector` 的运行态、鉴权态、collect/store 流程应优先由 `cgo` 管理

例子：

- `github`
- `notion`
- `obsidian`
- `google-drive`
- `clipboard`
- `browser-extension`

因此必须明确：

- `connector` 不是 IM 发布渠道
- `connector` 也不是 coding runtime
- `connector` 更不是某个 skill 本身

### Vault Binding / Replica

当 `obsidian` 进入正式多设备同步模型后，`Space` 还需要补两个一等对象：

- `vault binding`
- `replica`

它们分别回答不同问题：

#### Vault Binding

`vault binding` 回答：

- 这个 `Space` 当前绑定的是哪一个 Obsidian vault 同步面
- 这个同步面采用什么策略
- 它当前是否存在风险（例如第三方同步痕迹、高漂移 workspace 状态）

它是 `Space` 下的稳定逻辑对象，而不是某台设备上的路径本体。

#### Replica

`replica` 回答：

- 哪些设备持有这个 `Space` 对应的本地完整 vault 副本
- 每个设备当前的同步 cursor / checkpoint 在哪里
- 哪个设备当前健康，哪个设备落后，哪个设备存在风险

关键原则：

- 一个 `Space` 可以有多个 replica
- replica 是设备 / runtime 维度的状态对象
- replica 不是 UI 状态，也不是 host-local 的路径别名

对于 `obsidian` 的单人多设备整库同步，建议采用：

```text
Space
  -> Obsidian Vault Binding
    -> Desktop Replica
    -> Mobile Replica
```

这里必须继续区分：

- `remote access`
  - 用户是否能远程连到某个 host
- `vault sync`
  - 这个 `Space` 对应的整份 vault 是否在多个 replica 之间同步健康

两者相关，但不是同一个对象，也不应被同一段产品文案混用。

### Channel / Publication

`Channel` / `Publication` 是 Agent 对外发布与交互的渠道边界。

它回答的问题是：

- agent 把消息发到哪里
- 远端用户通过哪个 IM 渠道与 agent 互动
- 哪个 audience / peer / chat 绑定到哪个 published agent

它属于产品内消息分发与远端交互模型，而不属于 connector 模型。

例子：

- Slack bot publication
- Telegram bot publication
- Discord bot publication
- Weixin bot publication
- Lark bot publication
- DingTalk bot publication

因此：

- `channel / publication` 是输出面 / 交互面
- `connector` 是输入面 / 操作面
- 两者都可能属于某个 `Space`
- 但它们不是同一个对象，也不应共用同一套产品术语

### Project

`Project` 是 `Space` 内的工作单元。

它更接近用户真正理解的“当前正在推进的一项工作”，例如：

- 一个代码仓库
- 一个产品迭代
- 一个研究课题
- 一个交付任务

它负责：

- 组织同一项工作下的 session / thread
- 绑定默认本地资源入口或默认 working directory
- 在同一 `Space` 内隔离不同工作单元的执行上下文

因此：

- `Project belongs to Space`
- `Project` 可以绑定一个默认本地工作目录
- 但 `Project` 不应被直接定义成“某个磁盘路径本身”
- 同一个 `Project` 后续允许对应多个本地资源入口或跨设备不同路径

当前仓库中，`Project` 还没有成为一等实现对象。
在现阶段，如果需要一个近似落点，可以临时把“一个带明确 working directory 的工作单元”近似看成 project-like object，
但不要把这种兼容做法误认为最终产品定义。

### Thread

`Thread` 是 `Space` 内的一条执行视图或任务线。

它更接近：

- 某次任务导向的 conversation
- 某条 workflow 的执行窗口
- 某个 agent 协作过程的上下文视图

它负责：

- 承载一次具体任务
- 记录 agent 交互、审批和产物关联
- 引用当前 thread 选中的 space context
- 在需要时绑定本地 mount

因此：

- `Thread belongs to Space`
- 长期目标中 `Thread belongs to Project`，而 `Project belongs to Space`
- `Thread` 不是长期知识归档容器
- `Thread` 也不是本地工作目录

### Conversation

在当前产品和代码里，很多地方仍然以 `Conversation` 作为主要 UI 承载对象。

迁移期内可以把它理解为：

- `Conversation` 是当前实现中的执行会话对象
- 在未来的 space-first 模型里，它更接近 `Thread` 的现有形态

也就是说：

- 现在的 `Conversation` 可以作为 `Thread` 的实现近似
- 但产品语义上，顶层对象已经不应再是 `Conversation`

在 `Project` 尚未落地前，当前实现可以近似理解为：

- `Conversation belongs to Space`
- 后续推荐演进到 `Conversation / Session belongs to Project`

### Mount

`Mount` 是某个 `Space` 在当前设备上的本地执行挂载点。

它负责：

- 把本地文件系统路径或资源根暴露给当前设备
- 为 agent execution 提供可选 working directory / resource root
- 表达“这个 space 在这台机器上可以访问哪些本地资源”

它的边界是：

- `Mount belongs to Space`
- 但 `Mount` 只在当前设备或 runtime 上生效
- `Mount` 不是 space 的全局身份
- `Mount` 不应该被直接当成同步对象在设备间复制

`Mount` 不是“这次具体跑在哪个目录”的同义词。
更准确地说：

- `Mount` 是某个本地资源入口或资源根的稳定引用
- `workingDirectory` 才是某次执行最终实际使用的物理目录

### Runtime Workspace

`Runtime Workspace` 不是新的顶层产品对象，而是执行时概念。

它通常表示：

- 某个 agent runtime 启动时实际绑定的 cwd
- 某次执行使用的本地目录
- 某个临时目录、仓库目录、导出目录或素材目录

### Coding Runtime

`Coding Runtime` 是 agent 实际运行所在的编码执行器。

它回答的问题是：

- 当前这次 agent 执行跑在什么 CLI / runtime 上
- 哪个 runtime 负责读取 native skills、执行工具调用、产生日志与会话

当前明确支持的 coding runtime 是：

- `opencode`
- `claudecode`
- `gemini`
- `codex`

其中：

- 产品层会把 repo-local skill 投影到这些 runtime 能识别的目录
- runtime 负责真正加载 skill
- runtime 本身不等于 connector

### Skill

`Skill` 是 agent 的使用说明与操作引导，不是 connector 的执行主体。

它回答的问题是：

- agent 应该如何调用某个 connector
- 某类任务应该遵循什么操作顺序
- runtime 已经可用的工具、CLI 和约束应该怎样被正确使用

在当前模型里：

- 项目内 repo-local skill 放在 `.connector/skills`
- skill 通过 workspace bootstrap 投影到 coding runtime 的 native skill 目录
- skill 负责教 agent 怎么用 connector
- `cgo` 负责真正执行 connector 命令和管理 connector 运行态

它和 `Mount` 的关系应该是：

- `Mount` 是模型层 / 产品层的“可挂载本地资源”
- `Runtime Workspace` 是运行时层真正拿去执行的本地目录

因此：

- 一个 `Runtime Workspace` 可以来自某个 `Mount`
- 也可以来自系统自动创建的临时目录
- 它是 host-specific 的执行状态，不是持久上下文本体

如果用户当前明确选择“在这台机器上的某个目录里工作”，那个具体概念优先对应：

- `workingDirectory`

而不是：

- `mountId`

`mountId` 更像“这个目录属于哪个本机挂载入口”的引用。

### 一句话区分

- `Space` 是长期逻辑空间
- `Project` 是空间内的工作单元
- `Thread` 是空间里的任务线 / 执行视图
- `Conversation` 是当前实现里对 thread 的近似承载
- `Mount` 是 space 在当前设备上的本地资源挂载点
- `Runtime Workspace` 是 agent runtime 真正使用的执行目录

### 当前推荐心智模型

```text
Space
└── Project
    └── Thread
        └── Agent Execution
            ├── Runtime Workspace (cwd)
            └── Tools / Skills / Runtime State
```

补充说明：

- 长期上下文属于 `Space`
- 项目级执行组织属于 `Project`
- 一次任务的执行视角属于 `Thread`
- 本地目录只是执行附着物，不应上升为产品顶层身份

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

### 1.1 Project 可以绑定路径，但不应退化成路径本体

`Project` 可以默认绑定一个工作目录，但不应直接定义成“磁盘路径本身”。

原因：

- 同一个项目可能对应多个本地资源入口
- 同一个项目在不同设备上的路径可能不同
- 项目是用户理解的工作单元，目录只是其本机执行入口之一

因此：

- `Project` 可以以 working directory 为默认锚点
- 但 `Project` 的长期身份应独立于某一条具体路径

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

### 4. ContextGo 负责编排，AFFiNE 负责第一个 Space Engine

AFFiNE 应该作为一个 space engine 被吸收，而不是直接成为新的顶层产品壳。

AFFiNE 贡献：

- workspace 模型
- workbench 概念
- 文档和白板表面
- local-first 数据底座
- 知识组织能力

ContextGo 继续负责：

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

### Project

空间内的工作单元。

职责：

- 组织同一项工作下的 session / thread
- 绑定默认工作目录或默认本机资源入口
- 作为用户理解的“当前正在推进的某项工作”的长期对象

例子：

- 某个代码仓库项目
- 某次版本发布项目
- 某个客户交付项目
- 某个研究主题项目

说明：

- 一个 space 可以有多个 project
- 一个 project 可以在不同设备上映射到不同路径
- project 可以帮助把“项目内上下文”和“跨项目共享上下文”区分开

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
- mount 更像本机资源入口引用，不等于最终 working directory

### Thread

空间内的执行视图。

职责：

- 承载任务导向的 conversation 或 workflow
- 引用空间内被选中的上下文
- 记录 agent 交互和审批过程
- 在需要时绑定本地 mount

说明：

- thread 属于某个 space
- 长期目标中 thread 更推荐归属某个 project，再由 project 归属于 space
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
    ├── Project
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
- `Project belongs to Space`
- `Thread belongs to Project` 是长期推荐模型
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
- projects
- docs
- boards
- threads
- artifacts
- connectors
- tasks
- search

当前 conversation-first shell 在迁移期可以保留，但最终的归属关系必须变成 space-first。

## AFFiNE 融合策略

AFFiNE 应该作为第一个 `Space Engine` 被集成，而不是作为新的产品壳整体替换 ContextGo。

优先吸收的能力：

- 类似 workbench 的内容工作台
- 文档和白板编辑能力
- local-first 存储能力
- workspace 组织能力
- search 和 indexing 能力

应继续保留在 ContextGo 的能力：

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

- 在 ContextGo 领域模型中增加 `Space`
- 让 conversation/thread 归属到 `spaceId`
- 让 artifacts、cron tasks、connector state 归属到 `spaceId`
- UI 可以暂时保持现状，但 conversation 不再是最高层容器

### Phase 2. 接入 AFFiNE 内容表面

- 在 renderer shell 中接入 AFFiNE 的文档和白板能力
- 不引入 AFFiNE 的 Electron shell
- ContextGo 继续作为 runtime shell 和 orchestration owner

### Phase 3. 把执行结果重新绑定回 Space

- 从当前 Space 发起 thread
- 默认从当前 Space 读取上下文
- 把执行结果先写回 artifact 层
- 支持从 artifact 提升为 document 或 board 内容

### Phase 4. 引入统一 Context Service

- 在 ContextGo 内部定义 provider-agnostic 的 space 操作能力
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

- 用 AFFiNE 替换 ContextGo
- 把一个 space 绑定成一个磁盘目录
- 把 `Project` 直接定义成某个固定物理目录
- 采用 AFFiNE Copilot 作为主 agent 层
- 现在就设计完整 `cgo` 命令面
- 把设备本地 runtime state 当成持久空间内容同步

## 总结

ContextGo 应该从 conversation-centered agent app 演进为
space-centered 的上下文与执行平台。

在这个目标架构里：

- `Space` 是持久逻辑容器
- `Project` 是空间内的工作单元
- `Replica` 是 local-first 存储状态
- `Mount` 是设备本地执行挂载点
- `Thread` 是任务导向的执行视图
- `Artifact` 是执行结果层

AFFiNE 是首个预期接入的 space engine，而 ContextGo 继续作为其上的编排与执行平台。
