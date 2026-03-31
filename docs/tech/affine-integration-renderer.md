# AFFiNE 前端能力吸收与 Renderer 集成草案

## 状态

- 面向前端接入的技术草案
- 与 `docs/tech/space-model.md`、`packages/context-engine/docs/affine-space-provider.md` 配套

## 目标

明确两件事：

1. 从 `../affine` 中优先吸收哪些前端能力
2. 如何低摩擦地嵌入 `ContextGo renderer`，而不让 ContextGo 退化成 AFFiNE 壳

## 基本原则

- 不引入 AFFiNE 的完整产品壳作为主入口
- 不采用 AFFiNE Copilot 作为主 agent 层
- 优先复用：
  - 文档编辑能力
  - Edgeless Canvas 能力
  - 协作/本地优先数据底座
- ContextGo 保留：
  - Workbench
  - Thread / Agent 执行
  - Context governance
  - Connectors / Publishing / Automation

## 推荐吸收顺序

### 第一优先级：内容表面

#### 1. `blocksuite/affine/all`

用途：

- AFFiNE block 编辑器能力集合
- 最适合作为文档 / canvas surface 的整合入口

#### 2. `blocksuite/affine/blocks/*`

重点：

- `paragraph`
- `list`
- `code`
- `table`
- `attachment`
- `image`
- `bookmark`
- `embed-doc`
- `data-view`
- `surface`
- `note`

用途：

- 最小可用文档能力
- 画布中的内容节点能力

#### 3. `blocksuite/affine/widgets/edgeless-*`

重点：

- `edgeless-toolbar`
- `edgeless-selected-rect`
- `edgeless-zoom-toolbar`
- `edgeless-auto-connect`
- `remote-selection`

用途：

- Infinite Canvas 交互
- 远端协作与选择态展示

### 第二优先级：前端应用层业务

#### 4. `packages/frontend/core`

用途：

- AFFiNE 前端共享业务层
- 作为内容工作台和文档/白板壳的参考来源

注意：

- 不建议整体搬入
- 应优先做“最小裁剪”或适配封装

#### 5. `packages/frontend/routes`

用途：

- Web 路由壳与页面组织参考

注意：

- 只参考页面组织方式
- 不建议直接照搬路由结构进 ContextGo

### 第三优先级：桌面适配层

#### 6. `packages/frontend/electron-api`

用途：

- AFFiNE 在 electron renderer 与主进程间的适配思路参考

注意：

- ContextGo 已有自己的 preload / IPC bridge
- 这里只能参考，不应直接替换

## 不建议先吸收的部分

- `packages/frontend/apps/electron`
  - 这是 AFFiNE 自己的桌面壳，不应整体拿来当 ContextGo 壳
- `packages/frontend/apps/web`
  - 这是 AFFiNE 应用入口层，不适合作为 ContextGo 主导航
- AFFiNE 自带 AI / Copilot 运行时
  - 会与 ContextGo Agent Workbench 冲突

## Renderer 集成方式

## 推荐结构

在 ContextGo renderer 中新增独立容器层：

```text
src/renderer/pages/space/
  SpaceShell/
  SpaceOverview/
  SpaceDocs/
  SpaceCanvas/
  SpaceContext/
  affine/
    AffineDocSurface/
    AffineCanvasSurface/
    AffineProviderBridge/
```

### 角色划分

- `SpaceShell`
  - ContextGo 自己的二级壳
  - 管理 tabs、导航、space 状态
- `AffineDocSurface`
  - 封装 AFFiNE 文档表面
- `AffineCanvasSurface`
  - 封装 AFFiNE edgeless canvas
- `AffineProviderBridge`
  - 负责把 ContextGo Space / Doc / Candidate / Artifact 映射到 AFFiNE provider 能读的对象

## 低摩擦接入策略

### Stage 1：嵌入只读 / 最小编辑 surface

- 在 ContextGo renderer 页面中挂载 AFFiNE Doc Surface
- 在 ContextGo renderer 页面中挂载 AFFiNE Canvas Surface
- 暂不做深度双向同步
- 暂不引入 AFFiNE 顶层导航

### Stage 2：最小双向动作

支持从 ContextGo 向 AFFiNE 发起：

- create doc
- create canvas
- append block
- add canvas card
- attach artifact preview
- promote candidate to doc/board

### Stage 3：选区联动

支持从 AFFiNE surface 回传：

- selected blocks
- selected cards
- linked docs
- current board context

这样就能支持：

```text
Ask Agent with Selection
```

## ContextGo → AFFiNE 映射

### 文档映射

- `ContextGo Document` → `AFFiNE Doc`
- `Candidate(destination=document)` → append block / create doc draft
- `Artifact summary` → embed / linked doc block

### 画布映射

- `Candidate(destination=board)` → canvas card / note
- `Artifact` → attachment / preview card
- `Thread` → linked discussion / reference card
- `SourceItem` → source card / embed card

## 主线程与 Renderer 边界

ContextGo 的 renderer 不应直接绑定 AFFiNE 存储细节。
应通过 provider bridge 接口与主进程 / local storage service 协作。

### 推荐接口

- `spaceProvider.listDocuments(spaceId)`
- `spaceProvider.getDocument(spaceId, documentId)`
- `spaceProvider.createDocument(...)`
- `spaceProvider.createBoard(...)`
- `spaceProvider.promoteCandidateToDocument(...)`
- `spaceProvider.promoteCandidateToBoard(...)`
- `spaceProvider.getSelectionContext(...)`

## 与 context engine 的联动

Renderer 侧要能看见这几类对象：

- accepted memories
- candidate memories
- docs
- boards
- artifacts
- source lineage

但 renderer 不直接决定 promotion policy。
promotion 仍由 context engine / context service 决定。

Renderer 主要做：

- 展示
- 审批
- 组织
- 触发动作

## 一期 MVP 最小切口

### 页面侧

- `Workbench` 顶部加入 Space Switcher
- 新增 `Space` 页面壳
- `Space` 下只先开放：
  - `Overview`
  - `Docs`
  - `Canvas`
  - `Context`

### AFFiNE 侧

- 先吸收 Doc surface
- 再吸收 Edgeless Canvas surface
- 先不做完整 workspace 管理 UI

### 引擎侧

- Candidate memory 可提升到 `document | board`
- 选区可触发 `Ask Agent with Selection`

## 结论

```text
AFFiNE 前端能力应作为 ContextGo Space 的内容与协作表面被吸收，
而不是替换 ContextGo 自己的 Workbench、Thread、Agent 和治理壳。
```

## Embedded 模式最小接入

当前 renderer 已支持一个最小 `embedded` 模式：

- `SpaceShell` 会读取 `CONTEXTGO_AFFINE_WEB_URL`
- 若存在该值，则 `AffineProviderBridge` 切换到 `embedded` 模式
- `AffineDocSurface` / `AffineCanvasSurface` 会生成 iframe 容器
- 若未配置 URL，则自动退化成 `shell` / placeholder 状态

也就是说，当前阶段不要求先把 AFFiNE 代码直接拷进来。
先让真实 AFFiNE Web 页面被嵌入，再验证用户价值和交互闭环。
