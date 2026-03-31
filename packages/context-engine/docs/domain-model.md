# Context Engine Domain Model

## 核心层次

推荐把这套系统分成四层：

```text
Space
  -> Thread / Source / Artifact
    -> Document / Chunk / Memory / Profile
      -> Context Pack
```

## 顶层产品对象

### Space

逻辑上下文边界。

职责：

- 作为长期上下文归属容器
- 隔离检索和权限边界
- 决定默认 context pack 的候选范围

### Thread

空间内一次执行视图。

职责：

- 记录任务导向的对话与执行过程
- 引用本次执行选择的上下文对象
- 关联当前 mount 和运行参数

### Mount

设备本地执行挂载点。

职责：

- 提供物理工作目录
- 暴露本地文件系统资源
- 不能作为 `Space` 身份本体

### SourceItem

进入空间的标准化外部上下文对象。

例子：

- 网页剪藏
- 飞书文档镜像
- Notion 页面快照
- 远程消息流快照

### Artifact

执行生成的一等产物。

例子：

- 报告
- PPT
- 图表
- 代码 patch 摘要
- 提炼后的 SOP

## 引擎内部对象

### DocumentSnapshot

已归档的稳定文档快照，用于检索和回溯。

### Chunk

文档或来源被切分后的最小检索单元。

### MemoryEntry

高价值语义单元，不等于 chunk。

它更接近：

- 用户偏好
- 项目约束
- 角色设定
- 长期事实
- 已确认决策

### ProfileSegment

从多条 memory compaction 出来的高层画像片段。

例子：

- 用户写作偏好
- 项目执行规则
- 团队的默认审批约束

### ContextPack

一次执行真正发送给 agent 的上下文载荷。

它应由以下内容组合而成：

- 当前 thread 状态
- 相关 source items
- 相关 artifacts
- retrieval 命中的 memory
- profile summary
- runtime mount 信息

## 关键建模原则

### 1. `MemoryEntry` 不等于聊天消息

消息是原始轨迹，memory 是被抽取、压缩和确认后的状态对象。

### 2. `ProfileSegment` 不等于配置

配置是显式规则，profile 是从长期行为和稳定事实中总结出来的高层语义。

### 3. `ContextPack` 不等于历史拼接

它应该是经过筛选、压缩、排序和裁剪后的结果，而不是简单把历史消息拼起来。

### 4. `Space` 仍然高于记忆引擎

引擎服务于 `Space`，不反向定义 `Space`。
