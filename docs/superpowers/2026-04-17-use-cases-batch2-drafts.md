# ContextGo Use Cases Batch 2 Drafts

日期：2026-04-17  
分支：`docs/site-ia-review`  
用途：`docs.contextgo.io` 第二批 `Use Cases` 页面草稿  
范围：Batch 2

## 1. Batch 2 范围

这一批补 3 篇页面：

1. `Publish-To-Channel Workflow`
2. `Recommended Starter Modes`
3. `Team And Collaboration Workflow`

Batch 2 的目标不是扩充行业页，而是把 ContextGo 与一般 AI 工具真正拉开差距的几条路径写清楚：

- 不是只自己用，还能发布出去
- 不是只有一种打开方式，而是有一组可直接起步的模式
- 不是只能单 Agent 单线程工作，而是在走向协作型工作流

## 2. 统一写法原则

这一批仍然延续 Batch 1 的写法：

1. Hero
2. This Mode Is For You If...
3. Why ContextGo Fits This Scenario
4. Starter Kit
5. First-Day Workflow
6. When To Level Up
7. Related Docs

另外，这一批有两个额外要求：

- 不要把“发布”和“协作”写成纯概念页，必须让用户知道第一天能做什么
- 明确哪些能力已经稳定，哪些能力仍处于 Preview / Coming Soon

---

## 3. Page Drafts

## 3.1 Publish-To-Channel Workflow

- 中文标题：`发布到渠道的工作流`
- 英文标题：`Publish-To-Channel Workflow`
- slug：`/use-cases/publish-to-channel-workflow`
- 状态：`stable`

### Hero

ContextGo 不只是让你在本地和 Agent 工作。  
它还可以把一个已经能工作的 Agent，发布到多个渠道、多个群组、多个 audience，让它真正变成一个可被外部使用的服务入口。

### This Mode Is For You If...

这一页适合：

- 想把 Agent 用在群聊、团队服务、社群、外部入口里
- 不满足于“我自己在桌面上用”
- 想让一个 Agent 在多个渠道和多个实例里持续服务

这一页不适合：

- 还没有把本地工作流跑顺的用户
- 只想体验单人本地使用的人

### Why ContextGo Fits This Scenario

很多 AI 工具的问题不是“不能聊天”，而是不能真正进入真实渠道。

真正进入渠道后，问题会变成：

- 这个 Agent 服务的是谁
- 一个渠道里有多少入口
- 同一个 Agent 能不能发到多个地方
- 当前是临时接管，还是长期绑定

ContextGo 在这方面的价值，是它把发布当成一层正式产品能力，而不是附加插件。

它不是简单地“接一个 bot”。

它是在构建：

- 渠道入口
- audience 路由
- publication binding
- 长期运营和管理

### Starter Kit

- Recommended Workbench: `Conversation Cowork Workbench`
- Recommended Connectors: `Channel Accounts`, `Publication Targets`, `Audience Routing`
- Recommended Runtime: `Stable service runtime`
- Recommended Agent Package: `Service / Ops / Support package`
- Recommended Skills: `reply`, `routing`, `summary`, `channel-aware tools`
- Recommended Automation: `publication maintenance`, `scheduled updates`, `handoff flows`
- Recommended Publish Path: `required`
- Recommended Remote Mode: `good fit`

### First-Day Workflow

第一天建议只做这 6 步：

1. 先在本地把一个真正能工作的 Agent 跑顺。
2. 只选一个渠道，不要一开始多平台一起上。
3. 先只绑定一个清晰 audience，例如一个测试群组或一个内部入口。
4. 先明确这个入口是“临时试运行”还是“持久发布”。
5. 让这个 Agent 只处理一类明确任务，不要一开始承担过多职责。
6. 观察几轮真实交互，再决定是否扩展到更多 audience。

### When To Level Up

用顺以后再加：

- 同一 Agent 发布到多个 audience
- 同一能力跨多个渠道复用
- schedule 驱动的渠道维护
- 团队协同管理已发布 Agent

先不要一开始就：

- 多渠道同时发布
- 一个 Agent 承担太多不同角色
- 在未跑顺本地流程前直接对外开放

### Related Docs

- `Publish Overview`
- `Channels`
- `Audiences, Threads, Groups`
- `Managing Published Agents`

---

## 3.2 Recommended Starter Modes

- 中文标题：`推荐的开箱模式`
- 英文标题：`Recommended Starter Modes`
- slug：`/use-cases/recommended-starter-modes`
- 状态：`stable`

### Hero

如果你不想先理解完整产品结构，最简单的开始方式不是“自己自由组合”，而是先选一个最贴近自己的 Starter Mode。

Starter Mode 不是限制你，而是帮你跳过第一天最容易混乱的配置阶段。

### This Mode Is For You If...

这一页适合：

- 第一次用 ContextGo
- 看完产品介绍后还是不知道第一步怎么配
- 想先用一套简单组合跑顺，再逐步扩展

这一页不适合：

- 已经非常清楚自己要接哪些 runtime、skills 和 context 的高级用户

### Why ContextGo Fits This Scenario

ContextGo 的能力面比较大。

如果用户第一天就同时面对：

- workbench
- context
- runtime
- skills
- automation
- remote
- publication

很容易理解成“系统很强，但太复杂”。

Starter Mode 的作用，就是先给出一条已经编排好的最短路径，让用户先用起来，再理解系统。

### Starter Mode 1: Solo Cowork Mode

适合：

- 想先体验最基础的单人工作方式

组合：

- Workbench: `Conversation Cowork Workbench`
- Context: `Project Files + Browser Context`
- Runtime: `Any ready runtime`
- Skills: `web`, `docs`, `files`
- Automation: `none`
- Remote: `optional`

### Starter Mode 2: Research Mode

适合：

- 研究、搜集资料、做分析的人

组合：

- Workbench: `Browser Research Workbench`
- Context: `Web Sources + Saved Pages`
- Runtime: `Research-friendly runtime`
- Skills: `web`, `browser`, `extract`, `compare`
- Automation: `topic watch`
- Remote: `good fit`

### Starter Mode 3: Builder Mode

适合：

- 独立开发者、Builder、代码型用户

组合：

- Workbench: `Conversation Cowork Workbench`
- Context: `Project Files + Docs + Browser Context`
- Runtime: `Codex / Claude Code / Gemini / OpenClaw compatible runtime`
- Skills: `coding`, `git`, `test`, `browser`
- Automation: `commands`, `hooks`
- Remote: `good fit`

### Starter Mode 4: Automation Mode

适合：

- 想把重复性工作做成持续流程的人

组合：

- Workbench: `Conversation Cowork Workbench`
- Context: `Project Docs + External Sources`
- Runtime: `Stable general runtime`
- Skills: `schedules`, `commands`, `summary`
- Automation: `required`
- Remote: `strong fit`

### Starter Mode 5: Remote Mode

适合：

- 不想一直盯电脑，但要让任务继续推进的人

组合：

- Workbench: `Conversation Cowork Workbench`
- Context: `Host Runtime + Web / Mobile entry`
- Runtime: `Any stable host runtime`
- Skills: `status`, `summary`, `remote-safe tasks`
- Automation: `scheduled reports`
- Remote: `required`

### Starter Mode 6: Publication Mode

适合：

- 想把 Agent 发到渠道中的人

组合：

- Workbench: `Conversation Cowork Workbench`
- Context: `Publication targets + shared docs`
- Runtime: `Stable service runtime`
- Skills: `reply`, `routing`, `summary`
- Automation: `publication maintenance`
- Remote: `optional`

### First-Day Workflow

第一天建议这样选模式：

1. 只选一个最贴近当前真实任务的 Mode。
2. 不要为了“完整体验”混合多个 Mode。
3. 先跑通一个可重复任务。
4. 再回头看这个 Mode 缺什么，再往上加能力。

### When To Level Up

Starter Mode 的意义是先起步，不是长期把你锁死。

用顺后，你应该逐步做的事是：

- 把更多 context 接进来
- 增加 automation
- 增加 remote
- 在需要时走向 publish 或 collaboration

### Related Docs

- `Use Cases Overview`
- `Bring Your Workflow Into ContextGo`
- `Agent System Overview`
- `Runtime Center`

---

## 3.3 Team And Collaboration Workflow

- 中文标题：`团队与协作工作流`
- 英文标题：`Team And Collaboration Workflow`
- slug：`/use-cases/team-and-collaboration-workflow`
- 状态：`preview`

### Hero

ContextGo 不只是在走向“多个 Agent 一起说话”。  
它更重要的方向，是让复杂任务可以被拆解、分工、评审、迭代，逐步形成真正的协作型工作流。

### This Mode Is For You If...

这一页适合：

- 一个任务明显超出单 Agent 单线程处理范围
- 需要不同角色参与，例如规划、执行、评审
- 希望让任务在共享上下文里持续推进

这一页不适合：

- 只需要一个 Agent 很快做完的小任务
- 还没跑顺单人工作流的用户

### Why ContextGo Fits This Scenario

复杂任务的问题通常不是“没有更强的单个 Agent”，而是：

- 任务需要分阶段
- 不同阶段需要不同角色
- 需要反复评审和修订
- 共享上下文必须保持一致

ContextGo 已经在产品结构上具备这条路线的底盘：

- group container
- parent / child sessions
- shared workspace
- 多 Agent runtime
- Harness 风格 workflow 方向

所以它适合逐步走向更成熟的协作型工作模式。

### Starter Kit

- Recommended Workbench: `Conversation Cowork Workbench`
- Recommended Connectors: `Shared Docs`, `Artifacts`, `Context Surfaces`
- Recommended Runtime: `Multiple complementary runtimes`
- Recommended Agent Package: `Planner / Writer / Evaluator style packages`
- Recommended Skills: `workflow`, `review`, `handoff`, `artifact analysis`
- Recommended Automation: `loop orchestration`, `scheduled review`
- Recommended Publish Path: `optional`
- Recommended Remote Mode: `good fit`

### First-Day Workflow

第一天不要一上来做“大型 Agent 团队”。

建议只做最简单的一种协作实验：

1. 选一个确实需要两种角色的任务。
2. 明确一个角色负责规划，一个角色负责执行。
3. 把上下文和产物都放在共享工作区里。
4. 让规划角色先给出清晰目标和验收标准。
5. 让执行角色只围绕这个标准推进。
6. 最后再加第三种“评审”角色。

### What Is Stable vs Preview

当前适合公开表达为 `preview` 的内容：

- Harness 风格工作流
- planner / writer / evaluator 模式
- 更明确的 agent team 语义

当前可相对稳定表达的内容：

- multi-agent collaboration foundation
- group container
- shared workspace direction

### When To Level Up

这类模式用顺后，再考虑：

- 更长的 workflow loops
- 更强的评审机制
- 多个 runtime 角色分工
- 与发布渠道、自动化、Space context 结合

### Related Docs

- `Collaboration Overview`
- `Multi-Agent Collaboration`
- `Harness-Style Workflows`
- `Group Workflows`
