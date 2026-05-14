# `@contextgo/context-engine`

`@contextgo/context-engine` 是 AionUi / ContextGo 内部的独立上下文引擎模块骨架。

当前阶段它还不是完整实现，但已经从“纯设计骨架”推进到“可执行原型”：包含策略纯函数、`IContextService` 契约，以及一个面向测试与后续接线的参考实现。

## 定位

- 在产品内实现，不先拆成外部服务
- 在架构上独立，不把上下文能力散落到 conversation / channel / connector 代码中
- 以 `Space` 为产品级边界，以 memory engine 为底层能力子系统
- 优先支持单机 local-first，再逐步演进到多设备与多人协作

## 当前内容

- package 边界与入口
- 面向 local-first 与协作演进的设计文档
- `source / document / memory / profile / context pack` 的领域对象
- `promotion / compaction / forgetting` 的一版策略契约与纯函数
- `IContextService` 与底层存储、op-log 的接口草案
- `ContextEngineService` 参考实现
- 内存态 stores，方便在主产品接线前先验证策略与装配逻辑
- 分层记忆模型（working / experiential / factual / source）
- 可插拔向量索引接口（本地内存 / Qdrant 适配层骨架）
- 文本文档 chunk 生成与索引入口
- Supermemory 适配性评估与 `Space Foundation` 分阶段规划

## 文档索引

- [context-engine-architecture-report.html](./context-engine-architecture-report.html)
- [docs/charter.md](./docs/charter.md)
- [docs/domain-model.md](./docs/domain-model.md)
- [docs/local-first-sync.md](./docs/local-first-sync.md)
- [docs/implementation-phases.md](./docs/implementation-phases.md)
- [docs/phase-0-1-foundation.md](./docs/phase-0-1-foundation.md)
- [docs/supermemory-context-os-fit.md](./docs/supermemory-context-os-fit.md)
- [docs/reference-landscape.md](./docs/reference-landscape.md)

## 设计原则

- 产品域对象由主产品定义，不由记忆引擎反向定义
- 引擎能力通过稳定接口暴露，例如 `ingest`, `retrieve`, `assemble`, `sync`
- 运行形态先内嵌，边界按可抽离方式设计
- 本地优先，云端同步是增量能力，不是前置依赖

## 向量索引接入

当前主进程默认通过 `src/process/services/context/vector/VectorProviderFactory.ts` 装配向量索引。

支持：

- `CONTEXTGO_VECTOR_PROVIDER=memory`：使用内存向量索引（开发 / 测试）
- `CONTEXTGO_VECTOR_PROVIDER=qdrant`：使用 Qdrant + OpenAI-compatible embeddings

Qdrant 模式需要：

- `CONTEXTGO_QDRANT_URL`
- `CONTEXTGO_QDRANT_COLLECTION`
- `CONTEXTGO_QDRANT_API_KEY`（可选）
- `CONTEXTGO_EMBEDDING_URL`
- `CONTEXTGO_EMBEDDING_API_KEY`
- `CONTEXTGO_EMBEDDING_MODEL`
- `CONTEXTGO_EMBEDDING_DIMENSIONS`（可选）

`ContextServiceImpl.indexTextDocument()` 会负责：

1. 创建 document snapshot
2. 生成 chunk records
3. 持久化 `context_chunks`
4. 写入向量索引
