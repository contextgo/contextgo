# Workbench → Space → Canvas Interaction Model

## 状态

- 方向确认
- 用于约束后续前端与 context engine 接入

## 目标

定义 ContextGo 在产品层的主交互壳，明确三件事：

1. 为什么产品主入口仍然应该是 Agent Workbench
2. 用户如何通过 Space 进入长期上下文与协作表面
3. 为什么 Infinite Canvas / Edgeless Board 是最重要的上下文编排界面

## 核心判断

### 1. Agent Workbench 仍然是主入口

ContextGo 的主产品价值仍然是：

- 多 Agent 编排
- 本地执行与自动化
- 远程渠道发布
- 人机协作式任务执行

因此，默认首页不应该直接跳转到“笔记页”或“白板页”。
默认首页仍然应该是：

```text
Agent Workbench
```

Workbench 是执行入口。
Space 是长期认知容器。
Canvas 是上下文编排界面。

这三者不能混为一个页面概念，但也不能分裂成彼此无关的产品。

### 2. Space 不是附属设置，而是顶层导航对象

用户进入 ContextGo 后，首先面对的应该是“当前在哪个 Space 中工作”。
因此顶部用户卡片必须承担 `Space Switcher` 的角色。

用户的心智模型应当从：

```text
我在一个会话里和 Agent 聊天
```

转向：

```text
我在一个 Space 中工作，Agent 只是这个 Space 的执行者之一
```

### 3. Infinite Canvas 不是展示层，而是上下文操作层

Docs 更适合沉淀稳定知识。
Threads 更适合执行过程。
Canvas 最适合：

- 组织复杂关系
- 选择任务上下文子集
- 在多人协作中讨论和确认候选记忆
- 用空间方式展示来源、产物、计划和结论之间的关系

因此，Canvas 不应该被当作“好看的白板”。
它应该成为：

```text
Human + Agent 共用的上下文编排界面
```

## 一级产品结构

建议产品壳采用双层结构：

### 顶层

- `Workbench`
- `Space`
- `Connectors`
- `Publishing`
- `Settings`

### Space 内二级导航

- `Overview`
- `Docs`
- `Canvas`
- `Database`
- `Threads`
- `Artifacts`
- `Context`
- `Members`

其中：

- `Workbench` = 执行入口
- `Space` = 长期协作与知识入口
- `Context` = 上下文治理入口

## 主交互路径

## Path A：用户从 Agent Workbench 开始

```text
打开应用
  → 进入 Workbench
  → 从用户卡片切换当前 Space
  → 选择已有 Thread 或创建新 Thread
  → 让 Agent 执行任务
  → Agent 从当前 Space 检索 task-scoped context pack
  → 执行结果落入 Artifact / Candidate Memory / Document Draft
```

这个路径服务于：

- 工程任务
- 自动化任务
- IM 渠道任务
- 临时执行任务

## Path B：用户从 Space 开始

```text
打开应用
  → 用户卡片选择目标 Space
  → 进入 Space Overview
  → 浏览 Docs / Canvas / Database / Artifacts
  → 选择内容后触发 Ask Agent with Selection
  → 当前选区被组装为最小上下文包
  → Agent 在 Workbench 或侧边面板中执行
```

这个路径服务于：

- 知识整理
- 研究工作流
- 团队协作
- 规划与复盘

## 顶部用户卡片设计

用户卡片需要承担以下功能：

- 显示当前用户
- 显示当前 Space
- 快速切换 Space
- 创建新 Space
- 进入 Space 管理页
- 查看最近使用 Space

### 推荐交互

点击用户卡片：

- 当前 Space 摘要
- 最近 Space 列表
- `New Space`
- `Manage Spaces`
- `Invite Members`

这是整个产品最重要的“上下文入口”。

## Space Overview 页面

Space Overview 不应只是“文件列表”。
它应该提供一个空间态工作台：

- 最近 Threads
- 最近 Docs
- 最近 Canvas 画布
- 最近 Artifacts
- Connector 状态
- 待审 Candidate Memories
- 本空间的固定规则 / Context Profile

用户进入 Space 后，应该一眼看到：

```text
这个空间正在发生什么
Agent 在做什么
哪些知识需要确认或整理
```

## Canvas 的产品定位

## 不是白板功能，而是上下文编排功能

Canvas 上的节点不应该只包含手绘元素。
它应该支持放入：

- Doc 引用
- Artifact 预览卡片
- Candidate Memory 卡片
- Accepted Memory 卡片
- SourceItem 卡片
- Thread 卡片
- Connector 搜索结果卡片
- Database 记录卡片

## Canvas 上用户的关键动作

### 1. 组织关系

- 拖拽聚类
- 分区整理
- 连线
- 标注
- 分组与命名

### 2. 选择上下文

- 框选一组节点
- 右侧显示 `Selection Context Summary`
- 一键发起：`Ask Agent with Selection`

### 3. 治理上下文

- Candidate Memory 拖到 `Approved` 区
- Candidate Memory 拖到 `Rejected` 区
- Candidate Memory 拖到 `Promote to Doc` 区
- Candidate Memory 拖到 `Promote to Board` 区

这意味着画布本身就是上下文治理台，而不是单纯内容展示台。

## Context 页面定位

Canvas 适合空间组织。
Context 页面适合列表治理。

Context 页应包含：

- `Accepted Memories`
- `Candidate Memories`
- `Profiles`
- `Context Rules`
- `Source Lineage`
- `Retrieval Debug`

### Candidate Memories 列表要支持

- 按 `pending_review / promoted / rejected` 筛选
- 按 `tier` 筛选：`working / experiential / factual`
- 查看 promotion score 与 rationale
- 审批 / 拒绝 / Pin / 归档
- 提升到 `Doc` 或 `Board`

## Workbench 与 Space 的联动

## Workbench 发起时

- 默认绑定当前 Space
- 读取当前 Space 默认 Context Profile
- 线程默认归属当前 Space

## Space 发起时

- 从当前选区组装 context pack
- 打开新 Thread 或侧边 Agent 面板
- 执行中产物自动回链到当前 Space

## Future：Side Panel 模式

长期看，Workbench 不一定总是全屏页面。
更理想的交互是：

- Space 是主界面
- Agent 是右侧侧栏 / 底部抽屉
- 用户在 Doc / Canvas / Database 中随时拉起 Agent

但第一阶段不必强行切换成这个形态。
第一阶段仍可以保持：

- Workbench 为主
- Space 为协作页
- 两者用统一 Space 上下文联动

## 对 AFFiNE 的要求

为了让上述交互成立，AFFiNE 侧至少需要作为以下能力被复用：

- 文档编辑表面
- Edgeless Canvas 表面
- block / card / attachment 容器
- local-first 协作同步能力
- 多人空间与权限能力

但以下能力不应成为 ContextGo 主入口：

- AFFiNE 自带 AI chat runtime
- AFFiNE 原生应用壳
- AFFiNE 顶层导航心智

## 产品判断

最终用户看到的不是：

- 一个 AFFiNE 壳里嵌了 Agent

而应该是：

- 一个 Agent Workbench 驱动的 Space OS
- 其中 Space 的文档与无限画布能力由 AFFiNE 提供底座

## MVP 落地顺序

### Phase A

- 用户卡片加入 `Space Switcher`
- Workbench 显示当前 Space
- Thread 绑定当前 Space

### Phase B

- 增加 `Space Overview`
- 增加 `Docs / Canvas / Context` 三个二级入口

### Phase C

- Canvas 支持 `Ask Agent with Selection`
- Candidate Memory 卡片可在 Canvas 上审批

### Phase D

- Candidate Memory 可提升到 `Doc` 或 `Board`
- Artifacts 可直接拖入 Canvas
- 多人协作和远端 presence 生效

## 一句话定义

```text
Workbench 是执行入口，Space 是长期认知容器，Canvas 是人机共同编排上下文的操作界面。
```
