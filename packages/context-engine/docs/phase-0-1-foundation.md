# Phase 0 And Phase 1 Foundation Plan

## 目标

把 `Space Foundation` 和第一批 `space-owned assets` 从方向性设计收敛成可实施清单。

本文档只回答三类问题：

1. Phase 0 / Phase 1 需要哪些最小接口
2. 这些接口分别对应哪些数据表或 sidecar 索引
3. 应按什么顺序迁移，才能减少和现有 `workspace` 心智模型的冲突

## 范围

### Phase 0: Space Foundation

必须解决：

- `Space` 作为逻辑归属边界正式落库
- conversation 在创建、读取、迁移时都能稳定拿到 `spaceId`
- `spaceId / mountId / workingDirectory` 的职责边界固定
- discussion group、history grouping、conversation tabs 改为优先按 `spaceId`

### Phase 1: Space-Owned Assets

必须解决：

- 第一批已经持久化的上下文资产开始归属到 `spaceId`
- 至少覆盖 `cron_jobs`
- 为 `preview history` 这类文件型资产补一个可查询的 space 归属索引

明确不在本阶段做：

- 完整 `Artifact` 表
- 完整 `SourceItem` / `ConnectorBinding` 表
- retrieval / memory / profile 引擎
- `Context Pack` 的正式装配实现

## 当前基线

截至 `2026-03-29`，当前评估分支基线如下：

- `src/process/services/database/schema.ts` 的 `CURRENT_DB_VERSION = 17`
- `conversations` 已存在，但 `spaceId` 还没有成为一等字段
- `cron_jobs` 已存在，是最容易切入的 Phase 1 资产表
- `preview history` 仍是文件系统索引，不是数据库表

这意味着：

- Phase 0 的核心是新增 `spaces` 表，并统一 `conversation.extra` 的兼容字段
- Phase 1 不能假装所有资产都已经在 SQLite 里，必须区分“表型资产”和“文件型资产”

## 字段语义固定

在实现前必须把三个字段的含义写死：

- `spaceId`
  - 逻辑上下文归属主键
  - 用于历史分组、资产归属、默认检索边界
- `mountId`
  - 当前设备上的本地挂载点引用
  - 用于把逻辑空间映射到本机资源
- `workingDirectory`
  - 一次具体运行真正使用的物理执行目录
  - 允许为空，也允许不同于 mount root

兼容策略：

- `extra.workspace` 继续保留为兼容字段
- 新逻辑统一以 `workingDirectory` 为语义正确字段
- 所有新代码应遵循：
  - read: `workingDirectory ?? workspace`
  - write: 同时写 `workingDirectory` 和兼容 `workspace`

## 建议接口

下面的接口是“足够落地，但不提前过度抽象”的最小集合。

### 1. `ISpaceRepository`

职责：

- 面向 SQLite 的 `spaces` 表读写
- 不处理 conversation 迁移逻辑
- 不处理 renderer/UI 决策

建议方法：

```ts
type ISpaceRepository = {
  insert(space: SpaceRecord): Promise<void>;
  update(spaceId: string, updates: Partial<SpaceRecord>): Promise<void>;
  getById(spaceId: string): Promise<SpaceRecord | null>;
  getDefaultSpace(userId: string): Promise<SpaceRecord | null>;
  listByUser(userId: string): Promise<SpaceRecord[]>;
  delete(spaceId: string): Promise<void>;
};
```

### 2. `ISpaceService`

职责：

- 创建 space
- 确保会话总能拿到逻辑归属
- 负责默认空间和 legacy conversation 的归一

建议方法：

```ts
type ISpaceService = {
  createSpace(input: CreateSpaceInput): Promise<SpaceRecord>;
  getSpace(spaceId: string): Promise<SpaceRecord | null>;
  listSpaces(userId: string): Promise<SpaceRecord[]>;
  ensureDefaultSpace(userId: string): Promise<SpaceRecord>;
  ensureConversationBinding(input: EnsureConversationSpaceInput): Promise<ConversationSpaceBinding>;
  resolveConversationBinding(conversation: ConversationLike): Promise<ConversationSpaceBinding>;
};
```

### 3. `ISpaceOwnershipService`

职责：

- 在 Phase 1 给已有资产补 `spaceId`
- 对文件型资产提供 sidecar 归属索引

建议方法：

```ts
type ISpaceOwnershipService = {
  assignCronJobToSpace(input: AssignCronJobSpaceInput): Promise<void>;
  listSpaceCronJobs(spaceId: string): Promise<string[]>;
  upsertPreviewSnapshotIndex(input: UpsertPreviewSnapshotSpaceInput): Promise<void>;
  resolvePreviewTargetSpace(target: PreviewTargetLike): Promise<string | null>;
};
```

### 4. `ISpaceMigrationService`

职责：

- 只处理 legacy data 补齐
- 不参与 runtime 业务逻辑

建议方法：

```ts
type ISpaceMigrationService = {
  backfillConversationSpaces(userId: string): Promise<BackfillConversationSpaceResult>;
  backfillCronJobSpaces(): Promise<BackfillCronJobSpaceResult>;
};
```

## 数据表与索引清单

## Phase 0 Required

### 1. `spaces`

类型：

- 新增 SQLite 表

职责：

- 定义逻辑空间
- 为 conversation 和后续资产提供统一归属主键

建议字段：

| 字段          | 类型                         | 说明                                                 |
| ------------- | ---------------------------- | ---------------------------------------------------- |
| `id`          | `TEXT PRIMARY KEY`           | space 主键                                           |
| `user_id`     | `TEXT NOT NULL`              | 当前单用户阶段也继续保留，避免后续多人协作回补       |
| `name`        | `TEXT NOT NULL`              | 展示名称                                             |
| `slug`        | `TEXT`                       | 可选稳定标识                                         |
| `description` | `TEXT`                       | 可选描述                                             |
| `kind`        | `TEXT NOT NULL`              | `personal` / `project` / `channel` / `temporary`     |
| `source`      | `TEXT NOT NULL`              | `manual` / `migration` / `channel-import` / `system` |
| `is_default`  | `INTEGER NOT NULL DEFAULT 0` | 默认空间标记                                         |
| `archived_at` | `INTEGER`                    | 归档时间                                             |
| `created_at`  | `INTEGER NOT NULL`           | 创建时间                                             |
| `updated_at`  | `INTEGER NOT NULL`           | 更新时间                                             |

建议索引：

- `idx_spaces_user_id`
- `idx_spaces_user_updated`
- `idx_spaces_user_default`
- `idx_spaces_slug`

### 2. `conversations`

类型：

- 复用现有表

Phase 0 处理方式：

- 不强制新增 `space_id` 列
- 先统一写入 `extra.spaceId`
- 同步规范 `extra.mountId` / `extra.workingDirectory`

这样做的原因：

- 当前 `conversations.extra` 已经承载大量 agent-specific 字段
- 在 `Space Foundation` 阶段先把语义贯通，比立即拆 JSON 更稳
- 真正需要高频按 `spaceId` 查库时，再评估是否补物化列或 companion table

建议统一字段：

| 字段               | 位置                  | 说明           |
| ------------------ | --------------------- | -------------- |
| `spaceId`          | `conversations.extra` | 逻辑空间归属   |
| `mountId`          | `conversations.extra` | 本机挂载点引用 |
| `workingDirectory` | `conversations.extra` | 真实运行目录   |
| `workspace`        | `conversations.extra` | 兼容旧逻辑     |

### 3. `conversation_space_bindings`

类型：

- Phase 0 不单独建表

理由：

- 现阶段只是 `conversation.extra` 的统一读写视图
- 如果未来需要跨表 join、稽核或历史回放，再拆成 companion table

当前建议：

- 在类型层保留 `ConversationSpaceBinding`
- 在 service 层由 `ISpaceService.resolveConversationBinding()` 暴露

## Phase 1 Required

### 4. `cron_jobs`

类型：

- 复用现有表，增加字段

建议新增字段：

| 字段       | 类型   | 说明         |
| ---------- | ------ | ------------ |
| `space_id` | `TEXT` | 逻辑空间归属 |

建议索引：

- `idx_cron_jobs_space_id`
- 保留现有 `idx_cron_jobs_conversation`

迁移策略：

- 先允许 `NULL`
- 根据 `conversation_id -> conversation.extra.spaceId` 做回填
- 回填完成且创建路径稳定后，再考虑是否升级为 `NOT NULL`

### 5. `preview_snapshot_index`

类型：

- 新增 SQLite sidecar 表

为什么要有这个表：

- `preview history` 当前实际内容存在文件系统
- 但没有 space 归属索引，就无法做按 space 管理和清理
- 继续只靠 `PreviewHistoryTarget.workspace` 会把逻辑空间和工作目录混在一起

建议字段：

| 字段              | 类型               | 说明                            |
| ----------------- | ------------------ | ------------------------------- |
| `snapshot_id`     | `TEXT PRIMARY KEY` | 快照 ID                         |
| `space_id`        | `TEXT`             | 逻辑空间归属                    |
| `conversation_id` | `TEXT`             | 来源会话                        |
| `content_type`    | `TEXT NOT NULL`    | 预览类型                        |
| `file_name`       | `TEXT`             | 文件名                          |
| `file_path`       | `TEXT`             | 原文件路径                      |
| `storage_path`    | `TEXT NOT NULL`    | 在 preview-history 下的相对路径 |
| `identity_hash`   | `TEXT NOT NULL`    | 目标 identity 摘要              |
| `created_at`      | `INTEGER NOT NULL` | 创建时间                        |
| `updated_at`      | `INTEGER NOT NULL` | 更新时间                        |

建议索引：

- `idx_preview_snapshot_index_space_id`
- `idx_preview_snapshot_index_conversation_id`
- `idx_preview_snapshot_index_identity_hash`

注意：

- 这个表只管索引，不取代文件内容
- `PreviewHistoryService` 仍可继续写磁盘
- Phase 1 只是在写磁盘时同步写一份 `space` 归属索引

## Phase 1 Deferred

下面这些对象应该在 `space-owned-assets` 的后续子阶段做，不要混进最小可合并范围：

- `artifacts`
- `source_items`
- `connector_bindings`
- `space_mounts`
- `context_packs`

原因：

- 当前仓库里它们还没有稳定的数据模型
- 一次性全建表只会把评估分支拖成二次设计泥潭

## 迁移顺序

### Step 1. 新增 `spaces` 表

目标：

- 不动现有 conversation 创建链路
- 先让数据库里存在逻辑空间容器

### Step 2. 增加 `ISpaceRepository` / `ISpaceService`

目标：

- 让主进程有一个统一入口来生成和查询 default space
- 避免每个调用方自己拼 legacy fallback

### Step 3. conversation 创建链路统一写入 binding

需要改动的重点路径：

- `initAgent`
- `ConversationServiceImpl`
- discussion group 子会话创建
- external session import
- channel ingress conversation create

统一规则：

- 新建 conversation 永远带 `spaceId`
- `mountId` 可空
- `workingDirectory` 可空
- `workspace` 继续兼容镜像

### Step 4. 老 conversation 回填 `spaceId`

建议回填策略：

- 若 conversation 已有显式 `spaceId`，保持不动
- 若无 `spaceId` 且有稳定来源上下文，按来源分配
- 其他情况统一落到用户 default space

### Step 5. `cron_jobs` 增加 `space_id`

目标：

- 让第一个真正持久化的非 conversation 资产进入 `Space`

回填来源：

- `cron_jobs.conversation_id`
- `conversation.extra.spaceId`

### Step 6. preview history 增加 sidecar 索引

目标：

- 不重写文件存储实现
- 先让 preview snapshot 能按 `spaceId` 检索、清理和统计

## 推荐文件落点

按当前仓库结构，真正实现时不要再把新 service 平铺到 `src/process/services/` 根目录。

原因：

- `src/process/services/` 现在已经超过 10 个直接子项
- `space` 相关逻辑本身会同时包含 service、repository adapter、migration helper
- 单独建目录更符合仓库的复杂服务拆分规则

建议落点：

```text
src/process/services/space/
  ISpaceService.ts
  SpaceService.ts
  ISpaceOwnershipService.ts
  SpaceOwnershipService.ts
  ISpaceMigrationService.ts
  SpaceMigrationService.ts
  types.ts

src/process/services/database/
  ISpaceRepository.ts
  SqliteSpaceRepository.ts
  schema.ts
  migrations.ts

src/common/config/
  storage.ts

src/common/types/
  preview.ts

src/process/services/preview/
  PreviewSnapshotIndexRepository.ts
```

其中职责建议是：

- `src/process/services/space/`
  - 编排业务语义
  - 处理默认空间、binding 归一、回填策略
- `src/process/services/database/`
  - 只处理 SQLite 表读写
- `src/common/config/storage.ts`
  - 固定 `conversation.extra` 的兼容字段 contract
- `src/common/types/preview.ts`
  - 补 `spaceId` / `workingDirectory` 相关 target 语义
- `src/process/services/preview/`
  - 处理 preview 的 sidecar 索引，不污染现有文件存储 service

## 可实施的 TypeScript 合同

下面这些类型足够支撑 Phase 0 / Phase 1，不会提前把后面 Phase 2+ 的 memory engine 锁死。

```ts
type SpaceRecord = {
  id: string;
  userId: string;
  name: string;
  slug?: string;
  description?: string;
  kind: 'personal' | 'project' | 'channel' | 'temporary';
  source: 'manual' | 'migration' | 'channel-import' | 'system';
  isDefault: boolean;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
};

type ConversationSpaceBinding = {
  conversationId: string;
  spaceId: string;
  mountId?: string;
  workingDirectory?: string;
  legacyWorkspace?: string;
};
```

## 完成标准

Phase 0 完成标准：

- `spaces` 表正式存在
- 默认空间可创建、可查询
- 新建 conversation 全部具备 `spaceId`
- discussion group 和 external session import 不再丢失逻辑空间归属
- history grouping 可以优先按 `spaceId`

Phase 1 完成标准：

- `cron_jobs` 具备 `space_id`
- preview history 具备可查询的 `space` 归属索引
- 资产清理和统计可以按 `spaceId` 进行

## 实现建议

真正开始编码时，建议优先顺序是：

1. 先做 `spaces` 表 + `ISpaceService`
2. 再把 conversation create/import 路径统一到 `ConversationSpaceBinding`
3. 再做 `cron_jobs.space_id`
4. 最后补 `preview_snapshot_index`

这样可以先稳住主路径，再处理文件型 sidecar 资产。
