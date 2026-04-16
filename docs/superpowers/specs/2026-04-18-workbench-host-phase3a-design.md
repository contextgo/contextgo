# Workbench Host Phase 3A Design

日期：2026-04-18

关联 Epic：`#188` `Evolve ContextGo from ChatLayout to AI Native Workbench Host`

相关实现：

- Phase 1 spec: `docs/superpowers/specs/2026-04-16-workbench-host-phase1-design.md`
- Phase 2 spec: `docs/superpowers/specs/2026-04-17-workbench-host-phase2-design.md`
- Active PR: `#195`

## 摘要

Phase 3A 的目标是让 shell 第一次真正消费 `WorkbenchShellContract`，把当前 conversation workbench 与 shell 之间最核心的隐式 DOM slot 约定升级为显式 contract。

本阶段仍然保持“边界收口优先”，而不是进入大规模 UI 重构：

- shell 开始显式读取当前 workbench 的 slot contract
- `Titlebar` 不再只靠 conversation 路由语义决定是否渲染 titlebar primary slot 和 toolbar slot
- `ChatLayout` 不再硬编码 conversation 专属 slot id
- 现有 UI 行为尽量保持不变

因此，Phase 3A 是一次 **shell/workbench 边界落地**，不是一次 **layout engine 改造**。

## 问题

Phase 2 已经把 `WorkbenchDefinition`、`WorkbenchCapability` 和 `WorkbenchShellContract` 变成了显式代码模型，但当前 shell 仍然没有真正消费这些定义。

这导致一个明显的不对称状态：

- workbench 侧已经声明了 contract
- shell 侧仍然主要依赖旧的 conversation 隐式约定

当前主要问题如下：

### 1. `Titlebar` 仍然隐式绑定 conversation 语义

当前 `Titlebar` 通过 conversation/desktop 状态隐式决定是否渲染：

- `#app-titlebar-chat-slot`
- `#app-titlebar-toolbar-slot`

这意味着 shell 并不是在消费当前 workbench contract，而是在消费历史 conversation 语义。

### 2. `ChatLayout` 仍然硬编码固定 slot id

当前 `ChatLayout` 直接查找：

- `app-titlebar-chat-slot`
- `app-titlebar-toolbar-slot`

这使得 conversation workbench 的具体实现仍然把 shell 的结构细节写死在页面内部，而不是通过 workbench contract 获得 slot 信息。

### 3. shell/workbench 边界仍未真正闭环

Phase 2 已经完成了“定义正确”，但还没有完成“消费正确”。

如果继续只新增 definitions 而不让 shell 读取它们，就会让 `WorkbenchShellContract` 继续停留在“有类型、没人用”的半空状态。

## 目标

Phase 3A 只解决以下目标：

1. 升级 `WorkbenchShellContract`，让它能表达 shell slot 定义
2. 让 `Titlebar` 基于当前 workbench contract 显式渲染 shell slots
3. 让 `ChatLayout` 通过 contract/helper 获取 slot id
4. 保持当前 `/conversation/:id` 的 UI 表现不变
5. 通过测试证明 shell/workbench 的 slot 边界已经从隐式约定升级为显式 contract

## 非目标

本阶段明确不做以下事项：

- 不让 shell 基于 capability 自动拼装整体布局
- 不把 `preview` / `workspace` / `browser` 做成 runtime capability engine
- 不把 workspace toggle 抽成 shell contract 的一部分
- 不重写 `ChatLayout` 的主结构
- 不引入第二个 workbench 的可见 UI
- 不让 `Titlebar` 直接读取 preview/workspace 等 workbench capability
- 不让 `WorkbenchHost` 承担布局编排职责

## 决策

采用 **slot contract 落地方案**：

- `WorkbenchShellContract` 从静态标签升级为 shell 可直接消费的 slot object
- `Titlebar` 第一个开始显式消费该 contract
- `ChatLayout` 继续使用 portal 模式，但 portal 目标由 contract 决定，而不是由硬编码 id 决定

不采用以下方向：

- 不提前做 capability-driven layout
- 不把 `WorkbenchShellContract` 做成动态注册/事件系统
- 不让 shell 在这一步感知 preview/workspace/browser 的完整能力图

## 核心模型

### 1. `WorkbenchShellContract` 继续保持轻量

本阶段不让它演化成大型 shell schema，只增加两个直接需要落地的点：

- `titlebar`
- `toolbar`

它们都只表达“是否存在 slot”和“slot 的稳定 id”，不表达布局算法。

建议形状如下：

```ts
type WorkbenchShellContract = {
  shellStyle: 'conversation';
  titlebar?: {
    primarySlotId: 'app-titlebar-chat-slot';
  };
  toolbar?: {
    slotId: 'app-titlebar-toolbar-slot';
  };
};
```

### 2. `conversation-cowork` 继续映射到现有 shell slot

Phase 3A 中，`conversation-cowork` 仍然使用当前已有的 titlebar primary slot 与 toolbar slot。

也就是说：

- 不改变 slot 名称
- 不改变当前 portal 目标区域的视觉结构
- 只是把这些 slot 名称从隐式硬编码提升为 workbench contract 的显式声明

### 3. `WorkbenchCapability` 暂不参与 shell 布局决策

虽然 `conversation-cowork` 已声明：

- `chat`
- `preview`
- `workspace`
- `browser`

但本阶段 shell 不基于 capability 决定布局，只消费 slot contract。

这是为了避免 Phase 3A 滑向“大而全的 shell engine 改造”。

## 模块边界

### `src/renderer/pages/WorkbenchHost/types.ts`

职责：

- 升级 `WorkbenchShellContract` 类型
- 继续保持 `WorkbenchDefinition` 是单一 source of truth

### `src/renderer/pages/WorkbenchHost/definitions.ts`

职责：

- 在 `conversationCoworkWorkbench` 中写明实际 shell slot contract

这里仍然只写静态定义，不写 runtime 逻辑。

### `src/renderer/pages/WorkbenchHost/context.ts`

职责：

- 继续只暴露当前 `definition`
- 不增加 shell runtime 行为

### `src/renderer/pages/WorkbenchHost/slots.ts` 或等价 helper 模块

职责：

- 从 `WorkbenchDefinition` 中解析 shell slot id
- 为 shell 和 conversation 页面提供同一份 slot 解析逻辑

这层是 Phase 3A 的关键，它可以防止：

- `Titlebar` 和 `ChatLayout` 各自维护一份 slot 命名约定
- contract 存在但读取逻辑分裂

### `src/renderer/components/layout/Titlebar/index.tsx`

职责：

- 基于当前 workbench contract 决定是否渲染 primary titlebar slot
- 基于当前 workbench contract 决定是否渲染 toolbar slot

它不负责：

- 根据 capability 自动拼布局
- 感知 preview/workspace/browser 等具体能力
- 决定 conversation workbench 的内部 UI

### `src/renderer/pages/conversation/components/ChatLayout/index.tsx`

职责：

- 从 contract/helper 获取当前 shell slot id
- 将现有 header content / toolbar content portal 到这些 slot

它不负责：

- 反向决定 shell 应该渲染哪些 slot
- 直接硬编码 shell 结构

## 责任划分

### Workbench Definition

workbench definition 决定：

- 这个 workbench 需要哪些 shell slot

它不决定：

- shell 具体如何实现这些 slot 的样式与位置

### Shell / Titlebar

shell 决定：

- 是否渲染 contract 指定的 slot 容器
- 这些 slot 容器出现在现有 titlebar 结构中的什么位置

它不决定：

- 具体 portal 进去的 conversation 内容是什么

### Conversation Workbench Implementation

conversation 页面决定：

- 往 shell slot 里 portal 什么内容

它不决定：

- shell 是否存在这些 slot

这就是 Phase 3A 要落地的真正边界。

## 最小落地范围

Phase 3A 的代码改动只应覆盖以下范围：

1. 升级 `WorkbenchShellContract`
2. 更新 `conversationCoworkWorkbench` 的 shell slot 定义
3. 新增 shell slot helper
4. 让 `Titlebar` 基于 contract 渲染 slot
5. 让 `ChatLayout` 通过 contract/helper 查找 slot
6. 增加 shell contract regression tests

除此之外的 UI 或产品行为变更都不属于本阶段范围。

## 测试与验收标准

Phase 3A 通过的标准如下：

1. `WorkbenchShellContract` 已能表达 titlebar primary slot 和 toolbar slot
2. `Titlebar` 基于当前 workbench definition 渲染 shell slot 容器
3. `ChatLayout` 不再硬编码 conversation 专属 slot id
4. `/conversation/:id` 的当前 UI 表现无回归
5. regression tests 能证明 shell/workbench slot 边界已由显式 contract 决定

建议最小测试覆盖包括：

- `Titlebar` contract slot rendering test
- `ChatLayout` slot resolution test
- router/workbench integration regression test

## 风险与控制

### 风险 1：shell 读取了太多 workbench 细节

如果 `Titlebar` 在这一步开始读取 preview/workspace/browser 等 capability，shell 会重新变成 conversation 语义的别名。

控制方式：

- shell 只读取 slot presence 和 slot id
- shell 不读取 capability 列表

### 风险 2：`ChatLayout` 仍然隐式耦合 shell 内部结构

如果只把硬编码字符串改成别处定义的常量，而不是从 contract/helper 读取，本质上边界并没有升级。

控制方式：

- portal 目标必须来自当前 workbench definition 的 helper 解析结果

### 风险 3：Phase 3A 滑向 layout engine

如果在这一步引入“根据 contract 自动生成 titlebar / sidebar / workspace 布局”，这会让范围快速失控。

控制方式：

- 只落 slot 容器显式化
- 不做动态布局编排

## 对后续阶段的意义

Phase 3A 完成后，代码库将具备以下能力：

- shell 和 workbench 之间第一次存在真正被消费的正式 contract
- `Titlebar` 不再只是 conversation 历史结构的隐式产物
- `ChatLayout` 不再把 shell slot id 写死在自己的实现里
- Phase 3B 才可以继续讨论 capability-driven shell integration 或 conversation slice normalization 的下一层

这使得 `#188` 从“定义层完成”推进到“边界层完成”。

## 结论

Phase 3A 的核心不是新增 workbench，而是让 shell 第一次正式站到 workbench contract 这一侧。

在这一阶段之后：

- shell slot 不再只是 conversation 历史约定
- `Titlebar` 开始显式消费 workbench contract
- `ChatLayout` 开始通过 contract 获取 shell slot
- 当前 UI 表现仍然保持稳定

这会让 `#188` 的主线继续保持“小步但真实”的推进方式，而不是重新落回 conversation 默认主轴。
