# Workbench Host Phase 3B Browser Capability Design

日期：2026-04-18

关联 Epic：`#188` `Evolve ContextGo from ChatLayout to AI Native Workbench Host`

相关实现：

- Phase 1 spec: `docs/superpowers/specs/2026-04-16-workbench-host-phase1-design.md`
- Phase 2 spec: `docs/superpowers/specs/2026-04-17-workbench-host-phase2-design.md`
- Phase 3A spec: `docs/superpowers/specs/2026-04-18-workbench-host-phase3a-design.md`
- Active PR: `#195`
- Related child issue: `#186`

## 摘要

Phase 3B 的目标是把 `browser` 从 conversation workbench 中“存在但不易发现”的附属能力，升级为一个轻量、稳定、可感知当前状态的 capability entry。

本阶段保持“小步但真实”的推进方式：

- `browser` 能力在 conversation header 中始终可见
- 未绑定时提供轻量入口
- 已绑定时提供轻量状态表达
- 继续沿用现有 browser asset / preview 打开逻辑
- 不引入新的 browser 子系统或大规模 UI 改版

因此，Phase 3B 是一次 **conversation capability normalization + 轻量可见变化**，不是一次 **browser workbench 改造**。

## 问题

在当前 conversation-cowork workbench 中，`browser` 已经被定义为 capability，但用户层的可见性和状态表达仍然过弱。

当前主要问题如下：

### 1. browser capability 仍然是条件出现

当前 header addon 只有在 `conversation.extra?.browserContextAssetId` 存在时才显示 browser 入口。

这意味着：

- 未绑定的 conversation 看不到 browser capability
- 用户无法通过顶部结构理解“这个 workbench 支持 browser”
- `browser` 更像隐藏功能，而不是正式 capability

### 2. 当前状态表达不足

即便已绑定 browser context，当前 header 也只是显示一个按钮，缺少足够轻量但明确的状态表达。

这导致：

- 用户不知道当前 conversation 是否已经带有 browser context
- 用户不知道当前绑定的 browser asset 是什么
- 用户只能通过点击后才理解上下文

### 3. 入口和状态没有形成 workbench 语义

从 `#188` 的角度看，`browser` 应该是 `conversation-cowork` 的一个正式 capability。

但当前实现更像：

- 仅在某些数据条件满足时才偶然露出的辅助按钮

这与 phase 3 的方向不一致：

- capability 应该首先变成 workbench 用户可以感知的稳定入口
- 而不是继续保持 conversation 内部的隐式附属能力

## 目标

Phase 3B 只解决以下目标：

1. 让 browser capability entry 在 conversation header 中始终可见
2. 让未绑定态和已绑定态具备不同但轻量的表达
3. 让已绑定 conversation 的当前 browser 状态可被用户快速感知
4. 保持当前 browser asset / preview 打开流程不变
5. 用最小可见变化把 `#186` 的方向开始纳入 `#188` 的 workbench 语义

## 非目标

本阶段明确不做以下事项：

- 不新增 browser 专属 panel
- 不改变 PreviewPanel 主结构
- 不新增 browser 路由
- 不引入多 browser asset 管理 UI
- 不引入 browser capability registry runtime
- 不把 browser 从 preview 系统中拆出来
- 不改造 group workflow header addon
- 不做第二个 workbench 原型

## 决策

采用 **双态 browser capability chip** 方案：

- 未绑定时，显示一个轻量 `Browser` capability chip
- 已绑定时，显示一个轻量 `Browser: <label>` capability chip
- 主点击行为保持稳定：
  - 未绑定 -> 进入创建/配置流程
  - 已绑定 -> 打开当前 browser context
- 已绑定时额外提供极轻的重新配置入口

不采用以下方向：

- 不只做入口增强而不显示状态
- 不只做状态增强而继续让未绑定态隐藏
- 不引入新的 browser capability 状态源

## 核心模型

### 1. `browser` 仍然沿用现有状态锚点

本阶段继续使用当前 conversation 与 browser asset 的现有绑定方式：

- `conversation.extra.browserContextAssetId`

这仍然是当前 conversation 是否绑定 browser capability 的主锚点。

### 2. `TBrowserContextAsset` 继续承载显示信息

本阶段不增加新的 browser header 状态模型，而是继续沿用现有 asset 数据：

- `label`
- `metadata.homeUrl`

也就是说，Phase 3B 的显示层只读取现有 browser asset 信息，不创建新的 browser capability store。

### 3. browser capability entry 不再依赖“是否已绑定”来决定是否渲染

本阶段的关键变化是：

- browser addon 永远允许渲染

但它要根据绑定状态切换成两种轻量形态：

#### 未绑定态

- 轻量 capability chip
- 文案为 `Browser`
- 主点击进入创建/配置流程

#### 已绑定态

- 轻量 capability chip
- 文案类似 `Browser: <label>`
- 主点击直接打开当前 browser context
- 同时保留一个极轻的重新配置入口

## 模块边界

### `src/renderer/pages/conversation/platforms/conversationHeaderAddons.tsx`

职责：

- 决定 browser capability entry 在 conversation header 中始终出现
- 根据当前 conversation 状态选择 browser addon 的渲染形态

它不负责：

- browser asset 的创建、更新、绑定逻辑
- preview 打开逻辑

### `src/renderer/pages/conversation/platforms/ConversationBrowserContextButton.tsx`

职责：

- 作为 browser capability chip 的主实现
- 根据是否已绑定 asset 渲染未绑定态或已绑定态
- 处理主点击和次级配置行为

它继续沿用现有逻辑：

- `assertBindable`
- `create`
- `update`
- `conversation.update`
- `openUrlPreview`

也就是说，本阶段主要升级的是展示模式和交互入口，而不是底层 browser 流程。

### conversation header addon 使用点

职责：

- 继续沿用现有 header addon 注入位置
- 不新增新的 header 容器

这可以保证：

- 当前 conversation 主布局保持稳定
- browser capability 的轻量可见变化只发生在 header addon 层

## 责任划分

### Conversation Header Addon Layer

负责：

- capability entry 是否出现
- capability entry 的轻量状态表达

不负责：

- browser asset 数据持久化
- browser preview 实际展示

### Browser Capability Chip

负责：

- 根据当前 conversation + bound asset 决定未绑定态或已绑定态
- 承担主点击行为和次级配置行为

不负责：

- 重新定义 browser 子系统的数据模型

### Existing Browser Asset / Preview Flow

继续负责：

- asset 可绑定性校验
- 创建和更新 browser asset
- 将 `homeUrl` 打开进 URL preview

这一层在 Phase 3B 不改语义。

## 最小落地范围

Phase 3B 的代码改动只应覆盖以下范围：

1. 让 browser capability header entry 始终可见
2. 把 `ConversationBrowserContextButton` 升级成双态 capability chip
3. 为已绑定态补一个极轻的重新配置入口
4. 保持现有 browser asset / preview 打开流程
5. 增加 conversation header regression tests

除此之外的 browser/preview/product 结构变化都不属于本阶段范围。

## 测试与验收标准

Phase 3B 通过的标准如下：

1. 未绑定 conversation 顶部也能看到 browser capability entry
2. 已绑定 conversation 顶部能看到当前 browser 状态 label
3. 主点击行为保持稳定：
   - 未绑定 -> 配置/创建
   - 已绑定 -> 打开当前 browser context
4. 已绑定但缺少 `homeUrl` 时，仍能进入配置流程
5. 当前 preview/browser 打开逻辑无回归
6. DOM tests 能覆盖未绑定态、已绑定态和交互态

建议最小测试覆盖包括：

- browser addon visible without bound asset
- browser addon shows bound label when asset exists
- browser addon primary action behavior regression

## 风险与控制

### 风险 1：入口过重，破坏 conversation header 节奏

如果 browser 入口做成大按钮或带长说明，会破坏 conversation 顶部信息密度。

控制方式：

- 使用轻量 capability chip
- 不加长描述文字
- 不增加新的 header 行

### 风险 2：状态文案过长，挤压现有 header addon

如果直接展示完整 browser asset label，conversation header 容易被撑坏。

控制方式：

- 对 label 做截断
- 保留 tooltip/title 用于完整信息查看

### 风险 3：为了状态表达引入新的 browser 状态源

如果新增一套 browser capability store，会让这刀从轻量归一化升级成 browser 架构改造。

控制方式：

- 只读取现有 `browserContextAssetId`
- 只读取现有 browser asset 的 `label` 和 `metadata.homeUrl`

## 对后续阶段的意义

Phase 3B 完成后，代码库将具备以下能力：

- `browser` 第一次成为用户可稳定感知的 conversation capability
- `#186` 开始真正并入 `#188` 的 workbench 主线
- 后续可以继续讨论 preview/browser 的更深层 capability normalization，而不是继续停留在“隐藏按钮”阶段

这使得 `conversation-cowork` 不只是“拥有 browser capability”，而是“对用户显式暴露 browser capability”。

## 结论

Phase 3B 的核心不是新增 browser 子系统，而是把 `browser` 从 conversation workbench 中“存在但不明显”的附属能力，升级为一个轻量、稳定、可感知当前状态的 capability entry。

在这一阶段之后：

- 未绑定 conversation 也能看到 browser capability
- 已绑定 conversation 能轻量表达当前 browser 状态
- 主交互流程仍然沿用现有 browser asset / preview 逻辑
- conversation-cowork 的 capability 语义会比今天更接近真实 workbench

这会让 `#188` 在保持小步推进的同时，第一次把 capability normalization 变成用户可感知的变化。
