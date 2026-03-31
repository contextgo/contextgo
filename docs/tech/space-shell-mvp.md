# Space Shell MVP

## 目标

在不打乱现有 Workbench 的前提下，给 ContextGo 增加一个最小可用的 `Space` 壳。

## MVP 范围

只做四个主视图：

- `overview`
- `docs`
- `canvas`
- `context`

不在此阶段做：

- 完整 AFFiNE workspace 管理
- 完整双向协作同步 UI
- 完整数据库/data-view 表面
- 独立移动端 Space 壳

## 入口

### 顶部用户卡片

用户卡片新增：

- 当前 Space 名称
- 最近 Space 列表
- `New Space`
- `Manage Spaces`

### Workbench 到 Space

- Workbench 内始终显示当前 Space
- 点击当前 Space 可跳转到 `Space Overview`

## 页面结构

### `overview`

显示：

- 最近线程
- 最近文档
- 最近产物
- Connector 状态
- 待审 Candidate Memories

### `docs`

第一阶段只需要：

- 文档列表
- 当前文档 surface 容器
- 从 candidate 提升到 doc 的动作入口

### `canvas`

第一阶段只需要：

- Edgeless surface 容器
- 当前选区摘要
- `Ask Agent with Selection`
- `Promote Candidate to Board`

### `context`

第一阶段只需要：

- accepted memories
- candidate memories
- approve / reject
- promotion rationale

## renderer 最小契约

建议先以这三个文件作为前端约束：

- `src/renderer/pages/space/types.ts`
- `src/renderer/pages/space/constants.ts`
- `src/renderer/pages/space/affine/IAffineSpaceProvider.ts`

这样后续：

- 页面实现
- AFFiNE 嵌入
- Agent 选区联动

都能在不推翻现有架构的前提下逐步推进。

## 一句话原则

```text
先把 Space 壳做薄，把 AFFiNE surface 接进来，再逐步加深联动。
```

## 当前最小实现状态

当前仓库中已经落地的最小前端骨架包括：

- `src/renderer/components/layout/Titlebar/SpaceSwitcher.tsx`
- `src/renderer/pages/space/SpaceShell.tsx`
- `src/renderer/pages/space/SpacePage.tsx`
- `src/renderer/pages/space/affine/MockAffineSpaceProvider.ts`

这意味着：

- 顶栏已经可以承载 `Space Switcher`
- `SpaceShell` 已可承载 `overview / docs / canvas / context` 四个 MVP 视图
- 已有一个 mock provider 可支撑最小交互验证

尚未在此阶段完成：

- 把 `/space/:spaceId` 正式挂入现有 renderer 路由树
- 真实 AFFiNE surface 嵌入
- 真实 candidate/memory/context 数据在 renderer 中的加载
