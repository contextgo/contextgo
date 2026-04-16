# Workbench Host Phase 2 Design

日期：2026-04-17

关联 Epic：`#188` `Evolve ContextGo from ChatLayout to AI Native Workbench Host`

相关实现：

- Phase 1 spec: `docs/superpowers/specs/2026-04-16-workbench-host-phase1-design.md`
- Phase 1 PR: `#195`

## 摘要

Phase 2 的目标不是继续扩张 `WorkbenchHost` 的运行时能力，也不是提前重构 shell UI，而是先把 `workbench` 的定义模型正式落进代码。

本阶段采用“声明层优先”的策略：

- 把 `workbenchKind` 升级为完整的 `WorkbenchDefinition`
- 把 `capability` 从口头概念升级为显式声明
- 把 shell/workbench 边界从隐式 DOM 约定升级为显式 `shellContract`
- 保持现有 `Titlebar`、`Layout`、`ChatLayout` 的可见行为不变

因此，Phase 2 是一次 **架构收口**，不是一次 **UI 重构**。

## 问题

Phase 1 已经证明：

- app shell 可以先进入 `WorkbenchHost`
- `conversation` 可以被显式建模为 `conversation-cowork`

但当前代码仍然缺少正式的 workbench 定义层。

当前主要问题如下：

### 1. `workbenchKind` 仍然过薄

当前 `WorkbenchHost` context 只暴露一个 `workbenchKind` 字符串。

这意味着：

- 当前 workbench 有哪些能力，代码里没有正式定义
- shell 应该如何理解这个 workbench，代码里没有正式定义
- 路由和 workbench 的关系仍然只是“传了一个 kind”

### 2. shell/workbench 边界仍然主要依赖隐式约定

例如当前 `ChatLayout` 仍直接依赖：

- `#app-titlebar-chat-slot`
- `#app-titlebar-toolbar-slot`

这说明当前 shell 与 conversation workbench 之间主要还是隐式 DOM 约定，而不是显式 contract。

### 3. capability 仍然停留在文档层

`preview`、`workspace`、`browser` 等能力已经在产品和设计文档中被讨论，但它们仍然没有在 renderer 架构里形成稳定声明模型。

这会导致后续 Phase 3 / Phase 4 面临两个问题：

- 很难判断某个能力属于 workbench 定义、shell contract、还是具体页面实现
- 很容易把 `WorkbenchHost` 做成新的万能容器

## 目标

Phase 2 只解决以下目标：

1. 引入正式的 `WorkbenchDefinition`
2. 把 capability 和 shell contract 变成显式类型与声明
3. 让 router 基于 definition 接入 `WorkbenchHost`
4. 让 `WorkbenchHostContext` 以 definition 作为 source of truth
5. 保持当前 conversation UI 和 shell UI 行为无回归

## 非目标

本阶段明确不做以下事项：

- 不修改 `Titlebar` 的显示逻辑
- 不修改 `Layout` 的 shell 行为
- 不修改 `ChatLayout` 的 portal / slot 注入方式
- 不让 shell 开始消费 `WorkbenchShellContract`
- 不把 `preview` / `workspace` / `browser` 改造成 runtime capability system
- 不引入第二个真实 workbench UI 原型
- 不将 `WorkbenchHost` 扩展为新的中间 UI 编排器

## 决策

采用 **类型优先的 `WorkbenchDefinition` 方案**。

不采用以下方向：

- 不使用全局查表驱动的重型 registry runtime
- 不提前引入 shell provider 和动态注册回调
- 不让 `WorkbenchHost` 持有 capability 的渲染或布局职责

本阶段只建立“正式定义模型”，不建立“正式消费机制”。

## 核心模型

### 1. `WorkbenchKind`

`WorkbenchKind` 继续作为稳定主键存在。

Phase 2 中仍只有一个已落地值：

- `conversation-cowork`

但类型形状必须允许后续扩展。

### 2. `WorkbenchCapability`

`WorkbenchCapability` 用于声明某个 workbench 具备哪些能力。

本阶段它只承担“静态声明”职责，不承担渲染、挂载、生命周期控制职责。

Phase 2 不要求 capability 列表已经穷举所有未来能力，但至少要允许表达当前设计文档中已经稳定存在的概念，例如：

- `chat`
- `preview`
- `workspace`
- `browser`

这并不意味着这些能力的实现位置要移动，只意味着它们首次成为 workbench definition 的正式组成部分。

### 3. `WorkbenchShellContract`

`WorkbenchShellContract` 用于声明 workbench 对 shell 的边界要求。

本阶段只允许定义静态字段，不允许出现：

- 动态注册回调
- 事件总线
- slot 注入函数
- shell/workbench 双向状态同步通道

Phase 2 的 shell contract 只负责表达“这个 workbench 在 shell 语义上属于什么类型，需要保留什么槽位概念”。

例如可表达的方向包括：

- 是否属于 conversation-style shell
- 是否声明 titlebar 主内容区语义
- 是否声明 toolbar slot 语义

这些字段在 Phase 2 只作为显式声明存在，shell 暂时不消费。

### 4. `WorkbenchDefinition`

`WorkbenchDefinition` 是本阶段新增的一等对象。

它至少包含：

- `kind`
- `capabilities`
- `shellContract`

它是 router、host context、未来 shell 接线的共同源头。

Phase 2 之后，`workbenchKind` 不再是唯一 source of truth，`WorkbenchDefinition` 才是。

## 模块边界

建议按以下边界落地：

### `src/renderer/pages/WorkbenchHost/types.ts`

职责：

- 定义 `WorkbenchKind`
- 定义 `WorkbenchCapability`
- 定义 `WorkbenchShellContract`
- 定义 `WorkbenchDefinition`

这里不放具体 workbench 常量，只放类型。

### `src/renderer/pages/WorkbenchHost/definitions.ts`

职责：

- 存放内建 workbench definitions

Phase 2 中仅包含：

- `conversationCoworkWorkbench`

这里是“当前有哪些 workbench”的集中声明位置。

### `src/renderer/pages/WorkbenchHost/context.ts`

职责：

- 将 context source of truth 从 `workbenchKind` 升级为 `definition`

兼容性上可以暴露派生出的 `workbenchKind`，但它必须来自 `definition.kind`，不能再独立存储。

### `src/renderer/pages/WorkbenchHost/index.tsx`

职责：

- 接收 `WorkbenchDefinition`
- 提供 `WorkbenchHostContext`
- 提供稳定的 host container

它不负责：

- capability 渲染
- shell slot 接线
- preview/workspace/browser 编排
- conversation 页面逻辑

### `src/renderer/components/layout/Router.tsx`

职责：

- 负责 route 到 `WorkbenchDefinition` 的绑定
- 负责把 definition 传给 `WorkbenchHost`

它不负责：

- 计算 capability 行为
- 决定 shell 如何消费 contract
- 替代 registry 或 host context

## 责任划分

### Router

Router 的职责是：

- 决定进入哪个 workbench
- 决定某条 route 对应哪个 `WorkbenchDefinition`

它不是 capability center，也不是产品编排器。

### WorkbenchHost

`WorkbenchHost` 的职责是：

- 持有当前 workbench definition
- 暴露 workbench context
- 提供稳定 host 容器

它不是新的 `ChatLayout`，也不是新的中间区域万能控制器。

### Conversation Workbench Implementation

`conversation-cowork` 的具体实现仍然是现有 conversation 页面及其内部布局。

也就是说：

- `ChatLayout` 继续负责当前 conversation 相关 UI
- `PreviewPanel`、workspace panel、toolbar portal 继续由既有实现管理
- 这些组件未来可以逐步改造成 capability 驱动，但 Phase 2 不做这件事

### Shell

Phase 2 中，shell 的角色不变：

- `Titlebar` 保持现状
- `Layout` 保持现状
- 现有 slot DOM 约定保持现状

唯一变化是：shell/workbench 边界第一次被 definition 模型显式表达出来。

## 最小落地范围

Phase 2 的代码改动只应覆盖以下范围：

1. 新增 `WorkbenchDefinition` 类型模型
2. 新增内建 definitions 文件
3. 升级 `WorkbenchHostContext`
4. 升级 `WorkbenchHost` 的 props 和 context 传递
5. 升级 `/conversation/:id` 路由接线
6. 增加 definition 级测试

除此之外的 UI 或 shell 变更都不属于本阶段范围。

## 测试与验收标准

Phase 2 通过的标准如下：

1. 代码中存在稳定的 `WorkbenchDefinition` 模型
2. `/conversation/:id` 通过 `conversationCoworkWorkbench` 接入 `WorkbenchHost`
3. `WorkbenchHostContext` 基于 definition 工作，而不是仅基于裸字符串
4. `conversation-cowork` 的 capability 与 shell contract 已形成显式声明
5. 现有 conversation UI 行为无回归
6. 现有 shell 行为无回归
7. 测试能证明 route 和 host context 都基于 definition 工作

建议最小测试覆盖包括：

- router regression test
- `WorkbenchHost` context exposure test
- definition shape stability test

## 风险与控制

### 风险 1：抽象过早，形成空壳

如果把 Phase 2 做成纯命名包装，而没有真正让 definition 成为 source of truth，这一层会变成空壳。

控制方式：

- router 必须直接绑定 `WorkbenchDefinition`
- host context 必须以 definition 为中心

### 风险 2：shell contract 设计过重

如果 Phase 2 提前引入动态能力注册、回调、事件同步，这一轮会从声明层滑向运行时系统设计。

控制方式：

- contract 仅允许静态字段
- 不引入事件总线
- 不引入 hook 式注册 API

### 风险 3：`WorkbenchHost` 与 `ChatLayout` 重新混淆

如果把 titlebar、preview、workspace 的具体编排提前塞进 `WorkbenchHost`，就会把它做成新的万能中层。

控制方式：

- `WorkbenchHost` 不接管 UI 编排
- `ChatLayout` 继续作为 `conversation-cowork` 的具体实现

## 对后续阶段的意义

Phase 2 完成后，代码库将具备以下能力：

- 可以正式说“当前 route 对应的是某个 workbench definition”
- 可以正式说“capability 和 shell contract 是 workbench 定义的一部分”
- 可以在 Phase 3 再让 shell 开始消费 contract，而不需要重新发明模型
- 可以在后续新增第二个 workbench 时，直接复用 definition 模式，而不是复制 conversation route 的历史路径

这使得 `#188` 从“概念正确”推进到“定义正确”。

## 结论

Phase 2 的核心不是增加更多 workbench UI，而是先把 ContextGo 的 workbench 主模型编码成正式 definition。

在这一阶段之后：

- `workbenchKind` 不再只是孤立字符串
- capability 不再只是文档术语
- shell/workbench 边界不再只是隐式约定
- `WorkbenchHost` 仍然保持轻量，不吞并 conversation UI 实现

这为后续 shell consumption、capability runtime、以及第二个 workbench 原型打下稳定边界。
