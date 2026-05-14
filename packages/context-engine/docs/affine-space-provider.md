# AFFiNE Space Provider Fit

## 状态

- 设计确认
- 尚未开始 provider 实现

## 目标

定义 ContextGo 的 `Space` 模型如何映射到 AFFiNE 的文档、白板和协作能力。

这个文档不讨论 AFFiNE 的 UI 是否嵌入，而讨论：

- 哪些对象应该由 AFFiNE 承载
- 哪些对象仍由 ContextGo 自己管理
- Candidate Memory 如何通往 `Doc` / `Board`

## 基本判断

AFFiNE 不是 ContextGo 的主产品壳。
AFFiNE 是第一个 `Space Provider`。

因此应该采用：

```text
ContextGo = orchestration shell + runtime + context governance
AFFiNE = document/canvas/collaboration provider
```

## 对象映射

## ContextGo 侧对象

这些对象仍然应该由 ContextGo 主导：

- `Space`
- `Thread`
- `Artifact`
- `SourceItem`
- `Memory`
- `MemoryCandidate`
- `ContextProfile`
- `ConnectorBinding`
- `Task / Automation`

## AFFiNE 侧对象

这些对象适合由 AFFiNE 承载：

- `Document`
- `Board / Edgeless Canvas`
- block-level content tree
- embedded attachments / embeds
- collaborative presence
- member permissions on content surfaces

## 映射原则

### 1. Space 不是 AFFiNE workspace ID 的别名

`Space` 是 ContextGo 的逻辑对象。
AFFiNE workspace 只是其底层 provider 表现之一。

因此应维护：

- `space.id`（ContextGo 主键）
- `providerRef.engine = affine`
- `providerRef.workspaceId = affineWorkspaceId`

### 2. Thread 不直接等于 Doc

Thread 是执行视图，不是内容表面。

因此：

- Thread 可以引用多个 Doc / Board
- Thread 可以从选定的 Doc / Board 区域组装 context pack
- Thread 的结果可以回写到 Doc / Board

### 3. Candidate Memory 不默认写入 Memory

对 AFFiNE 模式而言，Candidate 可能有三种去向：

- `memory`：进入长期事实/经验记忆
- `document`：提升为结构化文档片段
- `board`：提升为画布节点或分组

这也是为什么 Candidate 模型中已经加入：

- `destination = memory | document | board`

## 推荐 Provider 接口

ContextGo 内部应提供 provider-agnostic 接口，例如：

- `listDocuments(spaceId)`
- `getDocument(spaceId, documentId)`
- `createDocument(spaceId, title, content)`
- `appendDocumentBlock(spaceId, documentId, block)`
- `listBoards(spaceId)`
- `createBoard(spaceId, title)`
- `addBoardCard(spaceId, boardId, card)`
- `linkArtifactToBoard(spaceId, boardId, artifactId)`
- `promoteCandidateToDocument(spaceId, candidateId, documentId?)`
- `promoteCandidateToBoard(spaceId, candidateId, boardId?)`

第一阶段不需要把接口暴露成对外 SDK。
但内部一定要按 provider-agnostic 设计。

## Candidate 到 Doc 的路径

### 场景

- Agent 输出了一段高价值总结
- promotion policy 认为不适合直接当正式记忆
- 用户希望它进入知识文档

### 路径

```text
Assistant Output
  → MemoryCandidate(destination=document)
  → Human Approves
  → AFFiNE Document block append / create doc
  → Candidate state = approved
  → keep source lineage back to thread/source/artifact
```

### 适合内容

- 会议纪要
- 项目决策说明
- SOP 草稿
- 周报/复盘草稿
- 研究总结

## Candidate 到 Board 的路径

### 场景

- 用户在空间画布里组织多个来源
- 某候选更适合作为关系卡片或视觉节点

### 路径

```text
Assistant Output / Source Extraction
  → MemoryCandidate(destination=board)
  → Human Approves
  → AFFiNE Canvas card / note / embed created
  → Candidate state = approved
```

### 适合内容

- 计划节点
- 问题卡片
- 假设卡片
- 决策分支
- 证据聚合卡片

## 为什么这很关键

如果没有这条路径，ContextGo 最终会退化成：

- 只会把重要信息塞回 memory store
- 而不会把它沉淀成可协作、可展示、可编辑的知识对象

这会错过 AFFiNE 最重要的价值：

- 文档表面
- 无限画布表面
- 多人实时协作

## Canvas 在 provider 层的定位

在 ContextGo 中，Canvas 不只是内容表面。
它是：

- 候选记忆审批表面
- 上下文选区表面
- 人机共同整理关系的表面

因此 provider 层至少需要支持：

- 创建节点
- 更新节点元数据
- 选区读取
- 节点与 artifact/source/thread 的软链接

## 与 context engine 的边界

Context engine 不负责：

- AFFiNE block tree 编辑器细节
- Canvas UI 渲染
- CRDT 冲突细节

Context engine 负责：

- 给出 candidate / memory / source / artifact 的结构化对象
- 提供 promotion 动作
- 提供 retrieval / lineage / profile 结果
- 决定哪些对象应该被提升到文档或白板

## 第一阶段可落的最小方案

### Phase 1

- 只把 AFFiNE 当内容容器
- 不做深度双向同步
- 支持：
  - 从 ContextGo 创建 Doc
  - 从 ContextGo 创建 Board
  - 把 Candidate 提升到 Doc 或 Board

### Phase 2

- 支持从 AFFiNE 选区发起 Agent 任务
- 选区自动组装 context pack

### Phase 3

- 支持画布节点与 Memory / Artifact / Source 的关系联动
- 支持多人在 Canvas 上审批 candidate

## 一句话结论

```text
AFFiNE 提供内容与协作表面，ContextGo 提供执行、记忆、治理与编排能力。
```
