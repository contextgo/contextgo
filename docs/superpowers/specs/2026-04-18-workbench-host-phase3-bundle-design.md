# Workbench Host Phase 3 Bundle Design

日期：2026-04-18

关联 Epic：`#188` `Evolve ContextGo from ChatLayout to AI Native Workbench Host`

相关实现：

- Phase 1 spec: `docs/superpowers/specs/2026-04-16-workbench-host-phase1-design.md`
- Phase 2 spec: `docs/superpowers/specs/2026-04-17-workbench-host-phase2-design.md`
- Phase 3A spec: `docs/superpowers/specs/2026-04-18-workbench-host-phase3a-design.md`
- Phase 3B spec: `docs/superpowers/specs/2026-04-18-workbench-host-phase3b-browser-design.md`
- Active PR: `#195`
- Related child issues: `#183` `#185` `#186`

## 摘要

Phase 3 不再按单个 capability 分散推进，而是一次性完成 `conversation-cowork` workbench 的 capability normalization bundle。

这个 bundle 统一覆盖：

- `browser`
- `workspace`
- `preview`

目标不是重写 conversation 页面，而是把这三类能力从“聊天页附属物”收成正式 capability surface，让 `conversation-cowork` 在代码和用户界面上都更接近真实 workbench。

本阶段允许出现轻量可见变化，但仍保持明确边界：

- 不做第二个 workbench 原型
- 不做新的 layout engine
- 不重写 PreviewPanel / Workspace 的整体结构
- 不新增大范围 route 模型

因此，Phase 3 bundle 是一次 **conversation-cowork capability normalization**，不是一次 **conversation shell rewrite**。

## 问题

当前 `conversation-cowork` 已经在定义层具备：

- `chat`
- `preview`
- `workspace`
- `browser`

但除了 shell slot contract 已在 Phase 3A 开始被消费之外，这三个能力在产品表面和代码边界上仍然有明显的不完整状态。

### 1. `browser` 仍然刚刚开始 workbench 化

Phase 3B 已经把 browser 提升为一个轻量 capability chip，但它仍然只是 header addon 层面的第一步。

仍存在的问题：

- browser 还没有被统一纳入 capability surface 叙事
- browser 与 preview 的关系仍然主要停留在内部实现层
- browser 状态与 conversation workbench 的整体 capability 表达仍然是分散的

### 2. `workspace` 仍然更像右侧附属区

当前 `workspace` 深度参与 conversation：

- 文件树
- 工作区路径
- 上传/导入
- 刷新
- group/workflow 入口

但在产品和代码边界上，它仍更像：

- 永远固定在聊天右侧的附属区块

而不是：

- `conversation-cowork` workbench 的正式 capability surface

### 3. `preview` 仍然更像“打开文件后的顺带面板”

当前 Preview 模块本身已经很强，但它在 conversation-cowork workbench 中的角色仍然比较隐式：

- 它有很强的内部结构
- 但用户和外层代码并没有把它当成正式 capability 入口或状态 surface

这使得：

- preview 与 browser 的能力边界不够清晰
- preview 与 workspace 的关系更多体现为内部联动，而不是 workbench 语义

### 4. capability 仍未形成统一 surface

当前 `conversation-cowork` 的这些能力虽然都存在，但用户看到的是几套独立习惯：

- browser 是一个 header addon
- workspace 是右侧面板
- preview 是按内容打开的面板

这三者还没有被统一收敛为：

- “同一个 workbench 的不同 capability surface”

## 目标

Phase 3 bundle 只解决以下目标：

1. 完成 `browser`、`workspace`、`preview` 在 `conversation-cowork` 内的 capability normalization
2. 让这三类能力在 UI 上具备更统一的 workbench surface 语义
3. 让 conversation 页面对这些能力的依赖从隐式习惯收敛为显式 capability helper / boundary
4. 保持现有主布局和主要交互习惯不发生大改版
5. 让 `#183`、`#185`、`#186` 的方向开始真正归入 `#188` 主线

## 非目标

本阶段明确不做以下事项：

- 不新增第二个 workbench 原型
- 不重写 `ChatLayout` 主结构
- 不重写 `PreviewPanel` 为新产品
- 不重写 `Workspace` 为新产品
- 不新增新的 browser / preview / workspace route
- 不实现 capability-driven auto layout engine
- 不把 conversation 页面整体拆成多个独立 route
- 不统一所有 runtime / agent 状态模型

## 决策

采用 **capability surface normalization bundle** 方案：

- browser 继续沿用 Phase 3B 的轻量 capability chip 方向
- workspace 收敛成更明确的 conversation workbench capability surface，而不是默认右侧附属区
- preview 收敛成更明确的 conversation workbench capability surface，而不是“文件打开后的顺带面板”

这三者一起推进，但仍然只在 `conversation-cowork` 这一个 workbench 内完成，不扩到 document/image/video 等其他 workbench。

## 核心原则

### 1. capability 不等于独立产品

在 `conversation-cowork` 内：

- `browser`
- `workspace`
- `preview`

都先作为 capability surface 存在。

它们不必立即长成独立 workbench，也不必拥有自己的 route。

### 2. capability 要有用户可感知的稳定入口或状态

如果某个能力只能在内部状态满足后偶然露出，它仍然是隐式附属物，而不是 capability surface。

所以本阶段要求：

- browser 有稳定可感知入口/状态
- workspace 有更明确的 surface 语义
- preview 有更明确的 surface 语义

### 3. capability 归一化不等于布局大改版

本阶段不通过大改布局来完成归一化，而是通过：

- 边界 helper
- 稳定入口
- 轻量状态表达
- 显式 surface 语义

来完成。

## browser 方向

browser 在本阶段中作为 capability normalization 的第一类样板。

最终要求：

- 在 conversation header 中始终可见
- 未绑定时有轻量入口
- 已绑定时有轻量状态表达
- 与 preview 的打开逻辑保持稳定

browser 不再只是隐藏能力，而成为 workbench capability 的显式入口。

## workspace 方向

workspace 在本阶段中不做全面重写，但要完成两件事：

1. 在 conversation workbench 中明确它是 capability surface
2. 给用户一个更清晰的“当前 conversation 是否带工作区 / 当前工作区是什么”的表达

这意味着本阶段更适合做：

- 轻量状态表达
- 轻量入口整理
- 轻量命名和 surface 语义收口

而不是做：

- 全量文件树 UI 改版
- 大规模拖拽/导入工作流重写

## preview 方向

preview 在本阶段中不做结构重写，但要完成两件事：

1. 明确 preview 是 conversation-cowork 的 capability surface
2. 明确 preview 与 browser / workspace 的关系是 capability 协作，而不是偶然联动

这更适合通过：

- capability helper
- capability state expression
- preview open / current preview status 的轻量表达

来完成，而不是通过大改 PreviewPanel 本体来完成。

## 模块边界

### `src/renderer/pages/WorkbenchHost/types.ts`

职责：

- 保持 `conversation-cowork` 的 capability 定义是正式模型的一部分

本阶段不要求大改类型，但要求 capability 语义真正被消费，而不是仅作为静态声明存在。

### `src/renderer/pages/conversation/platforms/conversationHeaderAddons.tsx`

职责：

- 继续作为 conversation-cowork 顶部 capability entry 的主要注入点

browser 会继续在这里落地。
如有必要，workspace / preview 的轻量状态或入口也应优先复用这层，而不是凭空新增顶部结构。

### `src/renderer/pages/conversation/components/ChatLayout/index.tsx`

职责：

- 继续承载 conversation-cowork 的主结构
- 不负责 capability registry，但负责承接 capability surface 的位置和协作关系

### `src/renderer/pages/conversation/Preview/`

职责：

- 继续负责 preview 的实际内容展示与编辑
- 不在本阶段被重写成新产品

### `src/renderer/pages/conversation/Workspace/`

职责：

- 继续负责 workspace 内容和交互
- 不在本阶段被重写成新产品

## 责任划分

### Workbench Definition

负责：

- 说明 `conversation-cowork` 具备 `browser` / `workspace` / `preview`

不负责：

- 直接决定这些 capability 的 UI 结构

### Conversation Capability Surface Layer

负责：

- 让 capability 有稳定入口或状态
- 让 capability 之间的关系更接近 workbench 语义

不负责：

- 重建整个 conversation 布局系统

### Existing Preview / Workspace / Browser Asset Flows

继续负责：

- preview 的具体展示与编辑
- workspace 的具体文件交互
- browser asset 的创建、绑定、更新、打开

本阶段要做的是“边界归一化”，不是“底层能力重写”。

## 最小落地范围

Phase 3 bundle 的代码改动应覆盖以下范围：

1. 完成 browser capability 的轻量入口和状态统一
2. 为 workspace 补足一处轻量但明确的 workbench surface 表达
3. 为 preview 补足一处轻量但明确的 workbench surface 表达
4. 引入最少量的 capability helper / capability state surface
5. 增加与 browser / workspace / preview 相关的 regression tests

## 测试与验收标准

Phase 3 bundle 通过的标准如下：

1. browser、workspace、preview 在 conversation-cowork 中都具备更明确的 capability surface 语义
2. 至少各有一处用户可感知的稳定入口或状态表达
3. 现有 conversation 主布局无大改版
4. 现有 preview/workspace/browser 主流程无回归
5. DOM tests 能覆盖新增 capability surface 行为

## 风险与控制

### 风险 1：范围再次碎片化

如果继续按单 capability 分散推进，就会回到“单刀 patch”模式。

控制方式：

- 统一以 phase 3 bundle 的目标组织实现和 PR 文案

### 风险 2：范围膨胀成大改版

如果把 workspace、preview 都推进到完整 UI 重构，这一批会失控。

控制方式：

- 只做 capability surface normalization
- 不做大布局重写

### 风险 3：只做了可见入口，没有完成边界归一化

如果只改按钮/文案，而不改边界 helper 或 capability surface 语义，这一批会变成纯 UI 修饰。

控制方式：

- 每个 capability 都至少补一层显式 surface 语义
- 不只做视觉微调

## 对后续阶段的意义

Phase 3 bundle 完成后，`conversation-cowork` 会第一次具备比较完整的 capability surface 形态：

- browser 可发现
- workspace 更可感知
- preview 更可感知

这意味着后续再进入：

- document/content workbench
- browser-research workbench
- preview/workspace 的更深层拆分

时，conversation-cowork 不再是“一个堆附件的聊天页”，而是一个已经被初步 workbench 化的能力主面。

## 结论

Phase 3 bundle 的核心不是“大改 conversation”，而是一次性把 `browser + workspace + preview` 这三类能力从附属习惯收成正式 capability surface。

在这一阶段之后：

- `conversation-cowork` 的 capability 不再只是定义层存在
- 用户能更清楚地感知这些 capability
- conversation 页面会更接近真实 workbench，而不是继续作为默认聊天容器存在

这会让 `#188` 从“有 host、有 definition、有 shell contract”进一步推进到“有真实 capability surface”的阶段。
