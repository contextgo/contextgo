# Architecture

相关设计文档：

- `docs/tech/space-model.md`：定义目标中的 Space、Replica、Mount 模型，以及 AFFiNE 吸收方式
- `docs/tech/mobile-remote-control.md`：定义 Host Runtime + Official Remote + 多端客户端的长期产品模型
- `docs/tech/mobile-shell-readiness.md`：记录移动壳当前适配性和验证状态
- `docs/tech/mobile-shell-cmd.md`：记录移动壳命令入口与构建命令路径

## Product Definition

### ContextGo 要解决的问题

ContextGo 不是单纯的 AI 聊天窗口，也不是把本地目录直接包一层 Agent UI。

它要解决的是：

- 用户的长期工作上下文分散在会话、目录、文件、浏览器、外部系统和不同设备里
- Agent 的执行窗口通常是短期的，每次都像从零开始
- 本地目录对执行很重要，但并不能代表完整的长期工作语义
- 移动端、浏览器和远程入口需要接入同一套工作系统，但不能破坏宿主运行时上的本地所有权

因此，ContextGo 的长期方向不是“会话驱动的聊天产品”，而是一个：

- host-runtime-first
- local-first
- multi-agent
- long-lived context driven

的工作系统。

一句话定义：

```text
ContextGo 是一个以本地为主权基础、以长期上下文为核心、由 Host Runtime 驱动的多 Agent 工作系统。
```

### 当前可发版产品

当前最适合对外表达的产品定义是：

```text
ContextGo 是一个 host-runtime-first 的 Agent Workbench。
```

它当前已经清晰成立的部分包括：

- Host Runtime 作为真实执行宿主
- session / conversation 驱动的 Agent 工作流
- 本地工作目录与运行时工具接入
- WebUI / browser 访问
- Desktop / Android / iOS / HarmonyOS 远程壳接入
- 持续演进中的 context engine 基础设施

当前不应对外过度承诺的部分包括：

- 完整成熟的 Space-first 信息架构
- 完整多人协作语义
- 完整 Project 层对象模型
- 完整可操作的 Mount 管理产品面
- 把 context engine 直接包装成面向用户的独立主功能

### 长期目标产品

长期目标可以定义为：

```text
Space-first 的 local-first Agent Work System。
```

也就是：

- `Workbench` 是执行入口
- `Space` 是长期上下文与协作容器
- `Project` 是 Space 内的工作单元
- `Session / Thread` 是具体执行视图
- `Context Engine` 负责长期沉淀、检索、压缩和组装上下文
- Host Runtime 负责执行，桌面、移动端和浏览器作为远程使用面接入

## Core Object Model

### Space

`Space` 是长期逻辑空间。

它负责：

- 长期上下文归属
- connector / source / memory / doc / artifact 的长期组织
- thread / task 的默认边界
- 后续多人协作、权限和治理边界

`Space` 不是本地文件夹，也不是某次单独会话。

### Project

`Project` 是 `Space` 内的工作单元。

它更接近用户真正理解的“当前正在推进的一项工作”，例如：

- 一个代码仓库
- 一个产品迭代
- 一个研究课题
- 一个交付任务

设计原则：

- `Project belongs to Space`
- `Project` 可以绑定一个默认本地工作目录
- 但 `Project` 不应被直接定义成“某个磁盘路径本身”
- 同一个 `Project` 后续允许对应多个本地资源入口或跨设备不同路径

当前仓库中，`Project` 还没有成为一等实现对象。
在现阶段，如果需要一个近似落点，可以临时把“一个带明确 working directory 的工作单元”近似看成 project-like object，
但不要把这种兼容做法误认为最终产品定义。

### Session / Thread / Conversation

`Session` 或 `Thread` 是具体执行视图。

当前代码里仍主要使用 `Conversation` 作为实现对象，因此可按以下方式理解：

- `Conversation` 是当前实现中的执行会话
- 它在长期模型里更接近 `Thread` / `Session`

它负责：

- 承载一次任务或一条任务线
- 记录 agent 交互、审批和执行过程
- 在当前实现中绑定 `spaceId`，作为逻辑上下文归属

因此：

- `Session belongs to Project` 是长期推荐模型
- 在 `Project` 尚未落地前，当前实现等价于 `Conversation belongs to Space`

### Mount

`Mount` 是某个逻辑空间或工作单元在当前设备上的本地资源入口。

它的职责是：

- 把某个本地资源根暴露给当前设备或 runtime
- 让逻辑空间可以连接到本机可执行资源
- 为后续 session 提供候选 working directory / resource root

设计原则：

- `Mount` 是 device-local 的
- `Mount` 不是 `Space` 的身份本体
- `Mount` 不是用户当前必须理解的一等外部概念
- `Mount` 更适合作为内部模型字段和未来产品能力保留

### workingDirectory / workspace

`workingDirectory` 是运行时真正使用的物理目录。

它表示：

- 这次 agent execution 实际使用的 cwd
- 这次任务实际落到哪个本地目录上执行

`workspace` 当前仍然保留，主要用于兼容现有执行与 UI 分组逻辑。

因此应这样理解：

- `spaceId` = 逻辑空间归属
- `projectId` = 工作单元归属（长期目标）
- `mountId` = 当前设备上的本地挂载引用
- `workingDirectory` = 本次运行的实际目录
- `workspace` = 兼容旧逻辑的过渡字段

## Local-First Rules

### 不要把逻辑对象退化成路径对象

以下对象不应直接等同于磁盘路径：

- `Space`
- `Project`

原因：

- 同一逻辑对象可能在不同设备上映射到不同路径
- 目录只代表本地执行入口，不代表完整工作语义
- 未来同步应该复制空间内容，不是复制本机路径状态

### 同步的是空间内容，不是设备状态

local-first 的长期规则应保持：

- 同步 `Space` / `Project` / `Thread` 下的持久上下文对象
- 不同步本机绝对路径、本机缓存、本机授权和 host-specific 运行状态
- `Mount` 和本机路径只作为当前设备的本地绑定存在

## Current Guidance

### 对外产品叙事

当前版本优先使用以下叙事：

- `Agent Workbench`
- `Desktop host`
- `Host runtime`
- `Official Remote`
- `Remote client access`
- `Session`
- `Working directory`

暂时不要把以下概念作为首发版强用户心智：

- `Mount`
- 完整 `Project` 模型
- 完整 `Space-first` 导航承诺
- `Context Engine` 作为主卖点名称

### 对内产品与架构约束

后续设计与实现应尽量遵守以下判断：

- Workbench 仍是当前主入口
- `Space` 是长期目标中的顶层逻辑容器
- `Project` 应作为 `Space` 下的工作单元补齐，而不是继续让 `workspace` 兼任产品对象
- `workingDirectory` 继续承担执行层职责，不应反向定义长期产品对象
- `Mount` 保留为内部模型与未来能力，不强制立刻产品化
- 移动端继续作为 Host Runtime 的远程使用面，不改变主机边界

## Multi-Process Model

ContextGo is an Electron app with three types of processes:

- **Main Process** (`src/process/`, `src/index.ts`) — application logic, database, IPC handling. No DOM APIs available.
- **Renderer Process** (`src/renderer/`) — React UI. No Node.js APIs available.
- **Worker Processes** (`src/process/worker/`) — background AI tasks (gemini, codex, acp workers).

Cross-process communication must go through the IPC bridge.

## IPC Communication

- Preload script: `src/preload.ts` — exposes a secure `contextBridge` API to the renderer
- Message type definitions: `src/renderer/messages/`
- All IPC channels are typed; add new channels in both the preload and the messages directory

## WebUI Server

Located in `src/process/webserver/`.

- Express + WebSocket for real-time communication
- JWT authentication for remote access
- Enables network clients to access the agent UI remotely (not just local Electron window)

## Remote Mobile Clients

ContextGo supports a remote mobile-client model through the WebUI / server runtime.

- The desktop app remains the execution host when used in remote-control scenarios.
- Android / iOS / HarmonyOS shells are native WebView containers for the existing WebUI.
- Mobile-local file selection should upload into the desktop host through the existing HTTP upload flow, then continue processing on the host side.

See `docs/tech/mobile-remote-control.md` for the long-lived product constraints behind this model.

## Run Modes

ContextGo can run in four modes. The WebSocket channel is the browser-side equivalent of
Electron IPC — both transports reach the same bridge handlers and services.

```
start / cli  (Electron desktop)
┌─────────────────────────────────────────────────────┐
│  Electron window          Browser (optional WebUI)  │
│      │                          │                   │
│      │ IPC                      │ WebSocket         │
│      ▼                          ▼                   │
│       bridge handlers / services / DB               │
└─────────────────────────────────────────────────────┘

webui  (Electron, no window)
┌─────────────────────────────────────────────────────┐
│  (no Electron window)     Browser                   │
│                                  │                  │
│                                  │ WebSocket        │
│                                  ▼                  │
│       bridge handlers / services / DB               │
│       + full Electron API (fsBridge, cronBridge,    │
│         mcpBridge, notificationBridge …)            │
└─────────────────────────────────────────────────────┘

server  (pure Node.js, no Electron)
┌─────────────────────────────────────────────────────┐
│  (no Electron window)     Browser                   │
│                                  │                  │
│                                  │ WebSocket        │
│                                  ▼                  │
│       bridge handlers / services / DB               │
│       (10 Electron-only bridges unavailable:        │
│        fsBridge, cronBridge, mcpBridge,             │
│        dialogBridge, shellBridge, applicationBridge,│
│        windowControlsBridge, updateBridge,          │
│        webuiBridge, notificationBridge)             │
└─────────────────────────────────────────────────────┘
```

Authentication flow (WebUI / server modes):

1. `POST /login` → JWT token
2. Connect WebSocket with token (verified on handshake)
3. All bridge calls travel over the WebSocket connection

## Cron System

Located in `src/process/services/cron/`.

- Based on `croner` library
- `CronService`: task scheduling engine
- `CronBusyGuard`: prevents concurrent execution of the same job
