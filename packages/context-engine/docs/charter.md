# Context Engine Charter

## 状态

- 目录已建立
- 设计稿起草中
- 尚未开始正式实现

## 模块目标

这个模块负责承载 AionUi 的长期上下文引擎，而不是承载 UI、agent runtime 或 channel 本身。

它要解决的问题是：

- 一个 `Space` 下的上下文如何长期沉淀
- 文档、剪藏、消息、产物如何变成可检索、可演化的上下文对象
- agent 在执行时如何从空间中组装出 task-scoped context
- 本地优先的空间内容如何在未来支持多设备和多人协作

## 为什么先做成 monorepo 内独立 package

当前阶段不适合把记忆引擎直接做成单独服务，原因有三点：

1. 产品域模型还在成型中，过早拆服务会过早冻结协议。
2. 当前关键上下文天然在本机，local-first 是一等要求。
3. 这套能力需要贴着 `Space`、`Thread`、`Connector`、`Artifact` 等产品对象演进。

因此推荐策略是：

- 先放在产品仓库内
- 但从第一天开始就保持清晰边界
- 未来需要时可以迁移为 sidecar 或 remote service

## 模块职责

- 定义 context engine 的内部领域模型
- 管理 ingestion / indexing / retrieval / compaction / assembly 流程
- 定义本地存储、同步和冲突解决的基础协议
- 为主应用暴露稳定服务接口

## 非职责

- 不负责渲染 Space UI
- 不负责 channel runtime 编排
- 不负责 agent 执行本身
- 不负责 connector 身份认证

## 推荐边界

主产品负责：

- `Space`
- `Thread`
- `Mount`
- `ConnectorBinding`
- `Artifact`
- 用户交互与审批流

context engine 负责：

- `DocumentSnapshot`
- `SourceRecord`
- `MemoryEntry`
- `ProfileSegment`
- `RetrievalPlan`
- `ContextPack`

## 第一阶段成功标准

- 形成稳定的 package 边界
- 形成 local-first 数据模型
- 形成多设备 / 多人协作的演进方向
- 能定义出最小可实现的 `IContextService`
