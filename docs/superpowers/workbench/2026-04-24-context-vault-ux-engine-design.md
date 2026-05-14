# Context Vault UX And Engine Projection Design

日期：2026-04-24

## 摘要

Context Engine 已经具备三条上下文闭环：

- session 内回流：`Session Steward` 将当前执行状态压缩成 timeline、working context、checkpoint，并在后续 turn 重新挂载
- project 回流：`Project Curator` 将稳定结论提升到 project docs、Project Insights、AGENTS / skills / automation proposal
- space / connector 回流：`Space Curator` 与 connector digest 将跨项目模式、profile、外部 datasource 信号沉淀成 Space Context

下一阶段重点不是继续扩一个更复杂的 memory engine，而是把这些闭环投影成一个真正可读、可用、可审计、可继续工作的 **Context Vault**。

本文冻结 ContextGo 吸收 OpenViking 上下文管理经验后的 vault 产品与实现设计。

## 背景判断

本地 Obsidian demo vault 已经证明，单纯输出 `Home.md`、`Projects/`、`System/Context Engine/` 仍然不够。

用户真正需要的是：

1. 打开 vault 后知道当前该继续哪里
2. 能区分 source facts、working context、distilled context、governance evidence
3. 能看到 session / project / connector / space 的沉淀链路
4. 能判断 agent 为什么挂载这些上下文，而不是另一些上下文
5. 能审查首次 connector 导入、增量同步、失败项和 promotion 结果

OpenViking 提供了几个可吸收的结构性经验：

- context filesystem paradigm：memory、resource、skill 都有稳定路径
- L0 / L1 / L2：abstract、overview、detail 分层加载
- session archive：live messages 与 historical archive 分离，archive 有 summary 和 done / failed 状态
- schema memory：profile、preferences、entities、events、cases、patterns、tools、skills 分类型沉淀
- hierarchical retrieval trace：检索轨迹、目录搜索、入选 / 排除理由可观察
- resource lifecycle：parse、persist、semantic queue、summary、vectorize、watch 是一个显式生命周期

ContextGo 不应直接照搬 OpenViking 的 Context DB 定位。ContextGo 的产品边界仍然是：

```text
Space 是产品对象
Project 是执行与文档边界
Session 是任务连续性边界
Context Connector 是外部上下文入口
Context Engine 是治理内核
Vault 是人可读、agent 可写、engine 可治理的 Space Context 投影
```

## 设计目标

### 目标

- 将 Context Engine 产物投影成稳定、可读、可导航的 Obsidian vault
- 给每类 context 建立 abstract / overview / detail 的阅读层次
- 将 session compaction 从“单次 checkpoint”升级为“可归档的 session lifecycle”
- 将 Space Memory 从大文件升级为 schema memory index
- 将 connector ingest 从 digest-only 升级为可审计 import lifecycle
- 将 retrieval / assembly trace 从 debug 信息升级为用户可检查的治理证据

### 非目标

- 不把 ContextGo 重构成 OpenViking 式独立 Context DB
- 不引入第二套与 `retrieve -> assemble -> ContextPack` 平行的 assembly 系统
- 不把 Obsidian vault 作为唯一 source of truth；vault 是 Space Context 的可读投影与 local-first surface
- 不把 IM bot channel 误称为 connector
- 不直接复制 OpenViking 的 AGPL 实现代码

## 核心原则

### 1. 每个 context surface 都有三层

ContextGo 不需要在 Obsidian 中为每个对象都生成 `.abstract.md` / `.overview.md` 隐藏文件，但每个主要文档都必须有等价三层：

```text
Abstract：一句话说明这个 context 是什么
Overview：结构化说明当前状态、关键结论、下一步
Detail：详细内容、证据、历史、trace、原始来源链接
```

推荐 Markdown section：

```md
## Abstract

## Overview

## Continue / Next Action

## Detail

## Related Context

## Provenance
```

### 2. 人读入口和系统证据分离

高优先级人读入口：

- `Home.md`
- `Space Console.md`
- project 主文档
- `Project Insights.md`
- session 主文档
- `working-context.md`
- `Space Memory.md`

低优先级系统证据：

- `timeline.md`
- `checkpoints/*`
- `archives/*`
- `Runs/*`
- `Operations/*`
- `Imports/*`

系统证据必须保留并可追踪，但不能污染默认阅读路径。

### 3. Session 是工作流，不是单个文件

Session 的人读页面和 engine 工作态必须分开：

```text
Projects/<project>/Sessions/<thread>.md
Projects/<project>/_context/sessions/<thread>/working-context.md
Projects/<project>/_context/sessions/<thread>/timeline.md
Projects/<project>/_context/sessions/<thread>/checkpoints/
Projects/<project>/_context/sessions/<thread>/archives/
```

其中：

- session 主文档回答“这轮工作现在在哪”
- `working-context.md` 回答“下一轮执行应该挂载什么”
- `timeline.md` 保留 append-only 事件流
- `checkpoints/*` 保留 compaction / assembly / promotion 证据
- `archives/*` 保存已压缩历史段落与抽取结果

### 4. Space Memory 是索引，不是垃圾桶

`Space Memory.md` 和 `Profile Memory.md` 不应持续膨胀成全量事实文件。它们应该成为 schema memory 的 summary 和 index。

长期记忆应拆为：

```text
System/Context Engine/Memory/
  Profile/
  Preferences/
  Decisions/
  Workflows/
  Patterns/
  Tools/
  Skills/
```

### 5. Connector import 是一等生命周期

Connector 不只产生 digest。每次导入都应该有可审计生命周期：

```text
bind / initialize
  -> full import or scoped import
  -> source snapshots
  -> abstract / overview
  -> chunks / index
  -> connector digest
  -> memory candidates
  -> project / space promotion
  -> cursor checkpoint
```

### 6. Trace 是产品能力

Retrieval trace 和 assembly trace 不是临时 debug log，而是 Context Engine 可解释性的核心证据。

每个重要 context run 应回答：

- 触发来自哪里
- 检索了哪些 scope
- 选中了哪些 memory / source / profile / working context
- 排除了哪些候选，为什么
- token budget 如何花费
- 产物写到了哪里

## 目标 Vault 结构

```text
<space-vault>/
  Home.md
  Space Console.md

  Canvas/
    Space Overview.canvas
    Review Board.canvas

  Projects/
    <project>/
      <project>.md
      Project Insights.md
      Project Graph.canvas
      Sources/
        AGENTS.md
        docs/...
      Sessions/
        <thread>.md
      _context/
        baseline.md
        Automation.md
        automation/
          skills/
          hooks/
          commands/
          schedules/
        sessions/
          <thread>/
            working-context.md
            timeline.md
            checkpoints/
            archives/
        proposals/

  Sources/
    Connectors/
      <connector>/
        Import Overview.md
        import-runs/
        docs/
        raw/

  System/
    Context Engine/
      Space Memory.md
      Profile Memory.md
      Connector Digest.md
      Memory/
        Profile/
        Preferences/
        Decisions/
        Workflows/
        Patterns/
        Tools/
        Skills/
      Runs/
      Operations/
      Relations/
        relations.jsonl
      Imports/
        connector-import-index.md

    Agent Desk/
      Active Agents.md
      Decision Inbox.md
      Artifact Ledger.md

    Workbench/
      Context Flow Workbench.md
      Attention Queue.md
      Signal Matrix.md
      Handoff Bus.md

  Blueprints/
    Vault UX Contract.md
    Context Layer Rules.md
    Connector Import Contract.md
```

## 文档模板契约

### Home

目的：Space 首页，回答“我现在该从哪里开始”。

固定 section：

- `Abstract`
- `Continue Working`
- `Active Projects`
- `Durable Context`
- `Recent Context Jobs`
- `Open Console / Workbench`
- `Vault Map`

不应包含：

- 细粒度 operation log
- 大量 source docs 罗列
- 原始 connector 导入明细

### Space Console

目的：控制台，回答“agent / engine 现在做到哪了，什么需要我决策”。

固定 section：

- `Current Situation`
- `Agent Workstreams`
- `Pending Decisions`
- `Recent Artifacts`
- `Context Flow`
- `Recommended Navigation`

### Project 主文档

目的：项目档案，回答“这个项目现在怎么读”。

固定 section：

- `Abstract`
- `Review Snapshot`
- `Entry Points`
- `Current Sessions`
- `Project Baseline`
- `Project Insights`
- `Project Automation`
- `Source Docs`
- `Related Space Memory`
- `Provenance`

### Session 主文档

目的：人读 session 入口，回答“这轮工作现在在哪”。

固定 section：

- `Abstract`
- `Rolling Summary`
- `Current Goal`
- `Working Context`
- `Recent Timeline`
- `Checkpoints`
- `Archives`
- `Promotions`

### Working Context

目的：下一轮执行可挂载的 session 工作态。

固定 section：

- `Current Task`
- `Stable Strategies`
- `Failure Modes`
- `Pending Constraints`
- `Signals`
- `Mounted Inputs`
- `Compaction State`
- `Provenance`

### Context Run

目的：一次治理执行的证据页。

固定 section：

- `Trigger`
- `Identity`
- `Retrieval Trace`
- `Assembly Trace`
- `Outputs`
- `Omitted Candidates`
- `Follow-up Jobs`

### Connector Import Run

目的：一次 connector 导入 / 同步的证据页。

固定 section：

- `Import Mode`
- `Connector Scope`
- `Cursor Before / After`
- `Source Changes`
- `Generated Docs`
- `Digest Output`
- `Memory Candidates`
- `Promotion Outputs`
- `Failures / Skips`

## Connector Ingest Mode

Connector ingest 需要成为稳定协议：

```ts
type ConnectorIngestMode =
  | 'initial_full_import'
  | 'manual_import'
  | 'incremental_sync'
  | 'cursor_replay'
  | 'watch_refresh';
```

语义：

- `initial_full_import`：首次绑定后的范围内全量导入
- `manual_import`：用户手动选择来源或范围导入
- `incremental_sync`：基于 cursor / checkpoint 的常规增量
- `cursor_replay`：从某个历史 cursor 重放
- `watch_refresh`：监听或计划任务触发的刷新

每个 import run 至少记录：

- connector id
- source scope
- ingest mode
- cursor before / after
- created / updated / skipped / failed count
- generated source docs
- generated memory candidates
- promoted project / space artifacts

## Relations 设计

Vault 关系使用双轨：

1. 人读 Markdown links
2. 系统可重放 `relations.jsonl`

示例：

```json
{
  "from": "Projects/contextgo/_context/sessions/vault-review-0422/working-context.md",
  "to": "Projects/contextgo/Project Insights.md",
  "type": "promoted_to",
  "reason": "stable vault readability strategy",
  "createdAt": "2026-04-24T00:00:00.000Z"
}
```

建议关系类型：

- `derived_from`
- `promoted_to`
- `mounted_into`
- `summarizes`
- `supersedes`
- `evidence_for`
- `related_to`

## 实现逻辑设计

### 新增领域概念

建议在 main process 的 Context Engine / Space Vault 边界引入纯类型与 formatter，不直接放在 renderer：

```text
src/process/services/space/vaultProjection/
  types.ts
  contextLevels.ts
  relationManifest.ts
  connectorImportProjection.ts
  sessionArchiveProjection.ts
  schemaMemoryProjection.ts
```

目录需按项目 directory size rule 落地时再拆分，避免继续扩大 `src/process/services/space` 单目录复杂度。

核心类型草案：

```ts
type VaultContextLevel = 'abstract' | 'overview' | 'detail';

type VaultContextLayer = 'space' | 'project' | 'session' | 'source' | 'connector' | 'memory' | 'governance';

type VaultRelationType =
  | 'derived_from'
  | 'promoted_to'
  | 'mounted_into'
  | 'summarizes'
  | 'supersedes'
  | 'evidence_for'
  | 'related_to';

type VaultProjectionDocument = {
  relativePath: string;
  title: string;
  layer: VaultContextLayer;
  abstract: string;
  overview: string;
  detail?: string;
  related: readonly VaultRelation[];
  provenance: VaultProjectionProvenance;
};
```

### 现有服务改造点

当前锚点：

- `src/process/services/space/vaultLayout.ts`
- `src/process/services/space/SpaceVaultContextSyncService.ts`
- `src/process/services/context/ContextRuntimeService.ts`
- `src/process/services/context/ContextJobOrchestrator.ts`
- `src/process/services/context/jobs/*`

推荐改造方式：

1. 保留 `SpaceVaultContextSyncService` 作为 IO 编排服务
2. 将 Markdown 构造逻辑逐步抽到 projection formatter
3. 先新增 session archive 与 schema memory 的 path helper
4. 再扩展 connector digest job payload 支持 ingest mode / cursor
5. 最后把 relations append 写入统一 manifest

### Phase 1：Vault UX Contract

实现内容：

- 更新 Home / Project / Session / Working Context 模板
- 新增 `Space Console.md`
- 为主要文档加入 `Abstract / Overview / Related Context / Provenance`
- 维持现有 path，不做大迁移

验收：

- 打开 vault 后 30 秒内能回答：当前继续哪个 session、哪个 project 活跃、哪些 durable context 可复用

### Phase 2：Session Archive Projection

实现内容：

- 新增 `archives/` path helper
- session compaction 时写入 archive overview / extraction / status
- checkpoint 链接 archive
- working context provenance 指向 archive

验收：

- session 的 live working context、timeline、checkpoints、archives 能分层阅读

### Phase 3：Schema Memory Projection

实现内容：

- 新增 `System/Context Engine/Memory/*`
- Space Memory / Profile Memory 变为 index + executive summary
- Space Curator distillation 输出可写入 schema memory 类型

验收：

- Space Memory 不再承担所有长期事实；稳定内容能按 profile / preference / decision / workflow / pattern 定位

### Phase 4：Connector Import Lifecycle

实现内容：

- 增加 connector ingest mode 类型
- connector digest run 写入 import run 页面
- 支持 initial full import / incremental sync / cursor replay 的 projection 字段
- Connector Digest 链接 source docs、memory candidates、promotion artifacts

验收：

- 首次导入与增量同步都能在 vault 中审查 scope、cursor、产物、失败项

### Phase 5：Trace Productization

实现内容：

- Context Run 页面固定展示 retrieval trace / assembly trace
- 记录 omitted candidates 和 token budget
- run artifact 链接到实际写入文档

验收：

- 用户能解释某次 agent execution 为什么挂载这些上下文

## 风险与约束

- `docs/superpowers/specs` 已经很拥挤，后续文档应避免继续扩大单目录
- Vault 结构扩展必须保持移动端 Obsidian 入口可用
- System 区必须可折叠、可绕开，不能把用户默认入口变成运行日志
- Connector terminology 必须保持 Context Connector 与 IM Bot Channel 分离
- OpenViking 代码不能直接复制，只吸收设计原则

## 下一步

1. 先落 Phase 1 formatter：Home、Space Console、Project、Session、Working Context
2. 再落 path helper：archives、schema memory、relations、connector imports
3. 再把 `SpaceVaultContextSyncService` 中的大块 Markdown builder 逐步迁移到 projection formatter
4. 最后补测试覆盖 path helper、formatter 输出和 connector ingest mode projection
