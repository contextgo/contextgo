# ContextGo 独立文档站产品架构与目录提案

日期：2026-04-17  
分支：`docs/site-ia-review`  
定位：`docs.contextgo.io` 独立产品文档站提案  
文档对象：以产品用户为主，开发者为辅

## 1. 这次提案的起点

这次文档站不应该从“文档框架怎么搭”开始，而应该从“ContextGo 到底是什么产品”开始。

你现在已经把几个关键前提说清楚了：

- 文档站确定走独立站点、独立域名：`docs.contextgo.io`
- 主站 `contextgo.io` 只挂一个 docs 路由入口，跳转或引流到独立文档站
- 部署继续走仓库内 CI/CD，而不是转成第三方平台托管式发布
- 文档对象以产品用户为主，不是以开发者和集成方为主
- 产品的核心定位是：**local-first 的全能型 Agent 工作台**

所以这套文档站的目标，不是做成一个“技术文档仓”。

它应该做成一套面向普通用户的产品说明系统，帮助用户理解：

- ContextGo 为什么和普通 AI chat 工具不同
- 它的核心产品骨架是什么
- 用户如何把已有工作流接进来
- 如何用它在桌面、网页、手机上持续工作
- 如何把 Agent 发布到真实渠道，变成长期可运行的工作系统

## 2. 对产品的重新归纳

基于你补充的产品点，以及仓库里现有实现与架构文档，可以把 ContextGo 概括成下面这句话：

> ContextGo 是一个 desktop-first、local-first、multi-runtime、multi-agent、multi-surface 的 AI Native Workbench。  
> 它不是单纯的聊天客户端，也不是单一代码 Agent 的手机遥控器，而是一个把上下文、工作面、Agent、自动化、发布渠道和多端远程统一起来的长期工作系统。

这句话里有几个非常重要的关键词，它们决定了文档站的主结构。

### 2.1 它是 Workbench，不是 Chat App

从 `docs/superpowers/workbench/2026-04-16-ai-native-workbench-host-design.md` 和 `docs/tech/workbench-space-canvas-ia.md` 可以确认一件事：

- `conversation` 不应该继续充当所有能力的总容器
- `ChatLayout` 只是当前 `conversation-cowork` 工作台的一种实现
- ContextGo 的长期方向是 **AI Native Workbench Host**

也就是说，ContextGo 的主产品对象不是“会话页”，而是“工作台”。

工作台可以有很多种：

- 对话型 cowork 工作台
- 浏览器研究型工作台
- 文档内容工作台
- 文件预览 / 资产工作台
- Space / Context 治理工作台
- 未来按行业和用户习惯变化的专业工作台

这决定了文档站不能只写成“如何聊天”。

### 2.2 它的核心价值不是“养 Agent”，而是“带着需求来解决问题”

这是你刚才强调得最清楚的一点，也是文档首页应该打出来的核心价值：

- 用户不需要先学会一整套 Agent 养成逻辑
- 用户也不需要把自己训练成高级 prompt engineer
- 用户是带着任务、材料、上下文和目标进来
- ContextGo 负责把这些东西组织成一个可持续工作的系统

这和很多产品的差异在于：

- 别的产品强调“某个 Agent 很强”
- ContextGo 应该强调“你的工作系统能被组织起来”

### 2.3 它的真正核心不是单个 Agent，而是 Context Layer

从你强调的优先级和现有架构文档看，真正最重要的能力不是单个 runtime，而是：

- `Context Connector`
- `Context Engine`
- `Space`
- `Docs / Canvas / Artifact / Source`
- project / session / space 三层上下文

这一层决定了：

- 用户原有工作流能不能完整接进来
- Agent 是否能真正理解用户的长期工作上下文
- 工作是否能跨会话、跨设备、跨渠道延续

所以文档站必须把 Context 这一层抬到产品主轴，而不是把它当作“高级功能”。

### 2.4 它是多 runtime、多协议、多 Agent 的适配系统

从代码和已有文档看，ContextGo 的 runtime 不是单一路线，而是一个适配层：

- coding runtime：Codex、Claude Code、Gemini、OpenClaw 等
- 一般模型 provider：OpenAI、Anthropic、Gemini、Qwen、本地模型等
- 协议与运行时状态管理
- runtime 与 assistant / package / automation 的拆分

但对产品用户而言，文档不能把这一层写成“协议文档中心”。

对用户更好的表达应该是：

- 模型中心
- 运行时中心
- 支持哪些 Agent 工作方式
- 已安装 / 已登录 / 已就绪是什么意思

也就是说，文档里需要把技术协议翻译成用户可理解的产品语言。

### 2.5 它不是只在本地跑，也不是云端替代本地

从 `docs/tech/mobile-remote-control.md` 和 `docs/tech/mobile-shell-readiness.md` 可以确认：

- 桌面主机仍然是执行权威
- Web 和手机是远程使用面 / 控制面
- iPhone、Android、HarmonyOS 都应复用相同的远程体验
- Linux 既可以做 Host Runtime，也可以跑 CLI
- 手机选文件，最终也是上传到桌面主机去处理

这意味着 ContextGo 的多端逻辑，不是“移动端也有一套独立产品”，而是：

> 一个 Host Runtime，多种远程使用面。

这也是公开文档必须讲清楚的产品边界。

### 2.6 它不只是“自己用”，还要支持发布到真实渠道

从 `docs/plans/2026-03-29-im-agent-publication-platform-design.md` 可以看到，ContextGo 的另外一条重要主轴是：

- 一个 Agent 可以被发布到多个 IM 渠道
- 一个渠道下可以有多个 audience / thread / topic / group
- 一个 Agent 可以对应多个发布实例
- 渠道不是插件页，而是 publication operations layer

这意味着 ContextGo 不只是“我和我的 Agent 对话”。

它还在走向：

- agent publication platform
- IM-native service surface
- 可运营的外部分发系统

这部分必须成为文档站的重要一级模块。

### 2.7 它不是单人对话系统，而是在走向 Harness / Group / Team Workflow

从 `docs/plans/2026-03-28-agent-team-workflow-design.md` 可以看出：

- 当前已有 parent group + child conversations 的协作底盘
- 正在从 discussion group 往 workflow / harness / planner-writer-evaluator 方向演进
- 未来会承接更明确的 agent collaboration 和 team workflow

因此，文档里应该把“协作”和“群组工作流”单独放成一条产品线，而不是放到某个“高级技巧”里。

## 3. 我建议对外如何定义 ContextGo

如果是对用户说一句话，我建议文档站首页的产品定义可以收敛成这版：

> ContextGo 是一个面向普通人的 local-first AI Native Workbench。  
> 你不需要先去养 Agent，只需要把需求、材料和工作流带进来，ContextGo 会把上下文、工作台、Agent、自动化、渠道发布和多端远程组织成一个可持续工作的系统。

如果要再往下拆成正式产品骨架，我建议用 7 条主轴来表达。

## 4. ContextGo 的 7 条产品主轴

这 7 条主轴应该成为文档站的真正目录骨架。

### 4.1 AI Native Workbench

这是产品的工作面主轴。

它回答：

- 用户在哪里开始工作
- 不同工作类型为什么不该都挤进一个聊天布局
- 为什么 ContextGo 是工作台，不是单纯会话页

对应实现和设计锚点：

- `docs/superpowers/workbench/2026-04-16-ai-native-workbench-host-design.md`
- `docs/tech/workbench-space-canvas-ia.md`

### 4.2 Context System

这是产品最核心的长期价值主轴。

它包含：

- Context Connector
- Context Engine
- Space
- Source / Artifact / Memory / Profile / Context Pack
- project / session / space 三层上下文

对应锚点：

- `docs/tech/context-engine-event-architecture.md`
- `packages/context-engine/docs/domain-model.md`
- `packages/context-engine/docs/reference-landscape.md`
- `docs/superpowers/specs/2026-04-16-context-engine-dual-loop-architecture-design.md`
- `docs/superpowers/specs/2026-04-16-context-engine-governance-runtime-protocol-design.md`
- `docs/tech/space-model.md`

### 4.3 Agent Runtime Layer

这是“多 Agent / 多模型 / 多协议适配”的主轴。

它包含：

- 模型中心
- 运行时中心
- runtime state
- provider 连接
- code agent 适配
- browser / computer use / tool use

对应实现和 UI 锚点：

- `src/renderer/components/settings/SettingsModal/contents/ModelModalContent.tsx`
- `src/renderer/pages/conversation/platforms/*`
- `src/process/bridge/*`

### 4.4 Capability Layer

这是“用户如何给系统装能力”的主轴。

它包含：

- Agent Package
- 内置 assistants
- Skill Market
- skills / hooks / commands / schedules
- 自动化能力的装配和治理

对应锚点：

- `docs/tech/agent-package-architecture.md`
- `docs/superpowers/specs/2026-04-16-project-skill-market-entry-design.md`
- `src/renderer/pages/settings/AgentSettings/Workspace/*`

### 4.5 Publication Layer

这是“把 Agent 发布到真实世界”的主轴。

它包含：

- Channels
- Connector accounts / channel instances
- audiences
- publication bindings
- one agent to many audiences
- one agent across many channels

对应锚点：

- `docs/plans/2026-03-29-im-agent-publication-platform-design.md`
- `src/process/channels/core/ChannelRouteResolver.ts`
- `src/process/channels/agent/ChannelMessageService.ts`

### 4.6 Collaboration Layer

这是“从单人执行走向团队和 harness workflow”的主轴。

它包含：

- multi-agent collaboration
- group orchestration
- harness-style workflow
- planner / writer / evaluator 类工作流
- 未来 agent team

对应锚点：

- `docs/plans/2026-03-28-agent-team-workflow-design.md`
- `docs/plans/2026-03-26-multi-agent-discussion-group-design.md`

### 4.7 Host Runtime + Official Remote

这是多端与远程主轴。

它包含：

- desktop host
- web client
- mobile shells
- Linux host / CLI
- remote control model
- 上传与执行边界

对应锚点：

- `docs/tech/mobile-remote-control.md`
- `docs/tech/mobile-shell-readiness.md`
- `docs/tech/mobile-shell-cmd.md`

## 5. 还缺的一层：Use Cases / Playbooks

你刚补的这个点非常重要，而且它不只是“加几个案例页”。

对于以产品用户为主的文档站来说，除了产品架构文档，还必须有一层：

- `Use Cases`
- `Starter Modes`
- `Playbooks`

这层的作用不是解释产品本身，而是回答：

- 我到底可以拿 ContextGo 来做什么
- 我属于哪类用户，应该从哪种工作台模式开始
- 不同行业、不同行为习惯的人，第一种“打开方式”分别是什么

这层文档尤其重要，因为 ContextGo 的能力面比较大：

- workbench
- context system
- runtimes
- skills
- automation
- publication
- remote

如果没有 use-case 层，普通用户会理解“系统很强”，但不知道“我第一天应该怎么用”。

所以独立文档站必须同时有两套入口：

1. 按产品模块进入
2. 按使用场景进入

### 5.1 为什么这层必须单独存在

因为 ContextGo 不是单一功能产品，它更像一个“工作系统底座”。

这类产品最容易出现的问题是：

- 架构很完整
- 能力很强
- 但用户不知道第一步怎么把它变成自己的工作方式

所以 use-case 文档必须承担一种“产品翻译层”的作用，把核心架构翻译成场景化打开方式。

### 5.2 这层应该怎么组织

我建议不要只按“行业”来切。

更合适的是两层：

#### 第一层：按工作目标切

这是最容易让普通用户进入的方式。

例如：

- 写内容
- 做研究
- 处理文件
- 跑自动化
- 管理项目
- 发布到渠道
- 多端远程办公

#### 第二层：按角色/行业切

这是帮助用户快速对号入座的方式。

例如：

- 开发者 / 独立开发者
- 产品经理
- 内容创作者
- 运营 / 社媒运营
- 销售 / 商务
- 咨询 / 分析师
- 教育 / 培训
- 团队负责人

这样做的好处是：

- 不会把产品限制成几个行业模板
- 也能保留“我和我很像的人是怎么用的”这层共鸣

### 5.3 这层文档里每篇应该长什么样

每篇 use-case 文档建议固定结构：

1. 这个场景是什么
2. 为什么 ContextGo 适合它
3. 推荐的工作台打开方式
4. 推荐接入的 Context Connector
5. 推荐的 Agent Package / Skills / Runtime
6. 推荐的自动化方式
7. 是否适合发布到渠道
8. 是否适合手机远程接入
9. 一个从零开始的最短路径

这样它就不只是“营销案例页”，而是真正能指导用户开箱使用的 page type。

## 6. 文档站的顶层结构建议

既然文档对象以产品用户为主，顶层不要按“Guide / Reference / API”来分。

我建议 `docs.contextgo.io` 顶层直接按产品主轴来组织：

1. Start Here
2. Use Cases
3. Workbench
4. Context
5. Agents & Capabilities
6. Publish
7. Collaboration
8. Remote & Devices
9. Manage
10. Advanced

其中：

- 前 8 个是产品用户主文档
- `Advanced` 放少量高级概念和轻量开发者内容

## 7. 首页应该怎么组织

首页不应该只是一个“文档列表页”。

它应该直接回答 4 个问题：

1. ContextGo 是什么
2. 为什么它不是普通 AI 聊天工具
3. 它有哪些核心产品模块
4. 我应该从哪条场景路径开始

### 首页建议结构

#### Hero

标题建议：

`ContextGo Documentation`

副标题建议：

`Local-first 的 AI Native Workbench，帮助你把上下文、工作台、Agent、自动化、渠道发布和多端远程组织成一个可持续工作的系统。`

#### 第一屏三个核心价值卡片

1. `不用先养 Agent`
2. `把你的工作流完整接进来`
3. `桌面主机驱动，网页和手机随时接入`

#### 第二屏产品地图

用 7 个产品主轴做入口卡片：

- Workbench
- Context System
- Runtime Layer
- Capability Layer
- Publish
- Collaboration
- Remote

#### 第三屏使用场景入口

建议直接放开箱即用入口卡片：

- 我想把工作流接进来
- 我想做内容 / 文档 / 研究
- 我想做自动化
- 我想把 Agent 发布出去
- 我想用手机远程持续工作

#### 第四屏用户起步路径

三条入口：

1. `我是第一次使用`
2. `我想把已有工作流接进来`
3. `我想把 Agent 发布出去`

#### 第五屏状态/预览区

列出：

- 已稳定能力
- 正在演进能力
- Preview / Coming Soon 能力

这样能避免文档站对未完全发版的功能过度承诺。

## 8. 完整目录结构与逐篇文档摘要

下面这一版，是按“产品用户优先”重做后的完整文档树。

---

## A. Start Here

这是“第一次进入 docs 站”的路径。

### 1. What Is ContextGo / 什么是 ContextGo

摘要：
定义 ContextGo 的产品定位。强调它是 local-first 的 AI Native Workbench，不是普通聊天产品，也不是单一代码 Agent 的外壳。

### 2. Why ContextGo Feels Different / 它和普通 AI 工具有什么不同

摘要：
解释 ContextGo 的核心价值不是“一个更强的 Agent”，而是把上下文、工作面、自动化、发布和多端远程组织在一起。

### 3. Quick Start / 快速开始

摘要：
安装桌面端、登录账号、准备第一台主机、跑通第一条任务、确认网页和手机端都能接入。

### 4. Choose Your Setup / 选择你的使用方式

摘要：
帮助用户区分本地单机、桌面 + 浏览器、桌面 + 手机、Linux Host、发布到渠道等几种典型使用方式。

### 5. Product Map / 产品地图

摘要：
用一张清晰的结构图讲明 Workbench、Context、Agents、Publish、Remote、Space、Collaboration 之间的关系。

---

## B. Use Cases

这是“普通用户最容易进入产品”的场景文档区。

### 1. Use Cases Overview / 使用场景总览

摘要：
解释为什么 ContextGo 不只是一个功能列表，而是一套可以按场景打开的工作系统。

### 2. Bring Your Workflow Into ContextGo / 把你的工作流接进 ContextGo

摘要：
给第一次理解产品价值的用户一个总入口，说明如何把已有材料、网页、文档、系统和任务流带进来。

### 3. Content And Writing Studio / 内容与写作工作室

摘要：
面向内容创作者、写作者、知识工作者，说明如何用 ContextGo 组织资料、写作、修订、发布和持续工作。

### 4. Research And Browser Workflow / 研究与浏览器工作流

摘要：
面向研究、信息搜集、竞品分析、学习型场景，说明如何把浏览器、网页上下文、资料整理和 Agent 工作结合起来。

### 5. Coding And Builder Workflow / 开发与构建工作流

摘要：
面向独立开发者和产品构建者，说明如何把 code agent、runtime、文件、浏览器、上下文和自动化组织成持续开发环境。

### 6. Operations And Automation Workflow / 运营与自动化工作流

摘要：
面向运营、执行、例行任务场景，说明如何用 schedules、hooks、commands 和远程控制做持续自动化。

### 7. Publish-To-Channel Workflow / 渠道发布型工作流

摘要：
面向社群运营、服务型 Agent、团队内分发场景，说明如何把 Agent 发到多个渠道和多个 audience。

### 8. Personal Remote Workbench / 个人远程工作台

摘要：
面向“我不想一直盯着电脑”的用户，说明如何把桌面主机、网页端和手机端组织成真正可持续使用的远程系统。

### 9. Team And Collaboration Workflow / 团队与协作工作流

摘要：
面向团队负责人和多角色工作流，说明 Group、Harness 风格工作流和未来 Agent Teams 的使用方式。

### 10. Recommended Starter Modes / 推荐的开箱模式

摘要：
给不同用户一个最短起步建议，把“推荐工作台 + 推荐 connector + 推荐 package + 推荐 runtime + 推荐自动化方式”组合成开箱方案。

---

## C. Workbench

这是“ContextGo 为什么是工作台”的主文档区。

### 1. AI Native Workbench Overview / AI Native Workbench 总览

摘要：
说明为什么 ContextGo 不该收敛成单一 `ChatLayout`，为什么工作台才是主产品对象。

### 2. Conversation Cowork Workbench / 对话型 Cowork 工作台

摘要：
介绍当前最成熟的工作台类型：对话、执行流、审批、预览、文件结果、运行时反馈等。

### 3. Browser Research Workbench / 浏览器研究工作台

摘要：
说明浏览器上下文、网页研究、Browser Context、页面内容与 Agent 任务之间的关系。

### 4. Computer Use And Browser Actions / Computer Use 与浏览器操作

摘要：
解释 ContextGo 对 browser actions / computer use 的支持范围，以及这些能力如何进入正常工作流。

### 5. File And Artifact Workbench / 文件与产物工作面

摘要：
说明预览、生成、编辑、追踪文件结果的体验，包括文档、代码、图片、音视频等。

### 6. Future Workbench Modes / 更多工作台模式

摘要：
说明文档型、图像型、视频型、音乐型、行业工作台等方向，但明确哪些已经稳定、哪些还是演进方向。

---

## D. Context

这是 ContextGo 最核心、也最差异化的文档区。

### 1. Context System Overview / 上下文系统总览

摘要：
先用用户语言讲清楚 ContextGo 为什么不是“历史消息拼接”，而是一个长期上下文系统。

### 2. Context Connector / Context Connector 是什么

摘要：
解释 Context Connector 为什么是产品核心，它如何把你原来的工作流、产品、来源、浏览器行为和外部资料接进 ContextGo。

### 3. Bringing Your Existing Workflow In / 把你原来的工作流接进来

摘要：
用任务视角说明 Connector 的价值，不讲底层架构，重点讲“原来的产品、文档、网页、操作流怎么进来”。

### 4. Context Engine / Context Engine

摘要：
解释 Context Engine 的职责：它不是隐藏数据库，而是负责上下文形成、压缩、提炼、组装和持续演化。

### 5. Session, Project, Space / Session、Project、Space 三层上下文

摘要：
解释 session、project、space 三层边界，帮助用户理解“当前上下文”和“长期上下文”的区别。

### 6. Memory, Profile, Context Pack / 记忆、画像与 Context Pack

摘要：
介绍 memory、profile、context pack 的产品含义，用用户语言替代内部引擎术语。

### 7. Context Reviews And Governance / 上下文审核与治理

摘要：
说明 candidate memory、promotion、proposal、review 这些治理行为为什么存在，以及用户如何理解它们。

---

## E. Agents & Capabilities

这是“系统怎么获得能力”的主文档区。

### 1. Agent System Overview / Agent 系统总览

摘要：
讲清楚 Agent、Assistant、Runtime、Package 之间的关系。

### 2. Agent Packages / Agent Package

摘要：
解释为什么 ContextGo 里 Assistant 不是简单 preset，而是 Agent Package；它如何承载规则、技能、hooks、commands、schedules 和文档。

### 3. Built-in Assistants / 内置助手

摘要：
介绍开箱即用的助手和它们适合的工作类型。

### 4. Skill Market / 技能市场

摘要：
解释 Skill Market 的产品角色：不是设置页附件，而是项目和工作流获取能力的入口。

### 5. Skills / Skills

摘要：
解释 skill 是什么、什么时候用、怎么启用和停用、它如何扩展工作能力。

### 6. Hooks, Commands, Schedules / Hooks、Commands、Schedules

摘要：
解释三种自动化能力的区别，以及它们和 Agent Package 的关系。

### 7. Model Center / 模型中心

摘要：
面向用户讲模型与 provider 的选择，而不是协议细节。说明云模型、本地模型、API Key 和使用体验的关系。

### 8. Runtime Center / 运行时中心

摘要：
面向用户讲 Codex、Claude Code、Gemini、OpenClaw 及其他 runtime 的接入和状态管理。

### 9. Installed, Signed In, Ready / 已安装、已登录、已就绪

摘要：
专门解释 runtime 状态，避免用户把“安装好了”和“真的可以跑”混为一谈。

### 10. Browser, Tools, And Runtime Actions / 浏览器、工具与运行时动作

摘要：
把 tool use、browser actions、runtime actions 放在一起说明，帮助用户理解 Agent 真实能做什么。

---

## F. Publish

这是 ContextGo 从“自己用”走向“对外发布”的主文档区。

### 1. Publish Overview / 发布总览

摘要：
介绍为什么 ContextGo 不只是本地 Agent 工作台，还可以成为对外服务入口。

### 2. Channels / 渠道

摘要：
说明 Channels 不是简单插件设置，而是 agent publication operations layer。

### 3. Channel Accounts And Instances / 渠道账号与实例

摘要：
解释 connector account、channel instance、平台入口之间的关系。

### 4. Audiences, Threads, Groups / Audience、Thread 与群组

摘要：
解释为什么一个渠道里会有多个 audience / topic / thread / group，以及发布绑定如何作用在这些对象上。

### 5. Publish One Agent To Many Places / 一个 Agent 发布到多个地方

摘要：
说明一个 Agent 如何同时服务多个渠道、多个群组、多个实例。

### 6. Temporary Override And Durable Publication / 临时接管与持久发布

摘要：
解释 durable publication 和 temporary override 的区别，帮助用户理解“当前谁在服务这个入口”。

### 7. Managing Published Agents / 管理已发布的 Agent

摘要：
说明如何查看、调整、迁移和运营已发布的 Agent。

---

## G. Collaboration

这是多 Agent、Harness 和未来团队协作的主文档区。

### 1. Collaboration Overview / 协作总览

摘要：
说明 ContextGo 不只支持单 Agent，而是在走向更明确的协作工作模式。

### 2. Multi-Agent Collaboration / 多 Agent 协作

摘要：
解释多个 Agent 如何围绕一个任务协作，当前稳定支持的模式是什么。

### 3. Harness-Style Workflows / Harness 风格工作流

摘要：
把 planner / writer / evaluator 这类协作模型翻译成产品语言。

### 4. Group Workflows / Group 工作流

摘要：
解释 parent group、child sessions、shared workspace 这类结构，帮助用户理解协作底盘。

### 5. Agent Teams / Agent Teams

摘要：
明确标注为 Preview 或 Coming Soon，说明未来会支持更明确的 agent team 概念，但避免过度承诺。

---

## H. Remote & Devices

这是多端、远程和 Host Runtime 模型的主文档区。

### 1. Remote Access Overview / 远程访问总览

摘要：
解释 Host Runtime + Official Remote + client shells 的产品模型。

### 2. Desktop Host / 桌面主机

摘要：
解释为什么桌面端是执行权威，主机在线状态为什么决定整个系统的可用性。

### 3. Web Client / 网页端

摘要：
说明浏览器入口、设备打开、登录、状态查看与任务控制。

### 4. Mobile Shells / 手机端

摘要：
说明 iPhone、Android、HarmonyOS 作为远程客户端的角色，而不是本地主机替代品。

### 5. Linux Host And CLI / Linux Host 与 CLI

摘要：
说明 Linux 在整个产品中的定位，特别是作为 Host Runtime 与 CLI 运行面。

### 6. Uploads, Files, And Host Processing / 上传、文件与主机处理

摘要：
明确手机选文件、网页上传、桌面处理之间的边界。

### 7. Same Experience Across Devices / 跨设备一致体验

摘要：
说明为什么 ContextGo 追求“和桌面端一样的远程体验”，而不是做成一套完全不同的移动产品。

---

## I. Manage

这是面向日常使用和排障的主文档区。

### 1. Account And Devices / 账号与设备

摘要：
讲清登录、设备绑定、设备状态、设备发现和账号关系。

### 2. Settings Guide / 设置指南

摘要：
从用户视角整理设置项，而不是按内部模块组织。

### 3. Updates / 更新

摘要：
只讲用户需要知道的更新路径、版本查看方式和更新入口，不把 release 仓库细节写成正文主叙事。

### 4. Security And Permissions / 安全与权限

摘要：
解释本地权限、远程访问、运行时权限和设备权限边界。

### 5. Troubleshooting / 故障排查

摘要：
用症状组织问题，而不是按内部系统组件组织。

### 6. FAQ / 常见问题

摘要：
整理最常见的用户疑问，比如“为什么手机不能离线代替桌面主机”“为什么 runtime 显示 installed 但不能用”等。

---

## J. Advanced

这是少量高级内容区，不作为主用户入口。

### 1. Context Architecture Deep Dive / 上下文架构深入说明

摘要：
给高阶用户解释 Context Engine、dual-loop、governance identities 等设计，但不作为普通用户起步页。

### 2. Runtime Compatibility / 运行时兼容性

摘要：
解释不同 runtime 的兼容边界、能力差异和 protocol 相关概念。

### 3. Publication Model Deep Dive / 发布模型深入说明

摘要：
给高级用户讲 connector account、audience、publication binding、runtime session 的关系。

### 4. Product Glossary / 术语表

摘要：
统一解释 Workbench、Space、Context Connector、Context Engine、Agent Package、Publication、Audience、Host Runtime 等术语。

### 5. Developer Appendix / 开发者附录

摘要：
只保留极少量入口，把开发者引导到仓库文档或代码，不让开发文档抢占主站结构。

## 9. Use Cases 这层最关键的写法建议

这一层最容易写偏，必须提前定规则。

### 9.1 不要写成营销案例页

Use-case 页不能只是：

- 某某行业也能用
- 某某人也适合
- 某某场景效率更高

如果只是这样，它就没有文档价值。

### 9.2 要写成“推荐打开方式”

每篇都应该给出非常具体的建议：

- 推荐从哪个 workbench 进入
- 推荐先接入哪几类 context
- 推荐用哪个 runtime
- 推荐装哪几类 skills
- 推荐是否加自动化
- 推荐是否适合发布到渠道
- 推荐是否适合远程多端

### 9.3 可以加一类“Starter Kit”结构

每篇 use-case 页面都可以有一个固定区块：

`Starter Kit`

里面直接列：

- `Recommended Workbench`
- `Recommended Connectors`
- `Recommended Runtime`
- `Recommended Agent Package`
- `Recommended Skills`
- `Recommended Automation`
- `Recommended Publish Path`

这会非常贴合你说的“开箱即用的打开方式”。

### 9.4 先按高频工作方式写，不要一开始就写很多行业

建议第一批 use-case 页优先写：

1. 内容与写作
2. 研究与浏览器工作流
3. 开发与构建
4. 运营与自动化
5. 发布到渠道
6. 个人远程工作台

这几类覆盖的人群和心智最广，而且最能体现产品差异。

## 10. Use Cases 逐篇拆解

下面这部分把 `Use Cases` 直接拆到可执行粒度。

建议每篇页面都固定包含：

- 正式标题
- URL slug
- 目标用户
- 一句话价值承诺
- 推荐打开方式
- Starter Kit
- 首批上线优先级

### 10.1 Use Cases Overview

- 正式标题：
  - 中文：`使用场景总览`
  - 英文：`Use Cases Overview`
- slug：`/use-cases/`
- 目标用户：
  - 第一次进入文档站，但不想先读产品架构的人
- 一句话价值承诺：
  - 用场景而不是功能列表，帮用户找到最适合自己的第一种打开方式。
- 页面结构：
  - ContextGo 适合哪些工作类型
  - 按工作目标浏览
  - 按角色浏览
  - 推荐 Starter Modes
  - 下一步该去哪
- 优先级：`P0`
- 状态：`stable`

### 10.2 Bring Your Workflow Into ContextGo

- 正式标题：
  - 中文：`把你的工作流接进 ContextGo`
  - 英文：`Bring Your Workflow Into ContextGo`
- slug：`/use-cases/bring-your-workflow-into-contextgo`
- 目标用户：
  - 已经有自己的网页、文档、文件夹、外部系统、聊天渠道，但不清楚怎么接入 ContextGo 的用户
- 一句话价值承诺：
  - 不用从零换工作方式，先把你原来就在用的材料和流程接进来。
- 推荐打开方式：
  - 从 `Context Connector` 和 `Conversation Cowork Workbench` 开始
- Starter Kit：
  - `Recommended Workbench`: `Conversation Cowork Workbench`
  - `Recommended Connectors`: `Browser Context`, `Files`, `Project Docs`, `External Sources`
  - `Recommended Runtime`: `Any ready runtime`
  - `Recommended Agent Package`: `General Cowork package`
  - `Recommended Skills`: `web`, `docs`, `file`, `browser`
  - `Recommended Automation`: `none at first`
  - `Recommended Publish Path`: `not required`
- 页面结构：
  - 什么叫“接入工作流”
  - 先接入什么，不要一开始全接
  - 文件、网页、外部来源分别怎么进来
  - 第一天的最短接入路径
- 优先级：`P0`
- 状态：`stable`

### 10.3 Content And Writing Studio

- 正式标题：
  - 中文：`内容与写作工作室`
  - 英文：`Content And Writing Studio`
- slug：`/use-cases/content-and-writing-studio`
- 目标用户：
  - 内容创作者、写作者、公众号/博客作者、知识工作者、研究型表达者
- 一句话价值承诺：
  - 把资料、提纲、草稿、改写、发布准备组织到同一个持续工作的写作系统里。
- 推荐打开方式：
  - `Conversation Cowork Workbench` + `File And Artifact Workbench`
- Starter Kit：
  - `Recommended Workbench`: `Conversation Cowork Workbench`
  - `Recommended Connectors`: `Browser Context`, `Project Docs`, `Writing Sources`
  - `Recommended Runtime`: `General-purpose writing runtime`
  - `Recommended Agent Package`: `Writing / Research oriented package`
  - `Recommended Skills`: `web`, `markdown`, `docs`, `citation`, `summary`
  - `Recommended Automation`: `scheduled review`, `daily digest`, `outline refresh`
  - `Recommended Publish Path`: `optional`
- 页面结构：
  - 适合哪些写作工作
  - 资料如何进入上下文
  - 草稿怎么持续迭代
  - 如何让 Agent 参与修订而不是替代判断
  - 如何把“写作”变成持续工作流
- 优先级：`P0`
- 状态：`stable`

### 10.4 Research And Browser Workflow

- 正式标题：
  - 中文：`研究与浏览器工作流`
  - 英文：`Research And Browser Workflow`
- slug：`/use-cases/research-and-browser-workflow`
- 目标用户：
  - 做研究、搜资料、竞品分析、学习整理、行业扫描的人
- 一句话价值承诺：
  - 把浏览器、网页上下文、采集资料和 Agent 分析变成一个连续系统，而不是标签页地狱。
- 推荐打开方式：
  - `Browser Research Workbench`
- Starter Kit：
  - `Recommended Workbench`: `Browser Research Workbench`
  - `Recommended Connectors`: `Browser Activity`, `Web Sources`, `Saved Pages`
  - `Recommended Runtime`: `Research-friendly runtime`
  - `Recommended Agent Package`: `Research / Analyst package`
  - `Recommended Skills`: `web`, `browser`, `extract`, `compare`, `summarize`
  - `Recommended Automation`: `periodic scans`, `topic watch`, `digest generation`
  - `Recommended Publish Path`: `optional`
- 页面结构：
  - 浏览器上下文为什么重要
  - 如何从浏览器直接发起任务
  - 网页内容如何变成长期上下文
  - 研究结果如何沉淀成可复用资料
- 优先级：`P0`
- 状态：`stable`

### 10.5 Coding And Builder Workflow

- 正式标题：
  - 中文：`开发与构建工作流`
  - 英文：`Coding And Builder Workflow`
- slug：`/use-cases/coding-and-builder-workflow`
- 目标用户：
  - 独立开发者、技术产品人、构建者、代码型 Agent 用户
- 一句话价值承诺：
  - 把 code agent、项目上下文、浏览器、文件和自动化接成一个长期可工作的构建环境。
- 推荐打开方式：
  - `Conversation Cowork Workbench` + `File And Artifact Workbench`
- Starter Kit：
  - `Recommended Workbench`: `Conversation Cowork Workbench`
  - `Recommended Connectors`: `Project Files`, `Browser Context`, `Project Docs`
  - `Recommended Runtime`: `Codex / Claude Code / Gemini / OpenClaw compatible runtime`
  - `Recommended Agent Package`: `Engineering / Builder package`
  - `Recommended Skills`: `coding`, `git`, `test`, `browser`, `docs`
  - `Recommended Automation`: `hooks`, `commands`, `scheduled checks`
  - `Recommended Publish Path`: `not required`
- 页面结构：
  - 如何理解 code runtime 和 ContextGo 的关系
  - 项目上下文为什么比单次 prompt 更重要
  - 如何把浏览器和代码工作串起来
  - 自动化适合加在哪些环节
- 优先级：`P0`
- 状态：`stable`

### 10.6 Operations And Automation Workflow

- 正式标题：
  - 中文：`运营与自动化工作流`
  - 英文：`Operations And Automation Workflow`
- slug：`/use-cases/operations-and-automation-workflow`
- 目标用户：
  - 运营、执行、流程管理、例行任务密集型用户
- 一句话价值承诺：
  - 把日常重复工作变成有上下文、有状态、可被远程管理的自动化流程。
- 推荐打开方式：
  - `Conversation Cowork Workbench` + `Automation surfaces`
- Starter Kit：
  - `Recommended Workbench`: `Conversation Cowork Workbench`
  - `Recommended Connectors`: `Project Docs`, `External Sources`, `Channel Targets`
  - `Recommended Runtime`: `Stable general runtime`
  - `Recommended Agent Package`: `Operations / Automation package`
  - `Recommended Skills`: `schedules`, `commands`, `summaries`, `notifications`
  - `Recommended Automation`: `schedules + hooks + commands`
  - `Recommended Publish Path`: `optional`
- 页面结构：
  - 哪些工作适合先自动化
  - schedules、hooks、commands 各自适合什么
  - 失败后怎么恢复
  - 如何从“单次任务”升级为“例行流程”
- 优先级：`P0`
- 状态：`stable`

### 10.7 Publish-To-Channel Workflow

- 正式标题：
  - 中文：`发布到渠道的工作流`
  - 英文：`Publish-To-Channel Workflow`
- slug：`/use-cases/publish-to-channel-workflow`
- 目标用户：
  - 社群运营、服务型 Agent、内部工具分发、团队知识服务场景
- 一句话价值承诺：
  - 把本地可工作的 Agent 变成能服务多个渠道、多个群组、多个 audience 的发布系统。
- 推荐打开方式：
  - `Publish` surfaces + `Conversation Cowork Workbench`
- Starter Kit：
  - `Recommended Workbench`: `Conversation Cowork Workbench`
  - `Recommended Connectors`: `Channel accounts`, `Publication targets`
  - `Recommended Runtime`: `Stable service runtime`
  - `Recommended Agent Package`: `Service / Support / Ops package`
  - `Recommended Skills`: `reply`, `routing`, `summary`, `channel-aware tools`
  - `Recommended Automation`: `publication maintenance`, `schedule-based status updates`
  - `Recommended Publish Path`: `required`
- 页面结构：
  - 什么情况下需要“发布”而不是“自己用”
  - audience、group、thread 有什么区别
  - 一个 Agent 怎么发到多个地方
  - 如何运营已发布 Agent
- 优先级：`P0`
- 状态：`stable`

### 10.8 Personal Remote Workbench

- 正式标题：
  - 中文：`个人远程工作台`
  - 英文：`Personal Remote Workbench`
- slug：`/use-cases/personal-remote-workbench`
- 目标用户：
  - 不想一直守在电脑前，但希望工作持续进行的人
- 一句话价值承诺：
  - 让桌面主机持续工作，让你在网页和手机端随时接入、查看、控制和继续任务。
- 推荐打开方式：
  - `Remote Access Overview` + `Mobile Shells`
- Starter Kit：
  - `Recommended Workbench`: `Conversation Cowork Workbench`
  - `Recommended Connectors`: `Host Runtime`, `Mobile uploads`, `Web entry`
  - `Recommended Runtime`: `Any stable host runtime`
  - `Recommended Agent Package`: `General Cowork package`
  - `Recommended Skills`: `remote-safe tasks`, `summaries`, `status checks`
  - `Recommended Automation`: `scheduled reports`, `async follow-up`
  - `Recommended Publish Path`: `optional`
- 页面结构：
  - 远程不等于换一套产品
  - 主机、网页、手机分别做什么
  - 文件如何从手机进入主机
  - 如何建立“我不盯电脑也能推进”的使用方式
- 优先级：`P0`
- 状态：`stable`

### 10.9 Team And Collaboration Workflow

- 正式标题：
  - 中文：`团队与协作工作流`
  - 英文：`Team And Collaboration Workflow`
- slug：`/use-cases/team-and-collaboration-workflow`
- 目标用户：
  - 团队负责人、多角色协作场景、希望把工作拆给多个 Agent 或多人共同推进的用户
- 一句话价值承诺：
  - 用 Group、Harness 风格工作流和共享上下文，把复杂任务从单线程推进升级成协作推进。
- 推荐打开方式：
  - `Collaboration` surfaces + `Space`
- Starter Kit：
  - `Recommended Workbench`: `Conversation Cowork Workbench`
  - `Recommended Connectors`: `Shared docs`, `Artifacts`, `Context surfaces`
  - `Recommended Runtime`: `Multiple complementary runtimes`
  - `Recommended Agent Package`: `Planner / Writer / Evaluator style packages`
  - `Recommended Skills`: `review`, `handoff`, `workflow`, `artifact analysis`
  - `Recommended Automation`: `loop orchestration`, `scheduled review`
  - `Recommended Publish Path`: `optional`
- 页面结构：
  - 什么任务适合协作，不适合单 Agent
  - group workflow 和普通聊天的区别
  - Harness 风格工作流怎么理解
  - 哪些能力还是 preview
- 优先级：`P1`
- 状态：`preview`

### 10.10 Recommended Starter Modes

- 正式标题：
  - 中文：`推荐的开箱模式`
  - 英文：`Recommended Starter Modes`
- slug：`/use-cases/recommended-starter-modes`
- 目标用户：
  - 不想先理解全部架构，只想立即开始的人
- 一句话价值承诺：
  - 直接给你一组可以开箱使用的 ContextGo 起步组合。
- 页面结构：
  - 按用户类型选 starter mode
  - 每种 mode 的工作台、connector、runtime、package、skills 组合
  - 第一天做什么
  - 一周后再加什么
- 推荐 starter modes：
  - `Solo Cowork Mode`
  - `Research Mode`
  - `Builder Mode`
  - `Automation Mode`
  - `Remote Mode`
  - `Publication Mode`
- 优先级：`P1`
- 状态：`stable`

## 11. Use Cases 页面统一模板

建议每篇场景页都按下面这个模板写，避免有的页变成产品介绍，有的页变成营销文案。

### Section 1. This Mode Is For You If...

- 这一页适合谁
- 适合什么任务
- 不适合什么任务

### Section 2. Why ContextGo Fits This Scenario

- 不是泛讲功能
- 要讲这类场景最痛的地方
- 再讲 ContextGo 怎么解决

### Section 3. Recommended Setup

- 推荐工作台
- 推荐 context 接入
- 推荐 runtime
- 推荐 package / skills

### Section 4. Starter Kit

- `Recommended Workbench`
- `Recommended Connectors`
- `Recommended Runtime`
- `Recommended Agent Package`
- `Recommended Skills`
- `Recommended Automation`
- `Recommended Publish Path`
- `Recommended Remote Mode`

### Section 5. First-Day Workflow

- 给一个真正能从零开始的最短路径
- 例如 5 步到 8 步

### Section 6. When To Level Up

- 一开始不要加的东西
- 用顺以后再加什么

### Section 7. Related Docs

- 关联到 Workbench、Context、Agents、Publish、Remote 等主模块页

## 12. Use Cases 首批上线矩阵

为了避免首批 docs 把面铺得过大，建议按三批上线。

### Batch 1：必须首发

这些页面最能解释产品价值，也最适合普通用户第一时间上手：

1. `Use Cases Overview`
2. `Bring Your Workflow Into ContextGo`
3. `Content And Writing Studio`
4. `Research And Browser Workflow`
5. `Coding And Builder Workflow`
6. `Operations And Automation Workflow`
7. `Personal Remote Workbench`

Batch 1 的目标不是覆盖所有行业，而是把最常见的 3 种价值讲透：

- 工作流接入
- 日常工作持续化
- 不守在电脑前也能继续工作

### Batch 2：突出产品差异化

这些页面最能拉开和一般 AI 工具的差异：

1. `Publish-To-Channel Workflow`
2. `Recommended Starter Modes`
3. `Team And Collaboration Workflow`

Batch 2 的目标是把 ContextGo 的三个强差异点真正讲出来：

- 可发布
- 可按模式开箱
- 可走向多 Agent 协作

### Batch 3：再向垂直角色扩展

这批可以在主骨架稳定之后再加：

1. 更细的角色页
2. 更细的行业页
3. 更细的 workflow 组合页

例如未来可以继续加：

- `Product Manager Workflow`
- `Content Ops Workflow`
- `Analyst Workflow`
- `Founder Workflow`
- `Community Agent Workflow`

但这些都不应该先于 Batch 1。

## 13. 建议的站点导航与 URL 结构

如果是独立站点，我建议顶层导航不要太复杂，直接是：

- Start Here
- Use Cases
- Workbench
- Context
- Agents & Capabilities
- Publish
- Collaboration
- Remote & Devices
- Manage

导航上不直接放 `Advanced`，让它在侧边栏和页内入口出现即可。

建议 URL 结构如下：

```text
docs.contextgo.io/
docs.contextgo.io/start/
docs.contextgo.io/use-cases/
docs.contextgo.io/workbench/
docs.contextgo.io/context/
docs.contextgo.io/agents/
docs.contextgo.io/publish/
docs.contextgo.io/collaboration/
docs.contextgo.io/remote/
docs.contextgo.io/manage/
docs.contextgo.io/advanced/
```

每个区下继续用清晰 slug，比如：

- `/context/context-connector`
- `/context/context-engine`
- `/use-cases/content-and-writing-studio`
- `/use-cases/research-and-browser-workflow`
- `/agents/agent-packages`
- `/agents/skill-market`
- `/publish/publish-one-agent-to-many-places`
- `/remote/mobile-shells`

## 14. 独立文档站的技术方案建议

既然方向已经确定为独立站点、独立域名，并且部署继续走自有 CI/CD，那么默认推荐方案更新为：

- 独立 docs app
- 独立域名：`docs.contextgo.io`
- GitHub Actions 构建
- Cloudflare Pages 部署
- 主站 `contextgo.io` 保留 docs 路由入口并跳转

### 14.1 为什么现在不再推荐 Mintlify 作为默认方案

Mintlify 的优点很明显：

- 成熟
- 成品感强
- 很像 OpenClaw 当前文档站

但对你现在这个前提来说，它不是最优默认值，原因是：

- 你已经明确希望部署继续走仓库内 CI/CD
- 你需要对信息架构、主题和内容组织有更强控制权
- 你不是做一个通用 SaaS docs，而是要把非常强的产品结构映射进去

所以它可以是参考站，不再是默认落地方案。

### 14.2 默认技术选择建议

在现有前提下，我更推荐：

- `Docusaurus`
- 独立 docs app
- GitHub Actions + Cloudflare Pages

理由：

- 更适合大型产品文档树
- 更适合多层信息架构
- 版本、i18n、侧边栏、分类页能力更成熟
- 对“产品用户优先”的大文档站更稳

### 14.3 与主站的关系

主站 `contextgo.io` 只需要做三件事：

1. 顶部导航保留 `Docs`
2. `/docs` 路由跳转到 `docs.contextgo.io`
3. 产品页、博客页、下载页与文档页互相深链

这样就能保证：

- 主站负责品牌、产品、下载、博客
- docs 站负责完整产品文档
- 两者边界清晰

## 15. 哪些内容不该再成为主文档主轴

下面这些内容以后不应该再主导对外产品文档：

1. `contextgo-releases` 仓库细节
2. source of truth 这类面向维护者的话术
3. 发布链路异常的内部排查表达
4. 仓库边界争论
5. 内部 runtime 投影路径细节

它们可以存在，但应该被收纳到：

- release notes
- advanced 文档
- 仓库内技术文档

而不是出现在主用户路径上。

## 16. 最终建议

这次独立文档站不应该做成“通用技术文档产品”。

它应该做成一套围绕 ContextGo 产品骨架展开的产品文档系统。

我建议你把整个 `docs.contextgo.io` 的一层结构直接冻结为这 9 个产品区：

1. Start Here
2. Use Cases
3. Workbench
4. Context
5. Agents & Capabilities
6. Publish
7. Collaboration
8. Remote & Devices
9. Manage

它们分别对应：

- 一条用户起步路径
- 一条场景化打开方式路径
- 七条已经清晰存在的产品主轴

如果你认可这版结构，下一步最值得做的不是继续泛泛讨论，而是直接进入第二层交付：

1. 每个区的首页怎么写
2. 每篇文档的中英文正式标题
3. 每篇文档的 slug
4. 哪些页是 stable，哪些页是 preview
5. 首批上线文档批次怎么排

## 17. 本次提案参考的仓库锚点

这次重构目录时，重点参考了下面这些现有设计与实现：

- `docs/tech/space-model.md`
- `docs/tech/context-engine-event-architecture.md`
- `docs/tech/mobile-remote-control.md`
- `docs/tech/mobile-shell-readiness.md`
- `docs/tech/workbench-space-canvas-ia.md`
- `docs/tech/agent-package-architecture.md`
- `packages/context-engine/docs/domain-model.md`
- `packages/context-engine/docs/reference-landscape.md`
- `docs/superpowers/workbench/2026-04-16-ai-native-workbench-host-design.md`
- `docs/superpowers/specs/2026-04-16-context-engine-dual-loop-architecture-design.md`
- `docs/superpowers/specs/2026-04-16-context-engine-governance-runtime-protocol-design.md`
- `docs/superpowers/specs/2026-04-16-project-skill-market-entry-design.md`
- `docs/plans/2026-03-29-im-agent-publication-platform-design.md`
- `docs/plans/2026-03-28-agent-team-workflow-design.md`
- `src/process/channels/core/ChannelRouteResolver.ts`
- `src/process/channels/agent/ChannelMessageService.ts`
- `src/renderer/pages/settings/AgentSettings/Workspace/*`
- `src/renderer/components/settings/SettingsModal/contents/ModelModalContent.tsx`
