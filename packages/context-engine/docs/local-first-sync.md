# Local-First And Sync Model

## 目标

这套引擎必须满足三个阶段：

1. 单机 local-first 可用
2. 单人多设备可同步
3. 一个 space 下的多人协作可同步

因此架构不能只为本地缓存设计，也不能一开始就强依赖中心化服务。

## 建议存储分层

### 1. Local metadata store

建议继续以 SQLite 为主，负责：

- spaces
- threads
- source metadata
- artifact metadata
- memory entries
- profile segments
- sync checkpoints

### 2. Local blob store

负责存放：

- 原始文档内容
- 导入文件
- 解析后的大文本
- 中间快照

### 3. Local search / vector index

负责：

- chunk 检索
- embedding index
- hybrid retrieval

初期可以是本地索引实现，后续可替换为 sidecar。

### 4. Operation log

这是未来多设备 / 多人协作的关键。

推荐不要只保存“最终状态”，还要保存可同步的变更记录：

- source ingested
- artifact promoted
- memory accepted
- profile compacted
- document updated

## 为什么需要 op log

如果只存最终表状态，未来同步会非常痛苦：

- 无法精确合并
- 无法断点续传
- 无法做冲突处理
- 无法进行审计和回放

因此建议设计成：

- 本地状态表
- 加上一份 append-only operation log

## 多设备同步建议

### 初期

- 同一用户多个设备之间，同步 space 级内容
- mount 和本机路径不参与全局同步
- 使用 per-space sync cursor

### 中期

- 引入 replica 概念
- 每个设备维护自己的 replica metadata
- 支持离线修改再同步

### 后期

- 引入真正的协同合并模型
- 文档类对象走 CRDT 或等价变更模型
- memory / profile 类对象走语义级 merge 规则

## 多人协作建议

多人协作不应该从“共享整个本机数据库”开始，而应该从“共享同一个 space 的操作流”开始。

建议：

- 权限边界绑定 `space`
- 用户身份绑定 actor
- 同步协议按 actor + replica + op cursor 工作

## 明确不全局同步的内容

下面这些内容不应默认作为可共享空间状态：

- 本机绝对路径
- 本机 credentials
- 本机缓存文件
- 主进程运行态
- 临时 worker 状态
- host-specific 权限授权

## 结论

这个模块应采用：

- `local state + blob store + retrieval index + op log`

这样的基础结构。

这样既能支撑当前 local-first，又能为未来多设备和多人协作留出生长空间。
