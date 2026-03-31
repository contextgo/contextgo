# Supermemory 适配性评估与接入计划

## 背景

当前 ContextGo 已经具备三类核心能力：

- 多 Agent 接入与统一会话壳
- 多端访问与远程 channel 能力
- connector 接入与 agent 协作执行能力

真正缺失的不是“再接一个 Agent”或“再接一个 connector”，而是把已经打通的上下文沉淀成一个长期、可隔离、可检索、可复用的系统能力。

这正是 Supermemory 最值得借鉴的地方。

但需要先把一个边界讲清楚：

- ContextGo 要解决的是 `Space` 级别的长期上下文管理
- Supermemory 当前公开仓库更接近 `context/memory engine + 接入层`

两者有关，但不是同一个层次的问题。

## 结论摘要

结论先行：

- 适合引入 Supermemory 的建模思想，也适合按需复用它的部分开源包。
- 不适合把 Supermemory 直接当成 ContextGo 的顶层 `Space` 引擎，也不适合把它的公开仓库直接作为 ContextGo 新后端的起点。
- ContextGo 应先完成自己的 `Space` 领域模型，再在 `Space` 之下引入 Supermemory 风格的 `document -> chunk -> memory -> profile -> retrieval` 能力。
- 如果未来需要兼容它的 SDK、tools、MCP 或图谱 UI，应该通过兼容层接入，而不是让 ContextGo 的核心领域模型被它反向定义。

一句话判断：

`Supermemory 更适合成为 ContextGo 的 Context Service / Memory Engine 参考实现，而不是 Space 本体。`

## 证据链

本结论不是基于外部宣传，而是基于当前本地仓库与设计稿的交叉验证。

### Supermemory 当前公开出来的是什么

从本地仓库可以确认，Supermemory 已公开的重点主要是：

- SDK / tools / middleware
- MCP server 外壳
- memory graph 组件
- validation schema 与产品对象建模
- Web/Docs/Console 前端

关键证据：

- `apps/web/.env.example` 默认后端直接指向 `https://api.supermemory.ai`
- `apps/mcp/src/server.ts` 默认 `API_URL` 也是 `https://api.supermemory.ai`
- `packages/lib/api.ts` 公开了前端/API schema 抽象
- `apps/docs/deployment/self-hosting.mdx` 明确 self-host 需要 enterprise deployment package
- `packages/validation/schemas.ts` 已公开 `SpaceSchema`、`MemoryEntrySchema` 等核心对象 schema

这说明：

- 它不是“假开源”
- 但也不是“完整开源的上下文引擎”
- 核心引擎仍然以托管服务或企业交付为主

### Context OS 三份设计稿的真实价值

`/Users/bytedance/project/supermemory/CONTEXT_OS_PLAN.md`、`CONTEXT_OS_TECH_DESIGN.md`、`CONTEXT_OS_API_SPEC.md` 的价值主要在于：

- 把记忆系统从普通 RAG 中拆出来
- 把 `memory` 定义为状态对象，而不是文本片段
- 明确 `updates / extends / derives` 的生命周期关系
- 明确 `static / dynamic profile` 的 compaction 思路
- 明确 `profile / search / context` 应由统一服务编排，而不是让 agent 散调多个接口

但这三份稿子更像：

- “如何做自有 context OS 后端”

而不是：

- “如何把 Supermemory 现成接进 ContextGo”

## 与 ContextGo 当前方向的匹配度

### 已有方向是相容的

ContextGo 自己已经有一份明确的空间模型文档：`docs/tech/space-model.md`。

其中已经定义了：

- `Space` 是逻辑空间，不是磁盘目录
- `Replica` 是 local-first 存储副本
- `Mount` 是设备本地执行挂载点
- `Thread` 是空间内的执行视图
- `Artifact` / `Document` / `Board` / `SourceItem` / `ConnectorBinding`
- `Context Pack` 才是一次执行真正发送给模型的子集

这与 Supermemory 最有价值的思想并不冲突，反而是天然互补：

- ContextGo 的 `Space` 模型解决“长期上下文归属和逻辑边界”
- Supermemory 风格的引擎解决“空间内容如何沉淀、检索、压缩和组装”

### 最大错位点不是技术，而是名词

最需要警惕的错位是：

- ContextGo 需要的是用户可感知、可切换、可归属任务和资产的 `Space`
- Context OS 设计稿里的主边界更多是 `scope`

`scope` 更像内部检索/权限/分区维度，不能直接等同于 ContextGo 的产品级 `Space`。

如果直接把两者画等号，会得到一个问题很大的结果：

- 后端多了一个分区键
- 但产品层并没有真正得到一个长期上下文空间

因此推荐做法是：

- `Space` 继续作为 ContextGo 顶层产品对象
- `scope` 作为 Context Service 内部的检索/权限/隔离维度
- `scope` 至少要能映射 `spaceId`
- 但不应该取代 `Space`

### 适合借鉴的部分

高匹配度能力：

- `document -> chunk -> memory -> profile` 的分层建模
- `updates / extends / derives` 的记忆演化关系
- `profile + memory + doc` 的检索编排思路
- `POST /v1/context` 作为统一上下文装配入口
- 兼容层思路：主接口稳定，第三方 contract 走 adapter

中等匹配度能力：

- connectors 的抽象方式
- MCP 接入层
- memory graph 可视化

低匹配度或不宜直接照搬的部分：

- 直接依赖 `api.supermemory.ai`
- 直接 fork 整个公开仓库作为 ContextGo 核心后端
- 以 cloud service / Postgres-first / microservice-first 的方式起步
- 把 `space` 简化成记忆容器，忽略 `mount`、本地执行目录、多端副本和桌面 runtime

## 当前 ContextGo 代码状态

### 主分支的状态

主分支目前还是明显的 `workspace` 心智模型：

- conversation 普遍绑定 `workspace`
- agent runtime 以工作目录驱动
- preview、upload、cron、discussion group 等能力大多仍是会话或工作目录导向

### 远端 PR 与本地 worktree 线索

截至 `2026-03-28`，当前远端 `contextgo/contextgo` 上没有一个正式以逻辑 `Space` 为目标的 PR。

可以确认的结论是：

- 没有与本地 `feat/space-working-directory-terminology` 对应的远端 PR
- 没有标题或 head branch 明确指向 `space` / `spaceId` / `workingDirectory` 重构的 PR
- 当前最接近的远端线索不是 `Space` 本身，而是相邻问题域的 PR

相邻但不等价的远端 PR 主要有：

- `#24 feat(openclaw): support native agent selection`
  - 已开始把 OpenClaw session 解析到选中的原生 agent 和对应 workspace
  - 更像是 `workspace-aware runtime identity` 演进，不是 `Space` 模型
- `#18 feat(session): support external Claude Code takeover`
  - 更偏 external session / imported runtime continuity
- `#22 feat(conversation): support opencode external session import`
  - 更偏 conversation continuity
- `#28 feat(channels): adopt connector binding resource model`
  - 更偏 connector / binding / external session / run 资源模型
  - 是 `Space` 的相邻层，不是 `Space` 本体

真正最强的 `Space` 信号来自本地 worktree：

- `ContextGo-space-working-directory-terminology`
  - 当前只有一个已提交 commit：`feat(space): add sidebar context space switcher`
  - 但 worktree 内还有一大批未提交改动，已经开始落 `spaces` 表、`SpaceService`、`ConversationSpaceBinding`、`spaceId/mountId/workingDirectory`
  - 说明 `Space` 方向目前更像“本地正在成形的设计线”，而不是“远端已有成型 PR，等待合并”

### 进行中的 `space` 实现线

本地 worktree `ContextGo-space-working-directory-terminology` 里已经出现了一条未提交的实现线，核心动作包括：

- 在 `src/common/config/storage.ts` 引入 `ConversationSpaceBinding`
- 增加 `TSpace` 与 `SpaceEngine`
- 在 `ConversationServiceImpl` 中为新会话补 `spaceId`
- 在 `initAgent` 链路中把 `spaceId` / `mountId` / `workingDirectory` 贯穿到 conversation extra
- 在数据库 schema 中增加 `spaces` 表
- 增加 `SpaceServiceImpl` 与 `SqliteSpaceRepository`
- 历史分组与筛选开始优先按 `spaceId` 工作

这说明方向是正确的，但当前阶段只能算“基础骨架已经出现”，还远未完成。

### 这条实现线的不足

当前不足主要有六类：

- `spaceId` 仍主要附着在 `conversation.extra`，还不是全局统一的资产归属主键
- `Mount` 还没有成为一等对象，设备本地路径仍主要靠兼容字段维持
- `Artifact`、`SourceItem`、`ConnectorBinding`、`Context Pack` 还没有落地
- cron、preview、导出、上传、检索等资产还未全面转为 `space` 归属
- 当前 worktree 仍是 dirty 状态，不适合作为可直接合并的基线
- `Space` 与未来 `AFFiNE` 接入、`Context Service`、记忆引擎之间的责任边界还没正式写死

换句话说：

- 现在的实现解决的是“Thread 开始属于某个 Space”
- 还没有解决“Space 成为真正的上下文隔离边界”

## 与本地 `space` 实现线和 PR #28 的关系

这部分是当前最需要明确的现实问题。

因为现在真正阻塞 `Space` 继续推进的，不是“要不要接 Supermemory”，而是：

- 本地 `space` worktree 已经做出一批基础设施改动
- 远端还有一个相邻但不等价的 PR `#28 feat(channels): adopt connector binding resource model`
- 两者在数据库层、conversation 模型层、bridge 层已经开始碰撞

如果不先把这层关系理顺，后面无论做 `Space` 还是做 Supermemory 兼容，都会进入反复返工。

### 当前这条本地 `space` 线到底是什么状态

本地 worktree `ContextGo-space-working-directory-terminology` 当前不是一个“小功能未提交”，而是一条已经深入基础层的未整理实现线。

相对其已提交的唯一 commit `feat(space): add sidebar context space switcher`，当前未提交部分大致规模是：

- `60` 个文件变更
- `1317` 行新增
- `372` 行删除

已落下去的内容包括：

- `ConversationSpaceBinding`
- `TSpace`
- `SpaceServiceImpl`
- `SqliteSpaceRepository`
- `spaces` 表与 migration
- `spaceId / mountId / workingDirectory` 贯穿 conversation 创建链路
- discussion group 子会话继承 `spaceId`
- 历史分组优先按 `spaceId`

这说明两件事：

- 方向基本正确
- 但它已经不是一个适合直接 merge 的脏 diff

### 它与 PR #28 的真实冲突面

这条本地 `space` 线与 PR `#28` 的主要重叠文件有：

- `src/common/adapter/ipcBridge.ts`
- `src/common/config/storage.ts`
- `src/process/services/database/index.ts`
- `src/process/services/database/migrations.ts`
- `src/process/services/database/schema.ts`
- `src/process/services/database/types.ts`

这不是简单的代码冲突，而是语义冲突。

#### 冲突 1：数据库 migration 版本号直接撞车

本地 `space` 线当前是：

- `v18 = spaces table`
- `CURRENT_DB_VERSION = 18`

PR `#28` 当前是：

- `v18 = channel binding resource model`
- `v19 = assistant session compatibility expansion`
- `CURRENT_DB_VERSION = 19`

因此本地 `space` 线绝不能按原样合入。

如果强行 merge：

- migration 编号会直接错乱
- 已经存在的 schema upgrade 路径会失真
- 后续用户升级时会出现不可预测分支

#### 冲突 2：conversation 模型正在从两个方向扩张

本地 `space` 线给 conversation 补的是：

- `extra.spaceId`
- `extra.mountId`
- `extra.workingDirectory`
- 兼容保留 `extra.workspace`

PR `#28` 给 conversation 补的是：

- `externalSessionId`
- `rootRunId`

这两类字段并不互斥，但必须在同一份 `TChatConversation` 形状里统一表达。

推荐判断是：

- `spaceId / mountId / workingDirectory` 继续留在 `conversation.extra`
- `externalSessionId / rootRunId` 保持 conversation 顶层字段

也就是说：

- 一个 conversation 既有逻辑空间归属
- 也有外部 channel/session/run 归属

两者应该并存，而不是二选一。

#### 冲突 3：`workspace_ref` 的语义已经不够用了

PR `#28` 在 `agent_profiles` 和 `runs` 中引入了 `workspace_ref`。

这个命名在旧模型里能工作，但在 `Space` 模型开始成立之后会立刻变得含混：

- 它如果表示逻辑上下文边界，那应该是 `spaceId`
- 它如果表示设备本地执行路径，那应该更接近 `mountId` 或 `workingDirectory`

所以这里最重要的不是立刻改名，而是先把语义钉死：

- `Space` = 产品级逻辑上下文容器
- `Mount` / `workingDirectory` = 设备或 runtime 上的物理执行位点
- `workspace_ref` 不能再被当成逻辑 `Space` 的替代名词

更具体地说：

- `agent_profiles.workspace_ref` 作为“已发布能力”的长期字段，语义上偏危险
- `runs.workspace_ref` 作为一次运行时的物理上下文快照，还勉强说得通

因此后续融合时应该优先修正的是 `agent_profiles` 的语义，而不是只做表面 rename。

### 是否应该继续在当前 dirty worktree 上直接做

不建议。

原因不是它方向错，而是它当前承担了太多事情：

- 核心数据模型
- runtime 兼容命名迁移
- renderer 历史与筛选行为
- preview / export / upload 等边缘路径兼容
- discussion group 继承逻辑

这类 diff 如果继续在原 dirty worktree 上滚，会出现三个问题：

- 无法判断哪些改动属于 `Space foundation`，哪些只是兼容顺手修补
- 与 PR `#28` 的融合点会越来越分散
- 后面做 code review 和 migration review 会变得非常困难

更合适的做法是：

- 把这条 dirty worktree 当成“设计与实现参考源”
- 不把它当成直接 merge 源
- 在新的独立 worktree 里手工移植“可合并子集”

### 推荐的融合策略

建议采用“冻结参考线 + 新建可合并 foundation 线”的方式推进。

#### Step 1：冻结当前 dirty `space` worktree

不要继续把新需求直接堆进 `ContextGo-space-working-directory-terminology`。

它当前更适合作为：

- 领域方向参考
- 兼容链路参考
- 测试样例参考

而不是：

- 正式 merge 基线

#### Step 2：新建干净的 `space-foundation` worktree

推荐从以下基线启动，而不是从当前 dirty worktree 继续改：

- 优先方案：基于 PR `#28` 的最新 head 或它合入后的主线继续
- 次优方案：基于当前 `main`，但提前按“未来会并入 PR #28”来设计字段与 migration

优先基于 PR `#28` 的原因很现实：

- 它已经是正式 PR
- 它已经占用了 `v18` / `v19`
- 它已经定义了 connector / external session / run 的资源层
- 本地 `space` 线本来就需要适配这些新增字段

换句话说：

- 不应该让 PR `#28` 去适配一份脏的本地 `space` diff
- 应该让新的 `space-foundation` 在更清晰的资源模型上落地

#### Step 3：只搬运可以独立成型的 `Space foundation`

第一批建议搬运的内容：

- `ConversationSpaceBinding`
- `TSpace`
- `SpaceServiceImpl`
- `SqliteSpaceRepository`
- `spaces` 表
- 新建 conversation 自动补 `spaceId`
- discussion group 子会话继承 `spaceId / mountId / workingDirectory`
- history/grouping 优先按 `spaceId`
- `workspace -> workingDirectory` 的兼容归一层

第一批不要一起搬运的内容：

- preview / export / upload 全链路兼容修补
- 大量 UI 细节与边缘交互优化
- 任何把 `Space` 进一步扩展成资产归属中心的后续改造

判断原则很简单：

- 只搬运“让 Thread 有 Space 归属”所必需的部分
- 不要一次把“所有依赖 workspace 的路径兼容”一起吞下

#### Step 4：在新 foundation 线上做正式融合，不做临时拼接

建议在这个阶段明确以下规则：

- `conversation.extra.spaceId` 是逻辑空间归属主键
- `conversation.extra.mountId` 是设备本地挂载点引用
- `conversation.extra.workingDirectory` 是本次运行真实执行目录
- `conversation.extra.workspace` 只作为兼容字段保留
- `conversation.externalSessionId` / `conversation.rootRunId` 继续保留在顶层

数据库层建议：

- 如果 foundation 基于 PR `#28`，那么 `spaces` migration 应该是 `v20`
- 不再复用 `v18`
- `schema.ts` 与 `migrations.ts` 一次性按统一版本线整理

命名层建议：

- 暂时不要求 PR `#28` 一次性把所有 `workspace_ref` 全改掉
- 但必须在文档与类型注释里明确：`workspace_ref` 不是 `Space`
- 后续单独发一轮 `workspace_ref -> mount/workingDirectory/defaultSpace` 语义拆分修正

### 一个更稳妥的分阶段落地顺序

建议把后续工作拆成三个开发分支，而不是一个分支上滚到底。

#### Branch A：`space-foundation`

只解决：

- `Space` 作为 conversation 的逻辑归属边界
- `spaces` 持久化
- `spaceId / mountId / workingDirectory` 最小贯通
- 历史分组和 discussion group 的主路径兼容

交付标准：

- 新 conversation 永远带 `spaceId`
- 老 conversation 在读取或迁移后能稳定得到 `spaceId`
- `spaceId` 优先于执行目录参与关联分组

#### Branch B：`space-channel-reconcile`

在 `space-foundation` 之上，继续解决：

- 与 PR `#28` 的 `agent_profiles` / `external_sessions` / `runs` 的语义对齐
- 明确 channel ingress 如何绑定到 `Space`
- 明确 agent profile 默认上下文到底引用什么

这一层真正需要决策的是：

- `AgentProfile` 默认绑定的是 `spaceId`、`mountId`，还是两者都可选
- `Run` 需要记录的是逻辑上下文、物理执行位点，还是两者都记

当前推荐答案是：

- `AgentProfile` 应优先引用逻辑 `Space`
- `Run` 可以同时记录 `spaceId + mountId + workingDirectory`

#### Branch C：`space-owned-assets`

最后再把真正的上下文资产归属迁过去：

- preview history
- exports
- uploads
- cron
- promoted artifacts
- connector-derived source items

如果这一层不做，`Space` 仍然只是 conversation grouping，不是真正的上下文隔离边界。

## 建议的总架构

推荐把 ContextGo 后续能力拆成三层，而不是试图用一个系统同时承担全部角色。

### 第一层：ContextGo Product Shell

ContextGo 继续负责：

- multi-agent orchestration
- thread / session / discussion group
- remote channels
- cron automation
- local runtime 与多端壳
- connector 编排
- tool / skill runtime

### 第二层：Space Model

`Space` 继续作为 ContextGo 顶层逻辑对象，至少覆盖：

- `Space`
- `Replica`
- `Mount`
- `Thread`
- `Artifact`
- `SourceItem`
- `ConnectorBinding`

这里的关键原则不变：

- `Space != workingDirectory`
- `Mount` 是设备本地能力，不是空间身份
- `Thread` 属于 `Space`
- `Context Pack` 由 `Space` 派生，但不等于整个 `Space`

### 第三层：Context Service / Memory Engine

这一层才是最适合吸收 Supermemory 思想的地方。

建议先在 monorepo 内固定一个独立边界：`packages/context-engine`。

这样做的目的不是“提前服务化”，而是避免后续把 ingestion、memory、profile、retrieval 继续散落回：

- conversation service
- channel runtime
- connector adapters
- renderer state

当前恢复出来的 package 只承担两件事：

- 固定 context engine 的术语表和职责边界
- 提供后续 MVP 能落地的 placeholder 入口与设计文档

其中 Phase 0 / Phase 1 的可实施接口和数据表清单，已经单独收敛到：

- `packages/context-engine/docs/phase-0-1-foundation.md`

这也对应当前仓库阶段最现实的落法：

- 先 modular monolith
- 先 package boundary
- 后续再决定是否拆 sidecar 或 remote service

建议内部模块化成：

- `Ingestion`
- `Document Index`
- `Memory Lifecycle`
- `Profile Compaction`
- `Retrieval Orchestrator`
- `Context Assembler`

建议的数据与服务心智：

- `Space` 是上层产品边界
- `scope` 是底层检索与权限边界
- `document` 是原始内容对象
- `memory` 是抽取后的状态对象
- `profile` 是压缩视图
- `context` 是查询时临时拼装结果

## 为什么不建议直接“接 Supermemory”

### 原因 1：它不是完整开源引擎

公开仓库并没有提供完整后端，所以直接接源码并不能省掉最难的那部分工作。

### 原因 2：它不能替代 ContextGo 的 `Space`

Supermemory 的强项是：

- memory lifecycle
- profile
- retrieval
- tools / sdk / mcp 接入

它不负责：

- 本地工作目录挂载
- Electron 多进程 runtime
- 多端 channel 壳
- agent orchestration
- 空间内的 docs/boards/thread/artifact 全栈归属模型

### 原因 3：它的部署形态和 ContextGo 当前节奏不一致

Context OS 设计稿默认：

- Postgres
- pgvector
- object store
- queue
- background workers

这套架构长期没问题，但对 ContextGo 当前阶段来说太重。

更现实的落地方式应该是：

- 先做 modular monolith
- 先在 ContextGo 主进程 + worker 里建立服务边界
- 先让 `Space` / `Thread` / `Mount` / `Artifact` 模型稳定
- 等 server mode 与云部署需求真正明确后，再决定是否拆成独立服务

## 推荐接入顺序

### Phase 0: 固化 `Space` 基础能力

目标：

- 把当前未提交 `space` 实现线整理成可合并的基础分支
- 不直接复用 dirty worktree，而是人工移植可合并子集
- 优先在 PR `#28` 的数据模型基线上完成融合
- 明确 `workspace` 到 `workingDirectory` 的兼容策略
- 明确 `spaceId`、`mountId`、`workingDirectory` 三者关系

最小交付：

- `spaces` 表与 `SpaceService` 正式入主线
- migration 版本线与 PR `#28` 不冲突
- 新建 conversation 必有 `spaceId`
- 历史分组、discussion group、conversation tabs 全部按 `spaceId` 优先工作
- 老数据有默认 `space` 迁移策略

### Phase 1: 让 `Space` 成为真正归属边界

目标：

- 不只会话属于 `space`
- 与上下文有关的资产也要属于 `space`

需要接入的对象：

- cron jobs
- preview history
- exports
- uploads
- artifact metadata
- connector state

如果这一层不做，`space` 仍然只是历史分组标签。

### Phase 2: 建立 `Mount` 与 `Context Pack`

目标：

- 把逻辑空间和设备本地执行目录彻底分开
- 让 agent 执行真正消费 `Context Pack`

需要落地：

- `Mount` 模型与设备本地路径绑定
- `Context Pack Assembler`
- 从 `space` 中选取最小必要上下文，而不是把整个目录或整个会话历史塞给模型

### Phase 3: 做 ContextGo 自己的 Context Service MVP

目标：

- 在 ContextGo 内部跑通最小可用的上下文引擎

建议实现落点：

- `packages/context-engine`
- 主进程通过 service adapter 调用
- 重计算链路逐步下沉到 worker

建议先做：

- documents
- chunks
- memories
- profile snapshots
- `/v1/search`
- `/v1/profile`
- `/v1/context`

数据源先限定为：

- conversation history
- uploaded files
- connector imported text
- promoted artifacts

### Phase 4: 再做 Supermemory 兼容层

只有在内部模型稳定后，才建议做：

- `/compat/supermemory/v3/*`
- `/compat/supermemory/v4/*`

优先兼容的对象：

- documents
- conversations
- profile
- search

这样才能低成本复用：

- `@supermemory/tools`
- `@supermemory/ai-sdk`
- `packages/memory-graph`

`apps/mcp` 建议更晚再评估：

- 短期可以兼容接口
- 长期更合理的是 fork 后改 auth/provider 层

### Phase 5: 把 AFFiNE 与 Context Engine 组合起来

如果 ContextGo 继续沿 `docs/tech/space-model.md` 的方向演进，那么中长期最合理的组合不是二选一，而是分层组合：

- AFFiNE 一类系统负责 docs / boards / local-first content surface
- Supermemory 风格引擎负责 memory / profile / retrieval / compatibility
- ContextGo 负责 orchestration / runtime / channels / automation

这三层是互补关系，不是替代关系。

## 需要避免的错误

不要做这些事：

- 不要把 `Space` 重新定义成某个磁盘目录
- 不要把 `scope` 直接暴露成产品级 `Space`
- 不要在 `Space` 基础模型未稳定前就急着接入 `@supermemory/tools`
- 不要为了复用 `apps/mcp` 去反向污染 ContextGo 的 auth contract
- 不要把图谱 UI 当成上下文系统的核心
- 不要在当前阶段上来就拆成多服务、队列、对象存储、独立检索服务

## 最终建议

最终建议可以压缩成三句话：

- `Space` 先行，Supermemory 思想后接。
- ContextGo 自己定义主模型，Supermemory 只做参考实现与兼容目标。
- 短期做 Space Foundation，中期做 Context Service MVP，后期再做 Supermemory compatibility 和图谱/MCP 复用。

按这个顺序推进，ContextGo 才能在不丢掉现有多 Agent 与多端优势的前提下，把“上下文管理”真正补成一项系统能力。
