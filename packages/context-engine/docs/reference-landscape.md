# Context Engine 参考地图

## 目的

这份文档把当前 `ContextGo` 上下文引擎最重要的三类参考源放到同一个入口：

- 研究综述：`Memory in the Age of AI Agents`（arXiv:2512.13564）
- 记忆 / 上下文引擎参考：`supermemory`
- 协同文档 / 画板 / local-first 产品参考：`AFFiNE`

它不替代现有设计稿，而是回答三个更直接的问题：

- 哪些外部参考最值得持续对照
- 它们分别对应 `ContextGo` 的哪一层
- 当前仓库里已经有哪些关联实现和设计文档

## 核心参考

### 1. 研究综述：Memory in the Age of AI Agents

论文：

- arXiv: <https://arxiv.org/abs/2512.13564>
- PDF: <https://arxiv.org/pdf/2512.13564>

版本信息：

- `v1`：2025-12-15
- `v2`：2026-01-13

这篇综述对本项目最有价值的地方，不是再一次强调“要做记忆”，而是给出了一个更适合工程实现的三维框架：

- `Forms`
  - token-level
  - parametric
  - latent
- `Functions`
  - factual
  - experiential
  - working
- `Dynamics`
  - formation
  - evolution
  - retrieval

对 `ContextGo` 的直接启发：

- 不再用“长/短期记忆”作为主分类，而是改用 `形式 × 功能 × 动态`
- 记忆不是聊天历史的被动堆积，而是从交互中主动形成候选、再进入生命周期管理
- 检索不是单纯 `RAG`，而是 `memory + profile + source + task pack` 的统一装配
- “稳定性 / 可塑性”冲突应该成为 compaction、forgetting、review 的核心设计约束

### 2. 引擎参考：Supermemory

参考仓库：

- `supermemory`

对 `ContextGo` 最重要的参考价值：

- 把记忆系统从普通文档检索中拆出来，单独作为 `context / memory engine`
- 用统一对象层表达 `document -> chunk -> memory -> profile -> retrieval`
- 把 connectors、profile、memory、search 放进一个统一上下文服务，而不是散落在各个 agent 内

对 `ContextGo` 的定位关系：

- `Supermemory` 更像 `memory engine / context service` 参考
- 它不等于 `Space` 本体
- 它适合指导 `Space` 之下的记忆分层、检索编排、生命周期治理

仓库内已有相关文档：

- [supermemory-context-os-fit.md](./supermemory-context-os-fit.md)
- [domain-model.md](./domain-model.md)
- [phase-0-1-foundation.md](./phase-0-1-foundation.md)

### 3. 产品表面参考：AFFiNE

参考仓库：

- `AFFiNE`

对 `ContextGo` 最重要的参考价值：

- local-first + realtime collaboration
- 文档、白板、嵌入内容、block/canvas 的统一工作表面
- 把空间内容组织、协同和表达能力做成独立 `space provider`

对 `ContextGo` 的定位关系：

- `AFFiNE` 适合作为第一个高能力 `Space Provider`
- 它提供文档、画板、协作表面
- 它不应该替代 `ContextGo` 的 agent runtime、上下文治理和执行编排

仓库内已有相关文档：

- [affine-space-provider.md](./affine-space-provider.md)
- [workbench-space-canvas-interaction.md](./workbench-space-canvas-interaction.md)
- [space-model.md](../../../docs/tech/space-model.md)
- [affine-integration-renderer.md](../../../docs/tech/affine-integration-renderer.md)
- [space-shell-mvp.md](../../../docs/tech/space-shell-mvp.md)

## 与当前实现的映射

### Forms：当前主要覆盖 token-level，部分覆盖 latent

当前 `ContextGo` 已经有较明确的 token-level 记忆对象：

- `SourceRecord`
- `DocumentSnapshot`
- `ChunkRecord`
- `MemoryEntry`
- `MemoryCandidateEntry`
- `ProfileSegment`
- `ContextPack`

对应代码和文档：

- [domain.ts](../src/domain.ts)
- [domain-model.md](./domain-model.md)

当前也已经有 latent memory 的基础设施：

- `VectorIndexProvider`
- 内存向量索引
- Qdrant 适配层

对应代码：

- [vectorIndex.ts](../src/vectorIndex.ts)
- [VectorProviderFactory.ts](../../../src/process/services/context/vector/VectorProviderFactory.ts)

当前尚未进入范围的：

- parametric memory
  - 例如模型编辑、LoRA 式持久内化
  - 这不是 `ContextGo` 当前阶段应优先推进的能力

### Functions：当前已经基本对齐 factual / experiential / working

论文的功能分类和当前对象模型是相容的：

- factual memory
  - 对应事实、偏好、约束、身份、决策等长期状态
- experiential memory
  - 对应 workflow、可复用策略、已验证做法
- working memory
  - 对应当前线程摘要、当前任务上下文、短期 chunk / context pack

当前仓库里的映射大致是：

- factual / experiential
  - `MemoryEntry`
  - `ProfileSegment`
  - `MemoryCandidateEntry`
- working
  - `working` tier chunk
  - thread summary
  - assembled `ContextPack`

对应代码：

- [domain.ts](../src/domain.ts)
- [ContextEngineService.ts](../src/ContextEngineService.ts)
- [ContextRuntimeService.ts](../../../src/process/services/context/ContextRuntimeService.ts)

### Dynamics：formation 和 retrieval 已经接线，evolution 还在补闭环

#### Formation

已经开始形成闭环：

- 用户消息 / 助手回复先落为 `SourceRecord`
- 文本进入 document snapshot 和 chunking
- 从对话内容抽取 `MemoryCandidateEntry`
- 候选再走 promotion / review 流程

对应代码：

- [ContextRuntimeService.ts](../../../src/process/services/context/ContextRuntimeService.ts)
- [ContextServiceImpl.ts](../../../src/process/services/context/ContextServiceImpl.ts)

#### Evolution

当前状态是“策略已明确，自动运行时还未完整闭环”：

- 已实现：
  - promotion scoring
  - human review
  - candidate approve / reject / promote to doc / board
- 已有策略层：
  - compaction
  - forgetting
- 尚未完整落地：
  - 周期性 compaction runtime
  - profile 自动生成 / 更新闭环
  - forgetting 执行器和审计闭环

对应代码：

- [promotion.ts](../src/promotion.ts)
- [compaction.ts](../src/compaction.ts)
- [forgetting.ts](../src/forgetting.ts)

#### Retrieval

当前已经是实装态：

- lexical + vector hybrid retrieval
- memory / source / profile / chunk 融合检索
- token budget 裁剪
- 组装为 `ContextPack`
- 注入到用户请求前

对应代码：

- [ContextEngineService.ts](../src/ContextEngineService.ts)
- [conversationBridge.ts](../../../src/process/bridge/conversationBridge.ts)

## 分层责任边界

把三类参考放在一起之后，项目边界应保持清晰：

- `ContextGo Space`
  - 产品级逻辑空间
  - 负责归属、隔离、线程、执行入口、治理边界
- `Context Engine`
  - `Space` 之下的记忆与上下文子系统
  - 负责 ingestion、memory、profile、retrieval、assembly
- `AFFiNE`
  - 第一个高能力内容 / 协作 provider
  - 负责 doc / board / canvas / collaborative surface
- `Supermemory`
  - 主要作为 memory engine 设计参考
  - 指导统一 ontology、profile、context API、connectors 思路

一句话总结：

`论文定义问题空间，Supermemory 提供引擎层参考，AFFiNE 提供产品表面参考。`

## 当前仓库里已经存在的关联

本项目并不是从零开始吸收这些参考，当前仓库已经有明显关联线索：

- `packages/context-engine/`
  - 已经形成 `source / document / chunk / memory / profile / context pack` 的对象模型
- `src/process/services/context/`
  - 已经接入 ingestion、chunking、candidate promotion、hybrid retrieval
- `src/renderer/pages/space/`
  - 已经开始把 candidate memory 与 `Doc / Board` 表面联动
- `docs/tech/space-model.md`
  - 已经明确 `Space` 与 `AFFiNE` 的角色区分
- `packages/context-engine/docs/supermemory-context-os-fit.md`
  - 已经明确 `Supermemory` 更适合作为 memory engine 参考，而不是 `Space` 本体

## 建议的后续阅读顺序

如果后续继续推进上下文引擎，建议按这个顺序读：

1. 这份文档
2. [domain-model.md](./domain-model.md)
3. [phase-0-1-foundation.md](./phase-0-1-foundation.md)
4. [supermemory-context-os-fit.md](./supermemory-context-os-fit.md)
5. [affine-space-provider.md](./affine-space-provider.md)
6. [space-model.md](../../../docs/tech/space-model.md)
7. [affine-integration-renderer.md](../../../docs/tech/affine-integration-renderer.md)

## 当前最值得推进的三件事

- 把 `Accepted Memories` 真正接到 `Space` 页，而不是只展示 candidate
- 把 `compaction / forgetting / profile refresh` 从策略函数推进到 runtime 闭环
- 把 `AFFiNE` 的 doc / board / selection surface 与 memory provenance 做更深联动
