# Obsidian + ContextGo Cloud 单人多设备整库同步设计

## 背景

`obsidian` 在产品语义上已经被定义为正式 connector，而不是一个零散插件：

- `connector` 独立仓库负责 `obsidian` connector runtime、插件、同步协议与本地执行面
- `contextgo/contextgo` 主仓负责 `Space`、Cloud、UI、多端行为和产品边界
- `apps/cloud` 是官方 Cloud control plane，负责云账号、设备、同步 API 与远程入口

当前已经存在的能力包括：

- 主仓已有 `obsidian-vault` 作为 `Space` provider 的本地 vault 打开与 bootstrap 能力
- `connector` 仓已有 `cgo obsidian runtime ...`、datasource sync、deep link 和 catalog readiness 骨架
- Cloud 已具备账号、设备绑定、远程控制面基础

但当前缺少的是：把 Obsidian 从“本地 vault 打开 + 半成品 connector runtime”推进到“通过 ContextGo Cloud 实现单人多设备整库同步”的完整产品方案。

## 目标

本设计面向以下明确范围：

- 同一 ContextGo 账号下的单人多设备同步
- 以 `Space` 为同步边界
- 同步对象是 `Space` 对应的整份 Obsidian vault，而不是只同步 Context Engine 投影产物
- 桌面端和手机端都持有本地完整 vault 副本，并可写
- 手机既可以通过远程 WebUI 操作产品，也可以直接唤起 Obsidian 手机端编辑本地 vault
- `ContextGo Cloud` 负责同步编排，但不是唯一文件权威
- 默认自动合并/覆盖，尽量少打扰用户
- 检测第三方同步风险，但不把与第三方同步的共存当作正式支持目标

## 非目标

以下内容不进入本次设计的第一阶段：

- 多人协作同步
- 复杂 CRDT
- 精细交互式冲突解决
- 与 Obsidian Sync / iCloud / Dropbox / Syncthing 的正式兼容认证
- 把 `ContextGo Cloud` 做成唯一中心文件系统
- 把手机仅视为远程只读控制端

## 核心决策

### 1. 采用 Cloud 编排 + 设备副本模型

不同于“Cloud 中央镜像仓”模型，本设计采用：

- 每个桌面端和手机端都持有本地完整 vault 副本
- `ContextGo Cloud` 不托管唯一那份 vault 文件系统
- `ContextGo Cloud` 负责副本注册、变更批次、同步 cursor、checkpoint、风险与健康状态编排

因此同步主语是：

```text
Space
  -> Obsidian Vault Binding
    -> 多个 Replica
      -> Desktop Replica / Mobile Replica
Cloud
  -> Sync Control Plane
```

### 2. 整份 vault 是产品同步对象

同步对象不是：

- 单纯的 markdown 文本集
- 单纯的 Context Engine 投影结果
- 单纯的 connector collect 输出

而是：

- `Space` 对应的整份 Obsidian vault

这意味着产品上应把 Obsidian vault 理解成：

- `Space` 的完整副本承载面
- connector 的同步执行对象
- 多设备间可路由、可恢复、可观察的同步对象

### 3. `.obsidian` 默认纳入同步

根据范围确认，本设计默认把 `.obsidian` 下绝大多数配置也纳入同步集，包括：

- 核心配置
- 主题与 snippets
- 插件目录与声明性插件配置
- `workspace.json` 等设备布局状态

但并不是盲目整目录复制。同步层内部仍然要按文件语义分类：

- `content`
- `attachment`
- `obsidian-config`
- `workspace-state`

缓存、日志、secret、锁文件、明显 host-local 的运行态文件仍然默认排除。

### 4. Cloud 负责同步编排，不负责成为唯一文件权威

`ContextGo Cloud` 在此设计中的地位是：

- 同步编排权威
- 副本状态权威
- cursor/checkpoint 权威
- 健康/风险/警告聚合权威

但不是：

- 唯一真实 vault 文件系统
- 唯一可写副本

### 5. 自动合并/覆盖优先，尽量少打扰用户

第一版采取保守但自动化的策略：

- `content`：先尝试自动合并，失败后 Cloud 最新 batch 覆盖
- `attachment`：最新版本覆盖
- `obsidian-config`：最新版本覆盖
- `workspace-state`：最新版本覆盖，并标记高漂移

这意味着第一版接受一个产品事实：

- 某些 `.obsidian` 布局状态会在多设备间互相覆盖

这不是 bug，而是“整库同步 + 少打扰用户”下的预期行为，需要在产品文案中表达清楚。

## 三端职责

### 桌面端

桌面端是完整 `vault replica`，职责包括：

- 持有本地完整 Obsidian vault
- 运行桌面 Obsidian 插件
- 监听本地变更
- 生成 push batch
- 拉取 Cloud batch
- 将变更应用到本地 vault
- 继续承担 ContextGo host / WebUI / connector runtime

### 手机端

手机端同样是完整 `vault replica`，职责包括：

- 持有手机 Obsidian 本地 vault
- 运行手机 Obsidian 插件
- 监听本地变更
- 生成 push batch
- 拉取并应用 Cloud batch
- 允许用户直接在 Obsidian 手机端编辑内容
- 允许用户通过远程 WebUI 操作产品

手机端不是只读远控端，也不应在长期模型里被降格为纯 WebView。

### ContextGo Cloud

Cloud 负责：

- 云账号与设备绑定
- replica 注册
- batch 接收与路由
- cursor/checkpoint 维护
- 风险/健康状态聚合
- 提供 sync API 给桌面插件与手机插件

Cloud 不负责：

- 成为唯一文件权威
- 取代本地 vault
- 直接执行本地插件逻辑

### 远程 WebUI

远程 WebUI 是：

- 控制面
- 状态面
- 可视化面

它负责：

- 展示绑定关系、设备、同步状态、风险、警告
- 允许用户进行产品侧操作

它不负责：

- 直接替代本地插件执行 sync
- 成为本地 vault 的唯一写入路径

## Cloud 一等对象

### 1. `vault_binding`

表示某个 `Space` 当前绑定的 Obsidian vault 同步面。

建议字段：

- `vault_binding_id`
- `space_id`
- `owner_user_id`
- `connector = obsidian`
- `default_landing_note`
- `sync_policy`
- `risk_level`
- `last_global_cursor`

### 2. `replica`

表示某台设备上的本地完整 vault 副本。

建议字段：

- `replica_id`
- `vault_binding_id`
- `device_id`
- `platform`
- `plugin_version`
- `local_vault_fingerprint`
- `last_push_cursor`
- `last_pull_cursor`
- `health_status`

### 3. `file_manifest`

表示某个 replica 当前看到的文件级索引摘要。

建议字段：

- `path`
- `file_class`
- `content_hash`
- `size`
- `mtime`
- `tombstone`
- `logical_revision`

### 4. `change_batch`

表示一次 push 的变更集合。

建议字段：

- `batch_id`
- `replica_id`
- `base_cursor`
- `entries[]`
- `blob_refs[]`
- `created_at`

### 5. `sync_checkpoint`

表示 Cloud 为每个 replica 保存的同步断点。

建议字段：

- `replica_id`
- `applied_cursor`
- `pending_from_cursor`
- `last_success_at`
- `last_error`
- `drift_flags`

## 同步对象边界

### 同步分类

#### `content`

包括：

- `*.md`
- `*.canvas`
- 正文类 sidecar 文件

策略：

- 优先自动合并
- 合并失败则采用 Cloud 最新 batch 覆盖

#### `attachment`

包括：

- 图片
- 音频
- PDF
- 其他资源文件

策略：

- 以内容 hash 判断变化
- 不做复杂 merge
- 最新版本覆盖

#### `obsidian-config`

包括：

- `.obsidian/app.json`
- `.obsidian/appearance.json`
- `.obsidian/core-plugins.json`
- `.obsidian/hotkeys.json`
- `.obsidian/themes/`
- `.obsidian/snippets/`
- `.obsidian/plugins/<plugin-id>/` 下声明性配置文件

策略：

- 默认纳入同步
- 最新版本覆盖

#### `workspace-state`

包括：

- `.obsidian/workspace.json`
- 其他明显属于 pane/layout/view state 的文件

策略：

- 也纳入同步
- 标记 `high-drift`
- 最新版本覆盖

### 默认排除对象

默认排除：

- 缓存
- 日志
- 锁文件
- secret / credential 文件
- 明显 host-local 的运行态文件

## 同步流程

### 1. 本地监听

桌面插件和手机插件都监听本地 vault：

- 新增
- 修改
- 删除

并生成文件级 diff。

### 2. 组装 `change_batch`

插件把一次变更整理成 batch，至少包含：

- `replica_id`
- `base_cursor`
- 文件列表
- 文件分类
- 内容 hash
- 新 blob 引用或正文内容

同时落本地待发送队列，保证断网恢复。

### 3. Push 到 Cloud

插件将 batch 推送到 Cloud。

Cloud 执行：

- 校验 `vault_binding`
- 校验 `replica`
- 记录 batch
- 分配新的全局 cursor
- 更新 `sync_checkpoint`

### 4. Pull 并应用

其他 replica 定时或事件驱动拉取新 batch，并按文件分类应用到本地 vault，完成后回写 checkpoint。

### 5. 离线恢复

第一版必须支持：

- 离线编辑后补发 batch
- checkpoint 续传
- push/pull 重试
- batch 幂等
- 应用失败时标记 replica health

## 第三方同步共存策略

本设计不把与第三方同步器的共存作为正式支持目标，但允许用户同时存在这些系统：

- Obsidian Sync
- iCloud
- Dropbox
- Syncthing

策略：

- 检测到第三方同步痕迹时，不阻止同步
- 也不将 vault 自动切只读
- 但在 `vault_binding` 与 `replica` 上标记：
  - `third_party_sync_detected`
  - `drift_suspected`
  - `high_churn_paths`

这样产品可以提示风险，但不需要第一版就承诺正式兼容。

## 主仓产品接线

### Space 里的正式对象

主仓应将下面关系正式产品化：

```text
Space
  -> Obsidian Vault Binding
    -> 多个 Replica
      -> desktop / mobile
```

### UI 应提供的能力

应至少展示：

- 当前 Space 是否绑定 Obsidian
- 绑定的是哪份 vault
- 当前账号下有哪些 replica
- 每个 replica 的平台、最近同步时间、状态
- 是否检测到第三方同步风险
- 当前整体 sync 是否健康

### Remote access 与 sync 的分层

产品上必须明确区分：

- `Remote access`
  - 能不能远程连到设备 host
- `Vault sync`
  - 这份 Space 对应的 Obsidian vault 是否在多设备间同步健康

不能再把“能远程打开桌面”误表达成“已经完成 vault 同步”。

## 职责拆分

### `connector` 仓

负责：

- Obsidian connector runtime
- 官方 `ContextGo for Obsidian` 插件
- vault watcher
- push/pull executor
- plugin install / detect
- deep link
- 本地风险信号上报

### `apps/cloud`

负责：

- `vault_binding`
- `replica`
- `file_manifest`
- `change_batch`
- `sync_checkpoint`
- push/pull API
- cursor 分配
- 风险/健康聚合

### `contextgo/contextgo`

负责：

- `Space -> vault_binding -> connector` 产品关系
- sync status UI
- Cloud / device / replica 视图
- remote access vs sync 的产品文案分层
- 风险提示、健康提示、状态解释

## 第一版落地顺序

### Phase 1：connector 执行面固定

在 `connector` 仓固定：

- runtime config schema
- 官方插件工程
- batch 构建格式
- push/pull 执行链路

### Phase 2：Cloud 编排面落地

在 `apps/cloud` 落地：

- replica 注册
- batch 上传/下载
- global cursor
- checkpoint
- 基础自动覆盖策略

### Phase 3：主仓产品接线

在主仓落地：

- Space / Vault Binding 产品接线
- Connector 页面与 Space 页面状态面
- 设备与 replica 视图
- 风险提示与同步健康展示

## MVP 验收标准

第一版最小闭环应满足：

- 同一 ContextGo 账号下，两台桌面设备和一台手机设备可绑定同一个 Space
- 每个设备都持有本地完整 vault
- 任一设备的 Obsidian 本地改动可 push 到 Cloud
- 其他设备可 pull 并应用
- Cloud 能记录 replica / batch / cursor / checkpoint
- 主仓 UI 能展示：
  - 当前是否已绑定 vault
  - 有多少 replica
  - 最近一次同步时间
  - 当前 sync 健康状态
  - 是否检测到第三方同步风险

## 参考与依赖

上游相关 issue：

- `contextgo/connector#1`：推进 Obsidian Connector：补齐官方插件驱动的 Vault 同步协议与多设备同步链路
- `contextgo/contextgo#159`：对接 Obsidian Connector：补齐 Space / Cloud / UI 侧的 Vault 同步产品接线

相关文档：

- `docs/tech/space-model.md`
- `docs/tech/mobile-remote-control.md`
- `packages/context-engine/docs/local-first-sync.md`
- `apps/cloud/README.md`
- `connector/connect/obsidian.md`

## 结论

本设计将 Obsidian 定义为：

- 一个正式 connector
- 一个以整份 vault 为同步对象的多设备副本系统
- 一个由 `ContextGo Cloud` 负责编排、由桌面与手机本地插件负责执行的同步模型

在这个模型中：

- Cloud 不是唯一文件权威
- 手机不是只读远控端
- `.obsidian` 默认纳入同步
- 自动覆盖优先于复杂交互式冲突处理
- 第三方同步共存只做风险提示，不做正式兼容承诺

## 当前 MVP Checkpoint

截至当前设计落地阶段，已完成的最小实现包括：

- `apps/cloud`
  - `POST /api/obsidian-sync/replicas/register`
  - `POST /api/obsidian-sync/batches/push`
  - `POST /api/obsidian-sync/batches/pull`
  - `GET /api/obsidian-sync/spaces/{space_id}`
- `connector` 仓
  - `obsidian` runtime summary 已暴露 `sync_endpoint`
  - `replica_id` 已进入 runtime summary 输出
  - `buildObsidianChangeBatch(...)` 已作为最小 batch builder 存在
  - 官方插件 scaffold 已落在 `plugins/obsidian-contextgo/`
- 主仓
  - Cloud 类型与 bridge 已补 `CloudObsidianVaultBinding` / `CloudObsidianReplica`
  - `CloudService` 已可按 `spaceId` 拉取 Obsidian sync status
  - `CloudSyncSection` 已接入最小 `ObsidianSyncPanel`

当前仍未完成的部分包括：

- 真正的 Obsidian 本地 watcher / push / pull 执行器
- 手机端插件工程的实际可运行实现
- frontmatter 元信息写回
- 自动 merge 策略的真实实现
- 更完整的 sync health / last sync / drift 呈现
