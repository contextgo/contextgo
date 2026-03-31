# Workbench / Space / Canvas 信息架构

## 状态

- 用于产品与前端协同的 IA 草案
- 与 `packages/context-engine/docs/workbench-space-canvas-interaction.md` 配套

## 核心产品判断

- `Agent Workbench` 仍然是产品主入口
- `Space` 是长期上下文与协作容器
- `Canvas` 是最重要的上下文编排与治理表面

## 顶层导航

```text
┌─────────────────────────────────────────────────────────────┐
│ Logo | Workbench | Space | Connectors | Publishing | Settings │
│                                              User + Space ▼ │
└─────────────────────────────────────────────────────────────┘
```

### 用户卡片 / Space Switcher

点击右上用户卡片展开：

- 当前用户
- 当前 Space
- 最近 Space
- `New Space`
- `Manage Spaces`
- `Invite Members`

这是整个产品的“上下文入口”。

## 入口 1：Workbench

```text
Workbench
├── Left Rail
│   ├── Recent Threads
│   ├── Tasks / Jobs
│   ├── Pending Reviews
│   └── Quick Actions
├── Main Panel
│   ├── Active Thread Tabs
│   ├── Agent Chat / Execution Stream
│   ├── Tool Calls / Confirmations
│   └── Result / Artifact Preview
└── Right Panel
    ├── Current Space Summary
    ├── Retrieved Context Pack
    ├── Candidate Memories
    └── Related Docs / Canvas Nodes
```

### Workbench 的目标

- 承接用户直接发起的 Agent 工作
- 显示执行、审批、产物、回写状态
- 永远明确“当前是在哪个 Space 中工作”

## 入口 2：Space

```text
Space
├── Overview
├── Docs
├── Canvas
├── Database
├── Threads
├── Artifacts
├── Context
└── Members
```

## Space Overview

```text
Space Overview
├── Header
│   ├── Space name / icon / member avatars
│   ├── Search
│   └── Quick create: Doc / Canvas / Ask Agent
├── Summary Cards
│   ├── Recent Threads
│   ├── Recent Docs
│   ├── Recent Artifacts
│   ├── Connectors Status
│   └── Pending Candidate Reviews
└── Activity Feed
    ├── Agent outputs
    ├── Memory promotions
    ├── Doc / Canvas edits
    └── Collaboration events
```

## Docs

```text
Docs
├── Left: document tree / collections
├── Center: document editor
└── Right: references / linked threads / candidate memory promotions
```

## Canvas

```text
Canvas
├── Infinite Edgeless Surface
│   ├── Doc Cards
│   ├── Artifact Cards
│   ├── Candidate Memory Cards
│   ├── Accepted Memory Cards
│   ├── Source Cards
│   ├── Thread Cards
│   └── Database Record Cards
├── Top Toolbar
│   ├── Select / Connect / Note / Embed / Shape
│   ├── Ask Agent with Selection
│   └── Promote / Approve / Reject
└── Right Inspector
    ├── Selection Context Summary
    ├── Linked Sources
    ├── Related Threads
    └── Candidate Review Actions
```

### Canvas 的关键动作

- 拖拽整理对象
- 画线建立关系
- 框选上下文子集
- 用选区发起 Agent 任务
- 在画布上审批 candidate memories
- 把 Artifact / Candidate 提升为 Doc 或 Board 内容

## Context 页面

```text
Context
├── Accepted Memories
├── Candidate Memories
├── Profiles
├── Context Rules
├── Source Lineage
└── Retrieval Debug
```

### Candidate Memories 列表动作

- `Approve`
- `Reject`
- `Pin`
- `Promote to Doc`
- `Promote to Board`
- 查看 `promotionScore / rationale / source lineage`

## 典型用户路径

### 路径 A：从 Workbench 开始

```text
Open app
→ choose Space from user card
→ open/create Thread
→ send task to Agent
→ Agent reads current Space context
→ output lands in Artifact + Candidate Memory
→ user reviews in Workbench side panel or Context page
```

### 路径 B：从 Space / Canvas 开始

```text
Open Space
→ open Canvas
→ select doc/cards/sources
→ click Ask Agent with Selection
→ system builds task-scoped context pack
→ open side Agent session / Thread
→ result links back into current Canvas
```

## 产品结论

```text
Workbench 是执行入口，Space 是长期知识容器，Canvas 是协作与上下文编排界面。
```
