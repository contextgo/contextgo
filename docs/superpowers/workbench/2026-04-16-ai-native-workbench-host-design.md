# ContextGo AI Native Workbench Host Design

日期：2026-04-16

关联 Epic：`#188` `Evolve ContextGo from ChatLayout to AI Native Workbench Host`

## 摘要

冻结 ContextGo 下一阶段的产品与架构方向：

- ContextGo 不应继续收敛为单一 `ChatLayout` 产品
- `conversation` 不应继续充当所有能力的总容器
- agent / runtime 不应直接决定产品工作面的布局
- ContextGo 的长期形态应为一个 **AI Native Workbench Host**
- 不同专业工作面应拥有不同的中间主容器与交互结构

这个设计用于回答一个已经明确暴露的问题：

- 当前从 `AionUi` 演化而来的 `chat + preview + workspace` 结构适合 `cowork` 场景
- 但它不适合作为 ContextGo 对所有工作类型的唯一桌面布局模型

## 问题

当前实现层大量能力仍然挂载在会话页及其衍生布局之上：

- `ChatLayout`
- `PreviewPanel`
- `Workspace`
- 各类会话型 sendbox / messages / runtime shell

这套模型对以下场景是成立的：

- 通用聊天
- 代码型 cowork
- 文件生成后的预览与回写
- 轻量网页查看

但是当产品目标升级为“全能 AI 原生工作台”后，这套模型会失真。

因为未来 ContextGo 面向的不只是“一个 agent 聊天页”：

- 文档/内容生产工作台
- 图像生成与编辑工作台
- 视频创作工作台
- 音乐创作工作台
- browser/research 工作台
- space/context 治理工作台
- group / orchestration 工作台

这些工作面共享同一个外壳，但**不应共享同一个中间主容器结构**。

## 决策

ContextGo 的产品主模型从：

- `App Shell + ChatLayout + agent-specific panels`

演化为：

- `App Shell + Workbench Host + runtime/assistant layer`

### 核心原则

1. 外壳稳定，中间工作面可替换
2. 工作台类型决定中间主容器，而不是 agent backend
3. conversation 是一种 workbench，但不是唯一 workbench
4. preview / workspace / browser / asset views 都应成为 workbench capability，而不是聊天页专属附属物
5. 各专业工作台允许拥有自己的容器体系、工具条、面板结构与状态模型

## 产品定位

ContextGo 是一个：

- desktop-first
- local-first
- host-runtime aware
- AI-native
- multi-workbench
- multi-agent

的工作系统。

这里最重要的产品边界变化是：

- **Agent 是执行角色**
- **Workbench 是产品工作面**

不能再把 runtime backend 等价成用户所处的产品表面。

## 反模式

以下方向应视为反模式：

### 1. 用一个聊天页承载所有工作类型

例如：

- 让图像、视频、音乐、文档、研究、编排都继续塞进 `ChatLayout`
- 让所有新能力都退化成“聊天右边多一个 panel”

这会让产品越来越像一个不断堆附件的聊天应用，而不是原生工作台。

### 2. 用 agent backend 决定布局

例如：

- `gemini` 一种布局
- `codex` 一种布局
- `acp` 一种布局

这是错误的主键。

布局应由下面这些因素决定：

- `workbenchKind`
- `artifactKind`
- `taskMode`
- `space/product context`

而不是由 backend 名称决定。

### 3. 把 preview / workspace 锁死为聊天附属物

未来：

- 文件编辑工作台中，文件主容器可能就是中心
- 图像工作台中，资产时间线/画布可能是中心
- 视频工作台中，时间线、播放器、素材库可能是中心
- 音乐工作台中，轨道、素材、导出状态可能是中心

这时聊天区可能只是辅助面板，不再是主轴。

## 目标模型

### 1. App Shell

负责全局稳定框架：

- 左侧全局导航
- 顶部标签 / 路由上下文
- Space / Project / Session 切换
- 通知、状态、全局入口
- 多端与 host-runtime 状态

Shell 尽量稳定，不被单一工作类型绑死。

### 2. Workbench Host

这是中间主区域的统一宿主。

它负责：

- 根据 `workbenchKind` 挂载不同工作台
- 统一全局生命周期
- 注册 workbench capability
- 管理 workbench 与 shell 的边界
- 在需要时协调 preview、asset panel、workspace panel、tool panel、runtime sidecar

它不负责具体某个工作台的内部布局细节。

### 3. Runtime / Assistant Layer

Runtime / assistant layer 负责：

- 模型/agent 选择
- tool/use 权限模式
- 自动化执行
- 单 agent / group / orchestration
- 与当前 workbench 的能力对接

它不是工作面的唯一决定者。

## 建议的一层抽象

### Workbench Kind

建议明确引入 `workbenchKind` 概念，例如：

- `conversation-cowork`
- `document-editor`
- `browser-research`
- `image-studio`
- `video-studio`
- `music-studio`
- `space-canvas`
- `space-context`
- `group-orchestration`

### Workbench Capability

建议抽象工作台能力，而不是直接耦合页面组件：

- `chat`
- `preview`
- `workspace-tree`
- `asset-library`
- `timeline`
- `editor`
- `canvas`
- `browser`
- `render-queue`
- `export`
- `history`
- `runtime-console`

同一个 capability 可以被多个 workbench 复用，但布局方式可以完全不同。

### Workbench Container

每个工作台允许定义自己的中间主容器体系，例如：

- 双栏编辑器 + 预览
- 三栏素材库 + 画布 + inspector
- 时间线 + 播放器 + 参数面板
- 聊天主轴 + 右侧工作区

ContextGo 不应预设只有一种中心区域结构。

## 对当前实现的含义

### `ChatLayout`

应重新定义为：

- `conversation-cowork` workbench 的当前实现

而不是：

- ContextGo 所有工作面的总布局

### `PreviewPanel`

应重新定义为：

- 一个可被 workbench host 调度的能力模块

而不是：

- 只服务聊天页的附属组件

### `Workspace`

应重新定义为：

- 一种 workbench capability surface

而不是：

- 永远固定在聊天右侧的树状区块

### Team / Group / Orchestration

应视为工作模式与工作台的一部分，而不是单纯聊天页的特例。

## 初始工作台划分建议

短中期先冻结三类一等工作台：

### 1. Conversation Cowork Workbench

适用：

- 通用聊天
- 代码协作
- 文件处理
- 轻量 research

中心主容器：

- 聊天主轴

可挂能力：

- preview
- workspace
- browser
- command queue
- artifact sidecar

### 2. Document / Content Workbench

适用：

- 文档编辑
- 内容生成
- 结构化写作
- 多版本预览与导出

中心主容器：

- 编辑器 / 预览 / 资产区

聊天应是辅助手段，而不是唯一主视图。

### 3. Media Studio Workbench

适用：

- 生图
- 视频
- 音乐
- 多媒体资产工作流

中心主容器可包含：

- 画布 / 播放器 / 时间线 / 资产库 / inspector / render queue

这类工作台不应被强行翻译成聊天页加几个预览器。

## 路由与状态建议

未来路由与状态不应只围绕 `conversation/:id`。

建议逐步演化到：

- shell 路由决定当前 workbench
- workbench 内部再决定是否存在 conversation/session

例如：

- `/conversation/:id`
- `/space/:spaceId/context`
- `/workbench/document/:docId`
- `/workbench/image/:assetId`
- `/workbench/video/:projectId`

这里的重点不是最终 URL 形式，而是**状态主轴必须从 conversation 扩展到 workbench**。

## 与 AionUi 的关系

上游 `AionUi` 仍然是重要参考，但只适合作为：

- `conversation-cowork` slice 的上游参考

而不是：

- ContextGo 总体产品模型

因此：

- 可以继续吸收它在 cowork/chat/workspace/preview 方向的成熟能力
- 但不能把它当前的桌面布局模型视为 ContextGo 的长期上限

## 非目标

本设计当前**不**要求：

- 立即重写全部现有会话页面
- 一次性引入图像/视频/音乐全部工作台
- 立即废弃现有 preview/workspace 代码
- 立即统一所有 runtime 状态模型

## 分阶段演化建议

### Phase 1

冻结产品与架构方向：

- 明确 `ChatLayout` 只是 `conversation-cowork`
- 明确 `WorkbenchHost` 是未来中间主容器宿主
- 让后续 issue 不再围绕“继续给聊天页加附件”展开

### Phase 2

抽出 workbench host 抽象：

- 路由层能识别 workbench kind
- shell 与 workbench 建立稳定边界
- preview/workspace/browser 变为 capability

### Phase 3

把现有 conversation slice 迁移成 workbench 实现：

- `conversation-cowork`
- `group-orchestration`

### Phase 4

增加新的专业工作台：

- document/content
- image
- video
- music

## 与当前 issue 的关系

以下 issue 仍然有效，但应被视为 `conversation-cowork` workbench 内的子问题：

- `#183` workspace file mentions + upload state
- `#184` WeCom channel + WebUI upload parity
- `#185` workspace files/changes panel
- `#186` browser context / URL preview discoverability

它们不应主导 ContextGo 的总体产品形状。

相反，它们应被纳入一个更大的 workbench host 演化 epic。

## 验收标准

当这个方向被正式采纳后，后续产品与架构讨论必须满足：

- 不再默认把新能力挂进唯一聊天页
- 不再把 backend 名称当成布局主键
- 新工作面优先以 `workbenchKind` 讨论
- `ChatLayout` 被明确视为某一类 workbench，而不是总布局
- 后续专业工作台可以在不破坏 shell 的前提下独立演化

## 结论

ContextGo 的长期方向不是“更复杂的聊天应用”，而是“可承载多种专业工作面的 AI Native Workbench Host”。

因此，从今天开始：

- `conversation` 不是唯一主轴
- `agent` 不是唯一表面
- `workbench` 才是中间区域的核心产品抽象
