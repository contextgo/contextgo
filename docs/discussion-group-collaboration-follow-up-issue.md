# Issue Draft: 重构协作组产品模型，重新设计创建流、主界面与运行时边界

## 背景

当前“新建讨论组”这块已经不只是一个简单的多助手聊天弹窗，而是演化成了一个完整的协作容器：

- 入口已经接入侧边栏、标题栏、会话标签栏
- 数据模型已经引入 `group` 顶层会话、隐藏子会话、父子历史分组
- 运行时已经支持两类 orchestration：
  - `discussion`：`broadcast / relay / debate`
  - `workflow`：`planner-writer-evaluator / plan-build-evaluate`
- Workspace 面板已经有成员面板、artifact 预览、共享工作目录联动

但这块产品能力是在较短时间内快速落地的，当前存在明显的“概念分叉、UI 表达不足、能力边界不清、运行时约束不够稳”的问题，已经影响继续迭代。

## 当前已实现的能力面

### 1. 创建入口

- 侧边栏、标题栏、会话 Tabs 都可以直接创建“协作组”
- 创建时可指定共享工作目录，也可沿用默认临时工作目录
- 参与者可从两类来源选择：
  - 预设助手
  - CLI Agent

对应代码：

- `src/renderer/components/layout/Sider.tsx`
- `src/renderer/components/layout/Titlebar/index.tsx`
- `src/renderer/pages/conversation/components/ConversationTabs.tsx`
- `src/renderer/pages/conversation/platforms/group/CreateGroupModal.tsx`

### 2. 会话模型

- 顶层使用 `type: 'group'`
- 每个参与者创建一个隐藏子会话
- 父会话持有参与者列表、orchestration、runState
- 子会话通过 `groupMeta.parentGroupId` 归属到父协作组

对应代码：

- `src/common/config/storage.ts`
- `src/process/bridge/services/group/GroupConversationService.ts`
- `src/process/bridge/databaseBridge.ts`

### 3. 讨论式协作

- 支持三种模式：
  - `broadcast`
  - `relay`
  - `debate`
- 消息会以“投影消息”的形式回写到父会话时间线
- 能保留参与者身份、轮次信息

对应代码：

- `src/process/bridge/services/group/discussion/DiscussionGroupRuntime.ts`
- `src/process/bridge/services/group/discussion/discussionHelpers.ts`

### 4. 工作流协作

- 支持 workflow template
- 已有 `planner-writer-evaluator` / `plan-build-evaluate`
- 有 runState、stageHistory、artifactPath、scoreTarget、reviewMode
- writer / evaluator 之间已经有一套显式 artifact contract

对应代码：

- `src/common/config/group.ts`
- `src/common/config/workflowTemplates/builtIn.ts`
- `src/process/bridge/services/group/workflow/WorkflowGroupRuntime.ts`
- `src/process/bridge/services/group/workflow/workflowHelpers.ts`

### 5. 壳层集成

- 历史记录支持把子会话挂在父协作组下面
- Workspace 侧栏支持查看组内成员和 artifact
- Group chat 已经有独立 send box 和运行 summary card

对应代码：

- `src/renderer/pages/conversation/GroupedHistory/utils/groupingHelpers.ts`
- `src/renderer/pages/conversation/hooks/ConversationTabsContext.tsx`
- `src/renderer/pages/conversation/Workspace/components/GroupParticipantsPanel.tsx`
- `src/renderer/pages/conversation/platforms/group/GroupChat.tsx`
- `src/renderer/pages/conversation/platforms/group/HarnessRunSummaryCard.tsx`

## 当前用户动线

### 创建前

- 用户从“新建 -> 协作组”进入创建弹窗

### 创建中

- 输入协作组名称
- 选择工作目录
- 选择协作方式：
  - 工作流
  - 讨论
- 如果是工作流：
  - 选择 template
  - 配置迭代次数、评分阈值、artifact path、review mode
  - 选择恰好 3 个参与者并分配角色
- 如果是讨论：
  - 选择 `broadcast / relay / debate`
  - 选择至少 2 个参与者

### 创建后

- 创建一个父 `group` 会话
- 自动创建若干隐藏子会话
- 打开父会话页
- 用户从父会话输入任务
- runtime 调度子会话顺序执行，并把消息投影回父会话
- 相关 workspace / artifact / group member 信息分散显示在主聊天区、workspace 浮层、历史分组中

## 主要问题

### 1. 产品概念已经分叉，用户很难理解“讨论组”到底是什么

当前系统里同时存在两套协作语义：

- 新模型：`group + orchestration.kind = discussion | workflow`
- 旧模型：`discussion + collaboration.mode = planner-generator-evaluator`

这导致：

- 产品名叫“协作组”，但用户原始心智是“讨论组”
- 讨论模式和 workflow 模式被塞进同一个创建入口，但没有清晰说明“这是一个协作容器 + 两种 orchestration”
- 旧的 `CreateDiscussionGroupModal.tsx` 仍然保留，但已经不再被主入口使用
- 术语混用：
  - `planner-generator-evaluator`
  - `planner-writer-evaluator`
  - UI 中既有 “生成者”，也有 “写作者”
  - artifact 目录仍然叫 `.contextgo/discussion-groups`

这已经不是文案问题，而是产品边界和实现边界都没有完全收敛。

### 2. 创建弹窗功能很多，但没有形成顺滑的产品引导

当前创建弹窗已经承载了过多配置：

- 工作目录
- 协作方式
- 讨论模式
- workflow template
- template config fields
- 参与者选择
- 角色分配

问题在于：

- workflow 被设为默认，但用户未必理解“为什么一上来是工作流”
- 参与者列表没有搜索、筛选、推荐理由、角色槽位引导
- Git 仓库边界、workspace 必填、exact participant count 等关键约束很多都在提交时才报错
- 默认自动选择内置助手，偏实现视角，不偏用户任务视角
- 原始讨论需求和代码任务 workflow 需求被混在一个大弹窗里，认知负担偏高

### 3. 主会话界面的信息表达不够好，协作状态被分散到了多个地方

当前 group chat 主界面只提供了：

- summary card
- 普通 message list
- send box

而真正对用户最重要的信息：

- 当前有哪些参与者
- 当前是 discussion 还是 workflow
- 当前运行到哪一轮 / 哪一阶段
- 谁正在执行
- 最终结论 / 汇总是什么
- artifact 在哪里

分别散落在：

- message meta
- header popover
- workspace 右下角浮层
- workspace artifact 面板

这会导致功能虽然有，但“产品上不成形”。

### 4. discussion runtime 仍然偏底层实现视角，不够像一个真正的“讨论产品”

当前 discussion runtime 的关键问题：

- `broadcast` / `relay` / `debate` 本质都是顺序执行，不是用户直觉里的“并行群聊”
- discussion mode 没有 coordinator / synthesizer，最后只是把多位参与者输出顺序铺在时间线里
- 没有 round-level summary、差异聚合、结论抽取
- 用户读完整个 group timeline 的成本仍然偏高

也就是说，底层已经能跑“多参与者顺序编排”，但还没有形成“多助手讨论产品”的最终体验。

### 5. discussion mode 的运行时安全边界不够清晰

设计目标原本更偏“讨论和决策支持”，但当前实现里：

- 每个参与者都是真实子会话
- 共享同一个 workspace
- 继承各自助手的 skills / hooks / runtime
- discussion runtime 本身没有对工具执行建立明确的默认限制

这会带来几个问题：

- 讨论模式也可能触发真实工具执行
- 多参与者共享工作目录，但没有显式权限模型
- 产品层面看起来像“讨论”，运行时层面其实可能进入“多 agent 操作同一 workspace”

这会直接影响用户信任和后续演进。

### 6. 历史 / artifact / 兼容层里还有明显的迁移债务

当前仍能看到一批过渡期痕迹：

- `CreateDiscussionGroupModal.tsx` 仍保留
- `collaboration.mode = planner-generator-evaluator` 仍在 discussion path 中生效
- artifact 仍以 `planner / generator / evaluator` 命名
- artifact root 仍叫 `.contextgo/discussion-groups`
- runtime 和 UI 中对 “generator / writer” 的命名尚未统一

这些债务会持续放大后续改动成本。

## 建议的收敛方向

### 一、先统一产品模型

建议把顶层产品概念明确为：

- `协作组` = 顶层协作容器
- `讨论` = 一种 orchestration
- `工作流` = 一种 orchestration

并明确：

- 用户原来理解的“讨论组”，在产品层可以继续保留为文案别名或入口文案
- 但实现模型上不再保留第二套 legacy collaboration path
- 统一收敛到 `group + orchestration`

### 二、重做创建流，而不是继续堆字段

建议改成两步或三步创建：

1. 先选协作目的
   - 多观点讨论
   - 结构化工作流
2. 再配置参与者和工作目录
3. 最后做高级参数配置

同时补齐：

- inline validation
- participant search / filter
- role slot first 的 workflow 选人方式
- 预设模板说明
- workspace / git boundary 的前置校验

### 三、把“协作状态”收回主聊天界面

建议在 group chat 主界面直接呈现：

- participant roster
- orchestration type
- round / stage progress
- active participant
- final summary / latest decision
- artifact shortcut

Workspace 浮层可以保留，但不应该承担主表达职责。

### 四、明确 discussion 和 workflow 的运行时边界

建议区分两套默认策略：

- discussion：
  - 默认偏 read-only / no-tool / decision-support
  - 强调观点、分歧、归纳、结论
- workflow：
  - 明确 role-based capability policy
  - writer 可写，evaluator 默认只读
  - artifact contract 继续保留并强化

### 五、清理 legacy path 和命名债务

建议一次性完成：

- 删除未使用的 `CreateDiscussionGroupModal.tsx`
- 移除 legacy `planner-generator-evaluator` discussion path
- 统一 `generator / writer` 命名
- 统一 artifact path / manifest schema / root directory naming
- 让 UI、数据结构、runtime template 使用同一套词汇

## 建议 issue 范围

这个 issue 不建议直接做成一次性“大重构提交”，而是作为一个总跟进 issue，下面拆分子任务推进：

1. 产品模型收敛
2. 创建弹窗 / 创建动线重设计
3. Group chat 主界面改版
4. discussion runtime 收敛为真正的 discussion product
5. workflow runtime 权限与状态表达补齐
6. legacy path / 命名 / artifact 模型清理

## 验收标准

- 用户能清楚理解“协作组 / 讨论 / 工作流”三者关系
- 创建流不再把所有系统细节一次性砸给用户
- discussion 与 workflow 在 UI 和 runtime 上都有明确边界
- group chat 主界面能直接看清成员、状态、进度、结果
- discussion 默认不再隐式进入高风险 workspace 操作
- workflow 的角色、artifact、评分、结论表达统一
- legacy discussion-harness 路径和旧 modal 被移除或迁移完成
- 命名统一，不再同时出现 `generator` / `writer` 两套主词汇

## 参考代码

- `src/renderer/pages/conversation/platforms/group/CreateGroupModal.tsx`
- `src/renderer/pages/conversation/platforms/group/CreateDiscussionGroupModal.tsx`
- `src/renderer/pages/conversation/platforms/group/GroupChat.tsx`
- `src/renderer/pages/conversation/platforms/group/HarnessRunSummaryCard.tsx`
- `src/renderer/pages/conversation/Workspace/components/GroupParticipantsPanel.tsx`
- `src/process/bridge/services/group/GroupConversationService.ts`
- `src/process/bridge/services/group/discussion/DiscussionGroupRuntime.ts`
- `src/process/bridge/services/group/workflow/WorkflowGroupRuntime.ts`
- `src/process/bridge/services/group/discussion/discussionHelpers.ts`
- `src/process/bridge/services/group/workflow/workflowHelpers.ts`
- `src/common/config/storage.ts`
- `src/common/config/group.ts`
- `src/common/utils/discussionArtifacts.ts`
