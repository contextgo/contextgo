# Implementation Phases

## Phase 0: Package Boundary

目标：

- 建立 `packages/context-engine`
- 固定模块职责
- 形成设计文档和术语表

交付物：

- package 边界
- 文档
- placeholder API

## Phase 1: Local-First Foundation

目标：

- 在本地落最小可用 context engine

范围：

- source ingestion
- document snapshot
- chunk index
- memory entry persistence
- basic retrieval

建议接口：

```ts
interface IContextService {
  ingestSource(input: IngestSourceInput): Promise<IngestSourceResult>;
  retrieve(input: RetrieveContextInput): Promise<RetrieveContextResult>;
  assemble(input: AssembleContextPackInput): Promise<ContextPack>;
}
```

## Phase 2: Memory And Profile

目标：

- 让引擎从“可搜”升级为“可沉淀”

范围：

- memory extraction
- memory lifecycle
- profile compaction
- artifact promotion

## Phase 3: Workerized Pipeline

目标：

- 把重计算从主进程中剥离

范围：

- parsing worker
- embedding worker
- compaction worker
- reindex worker

## Phase 4: Multi-Device Sync

目标：

- 同一用户多个设备共享一个 space

范围：

- replica metadata
- sync cursor
- op log upload / download
- conflict policy

## Phase 5: Shared Space Collaboration

目标：

- 一个 space 下支持多人协作

范围：

- actor model
- role / permission
- shared op stream
- document merge
- review / approval hooks

## 当前建议

当前最值得先做的是 Phase 1，不要直接跳到远端共享。

原因：

- 本地语义模型还没稳定
- ingestion / memory / context pack 的最小闭环还没打通
- 多人协作建立在稳定的本地对象模型之上
