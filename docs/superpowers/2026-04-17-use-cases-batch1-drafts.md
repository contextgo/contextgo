# ContextGo Use Cases Batch 1 Drafts

日期：2026-04-17  
分支：`docs/site-ia-review`  
用途：`docs.contextgo.io` 首批 `Use Cases` 页面草稿  
范围：Batch 1

## 1. Batch 1 范围

这一批先写 7 篇页面：

1. `Use Cases Overview`
2. `Bring Your Workflow Into ContextGo`
3. `Content And Writing Studio`
4. `Research And Browser Workflow`
5. `Coding And Builder Workflow`
6. `Operations And Automation Workflow`
7. `Personal Remote Workbench`

目标不是把所有行业一次写完，而是先把 ContextGo 最容易被用户理解和采用的几种打开方式写透。

## 2. 统一写法原则

所有页面遵循同一套规则：

- 面向产品用户，不面向维护者
- 不先讲仓库、协议、内部边界
- 先讲场景和价值，再讲模块和能力
- 不把“功能清单”当作 use case
- 每页都必须给出一条第一天能开始的最短路径

统一页面结构：

1. Hero
2. This Mode Is For You If...
3. Why ContextGo Fits This Scenario
4. Starter Kit
5. First-Day Workflow
6. When To Level Up
7. Related Docs

---

## 3. Page Drafts

## 3.1 Use Cases Overview

- 中文标题：`使用场景总览`
- 英文标题：`Use Cases Overview`
- slug：`/use-cases/`
- 状态：`stable`

### Hero

ContextGo 不是只能用一种方式打开的产品。  
它更像一个 local-first 的 AI 工作系统。你可以从写作、研究、开发、自动化、远程工作这些不同入口开始，用最适合自己的第一种方式进入，而不是先学完整个系统。

### This Mode Is For You If...

这一页适合：

- 第一次进入 ContextGo 文档站
- 已经知道自己想用 AI 做事，但不知道该从哪个入口开始
- 想先找到最贴近自己的使用方式，再去理解底层产品架构

这一页不适合：

- 已经非常明确自己要看某个产品模块的人
- 只想看高级实现细节的人

### Why ContextGo Fits Different Use Cases

很多 AI 工具擅长回答问题，但不擅长承接长期工作。  
ContextGo 的不同在于，它不是只提供一个对话框，而是把下面这些东西组织进一个系统里：

- 你的工作台
- 你的上下文
- 你的 Agent 和运行时
- 你的自动化
- 你的远程使用方式

这意味着你可以按自己的真实工作目标来进入，而不是先按技术概念来学习。

### Browse By Goal

如果你是按任务目标来选入口，可以从这里开始：

- 想把已有工作流接进来：看 `Bring Your Workflow Into ContextGo`
- 想做内容、写作和文档：看 `Content And Writing Studio`
- 想做研究、资料整理和浏览器工作流：看 `Research And Browser Workflow`
- 想把开发、文件和 code agent 组织起来：看 `Coding And Builder Workflow`
- 想做持续自动化：看 `Operations And Automation Workflow`
- 想不盯着电脑也能继续工作：看 `Personal Remote Workbench`

### Browse By Role

如果你更习惯按身份来找入口：

- 写作者 / 内容创作者：从 `Content And Writing Studio` 开始
- 研究者 / 分析者：从 `Research And Browser Workflow` 开始
- 独立开发者 / Builder：从 `Coding And Builder Workflow` 开始
- 运营 / 执行 / 流程型用户：从 `Operations And Automation Workflow` 开始
- 远程工作用户：从 `Personal Remote Workbench` 开始

### Recommended Starter Modes

如果你不想自己选，默认推荐这样开始：

- 最稳妥：`Bring Your Workflow Into ContextGo`
- 最容易马上感受到价值：`Content And Writing Studio`
- 最能体现系统能力：`Research And Browser Workflow`

### Related Docs

- `What Is ContextGo`
- `Product Map`
- `Context System Overview`
- `AI Native Workbench Overview`

---

## 3.2 Bring Your Workflow Into ContextGo

- 中文标题：`把你的工作流接进 ContextGo`
- 英文标题：`Bring Your Workflow Into ContextGo`
- slug：`/use-cases/bring-your-workflow-into-contextgo`
- 状态：`stable`

### Hero

你不需要为了用 ContextGo 先把工作方式全部推倒重来。  
更好的方式，是先把你原来已经在用的资料、网页、文件、笔记、任务流接进来，让 ContextGo 从你现有的工作现实开始工作。

### This Mode Is For You If...

这一页适合：

- 已经有自己的文件夹、网页、文档、工作流
- 不想先学一套新的复杂系统
- 想先把“现在就在做的事”接进来

这一页不适合：

- 只想空白开始体验一个 demo

### Why ContextGo Fits This Scenario

很多工具的问题不是能力不够，而是和你现有工作现实脱节。

你真正的工作往往分散在：

- 本地文件
- 网页和浏览器标签页
- 文档和笔记
- 外部产品
- 之前做过的结果

ContextGo 的价值不在于让你重新开始，而在于：

- 把这些来源接进上下文系统
- 让 Agent 在真实工作环境里继续工作
- 让后续自动化、远程访问和发布都建立在真实上下文上

### Starter Kit

- Recommended Workbench: `Conversation Cowork Workbench`
- Recommended Connectors: `Browser Context`, `Project Files`, `Project Docs`
- Recommended Runtime: `Any ready runtime`
- Recommended Agent Package: `General Cowork`
- Recommended Skills: `web`, `docs`, `files`, `browser`
- Recommended Automation: `none at first`
- Recommended Publish Path: `not required`
- Recommended Remote Mode: `desktop first, remote later`

### First-Day Workflow

第一天建议只做这 5 步：

1. 打开一个你正在做的真实任务，不要用假任务。
2. 把相关文件或文档放到当前工作区里。
3. 把相关网页或资料页接进当前上下文。
4. 让 Agent 先做一件明确的小事，例如整理资料、总结现状、列下一步。
5. 检查结果是否真正引用了你的真实材料，而不是空想输出。

### When To Level Up

先不要一开始就：

- 同时接很多外部系统
- 一上来就做复杂自动化
- 先做发布到渠道

用顺之后再加：

- 更多 context connectors
- hooks / schedules
- remote access

### Related Docs

- `Context Connector`
- `Bringing Your Existing Workflow In`
- `Conversation Cowork Workbench`
- `Skill Market`

---

## 3.3 Content And Writing Studio

- 中文标题：`内容与写作工作室`
- 英文标题：`Content And Writing Studio`
- slug：`/use-cases/content-and-writing-studio`
- 状态：`stable`

### Hero

ContextGo 适合的不是“让 AI 帮你一次性写完”。  
它更适合把资料、提纲、草稿、修订、版本变化和发布准备组织成一个持续工作的写作系统。

### This Mode Is For You If...

这一页适合：

- 写长文、文档、方案、脚本、课程内容
- 需要反复改稿，而不是一次生成
- 资料多、来源分散、容易失去上下文

这一页不适合：

- 只想偶尔让 AI 生成一段短文本

### Why ContextGo Fits This Scenario

写作工作真正的难点通常不是“不会写第一稿”，而是：

- 资料分散
- 版本混乱
- 改写没有上下文
- 长期主题难以积累

ContextGo 更适合这类场景，因为它可以同时承接：

- 写作资料
- 浏览器来源
- 当前草稿
- 历史结论
- 持续修订过程

它不是一次性写稿器，而是写作工作台。

### Starter Kit

- Recommended Workbench: `Conversation Cowork Workbench`
- Recommended Connectors: `Browser Context`, `Project Docs`, `Writing Sources`
- Recommended Runtime: `General writing runtime`
- Recommended Agent Package: `Writing / Research package`
- Recommended Skills: `web`, `markdown`, `docs`, `summary`, `citation`
- Recommended Automation: `daily digest`, `draft review`, `outline refresh`
- Recommended Publish Path: `optional`
- Recommended Remote Mode: `good fit`

### First-Day Workflow

1. 选一个你已经在写或准备写的主题。
2. 把相关网页、笔记、文件和旧稿放进当前上下文。
3. 让 Agent 先帮你整理资料结构，而不是直接生成全文。
4. 基于整理结果生成提纲。
5. 只让它先写一节，再进入修订循环。
6. 把产物留在工作区里继续迭代。

### When To Level Up

用顺以后再加：

- 定时回顾主题资料
- 多篇内容共享同一主题上下文
- 发布前自动检查
- 通过手机远程继续看稿和给修改指令

### Related Docs

- `File And Artifact Workbench`
- `Context System Overview`
- `Skill Market`
- `Operations And Automation Workflow`

---

## 3.4 Research And Browser Workflow

- 中文标题：`研究与浏览器工作流`
- 英文标题：`Research And Browser Workflow`
- slug：`/use-cases/research-and-browser-workflow`
- 状态：`stable`

### Hero

如果你的工作大量发生在浏览器里，ContextGo 的价值不是替你开更多标签页，而是把网页、浏览行为、研究结论和后续任务连成一条线。

### This Mode Is For You If...

这一页适合：

- 做研究、信息搜集、竞品分析
- 长时间在网页间切换
- 需要把网页内容变成长期可复用资料

这一页不适合：

- 几乎不依赖浏览器和外部信息来源的离线任务

### Why ContextGo Fits This Scenario

传统研究工作流最大的问题是：

- 标签页越来越多
- 内容复制粘贴后丢失来源
- 研究结论只存在某一轮聊天里

ContextGo 更适合这类场景，因为它可以把：

- 浏览器上下文
- 页面内容
- 采集结果
- 对比分析
- 结论沉淀

放到同一个系统里，而不是分散在浏览器、文档和聊天记录里。

### Starter Kit

- Recommended Workbench: `Browser Research Workbench`
- Recommended Connectors: `Browser Context`, `Saved Pages`, `Web Sources`
- Recommended Runtime: `Research-friendly runtime`
- Recommended Agent Package: `Research / Analyst package`
- Recommended Skills: `web`, `browser`, `extract`, `compare`, `summarize`
- Recommended Automation: `topic watch`, `periodic scans`, `digest generation`
- Recommended Publish Path: `optional`
- Recommended Remote Mode: `good fit`

### First-Day Workflow

1. 选一个你正在研究的真实主题。
2. 打开相关网页，不要只给一个抽象问题。
3. 让 Agent 基于当前浏览器上下文先做整理，不要急着下结论。
4. 让它把页面分成事实、观点、结论、待确认信息。
5. 再让它输出一份可复用的研究摘要。
6. 把摘要保留下来，作为后续任务的上下文入口。

### When To Level Up

可以逐步加上的能力：

- 周期性扫描某个主题
- 自动生成研究日报
- 把研究结果和写作工作台连起来
- 把结论发布到渠道或团队工作流里

### Related Docs

- `Browser Research Workbench`
- `Computer Use And Browser Actions`
- `Context Connector`
- `Memory, Profile, Context Pack`

---

## 3.5 Coding And Builder Workflow

- 中文标题：`开发与构建工作流`
- 英文标题：`Coding And Builder Workflow`
- slug：`/use-cases/coding-and-builder-workflow`
- 状态：`stable`

### Hero

ContextGo 不是另一个 code agent 包装层。  
它的价值在于把代码工作、项目上下文、浏览器、文件结果、自动化和多端远程一起组织起来。

### This Mode Is For You If...

这一页适合：

- 用 Codex、Claude Code、Gemini、OpenClaw 等 runtime 做代码工作
- 不满足于“只跑一个命令行 Agent”
- 希望让代码工作和项目资料、网页、自动化连接起来

这一页不适合：

- 完全不做代码和构建工作的用户

### Why ContextGo Fits This Scenario

代码型 Agent 往往已经很强，但问题通常在它们之外：

- 项目上下文不连续
- 浏览器研究和代码工作割裂
- 结果只在终端里，不在长期工作系统里
- 手机上很难继续看和控制

ContextGo 把这些外围问题接起来，所以更适合长期构建工作。

### Starter Kit

- Recommended Workbench: `Conversation Cowork Workbench`
- Recommended Connectors: `Project Files`, `Browser Context`, `Project Docs`
- Recommended Runtime: `Codex / Claude Code / Gemini / OpenClaw compatible runtime`
- Recommended Agent Package: `Engineering / Builder package`
- Recommended Skills: `coding`, `git`, `test`, `browser`, `docs`
- Recommended Automation: `hooks`, `commands`, `scheduled checks`
- Recommended Publish Path: `not required`
- Recommended Remote Mode: `good fit`

### First-Day Workflow

1. 在真实项目里打开 ContextGo，不要从空目录开始。
2. 让系统先识别当前 runtime 是否 ready。
3. 把项目说明、关键文档和相关网页一起纳入上下文。
4. 让 Agent 先做小任务，例如定位问题、补一条测试、整理修改计划。
5. 在工作区里查看产物和结果，不要只盯着对话流。
6. 需要离开电脑时，用网页或手机继续跟进状态。

### When To Level Up

用顺以后再加：

- hooks 驱动的检查流
- 定时任务
- 共享 project context
- 多 Agent 协作

### Related Docs

- `Runtime Center`
- `Installed, Signed In, Ready`
- `File And Artifact Workbench`
- `Multi-Agent Collaboration`

---

## 3.6 Operations And Automation Workflow

- 中文标题：`运营与自动化工作流`
- 英文标题：`Operations And Automation Workflow`
- slug：`/use-cases/operations-and-automation-workflow`
- 状态：`stable`

### Hero

ContextGo 适合把“每天都要做、但又不值得你每天亲自重复做”的事情，变成有上下文、有状态、可远程管理的自动化流程。

### This Mode Is For You If...

这一页适合：

- 有大量重复性工作
- 任务之间依赖上下文和历史结果
- 希望用 Agent 做持续执行，而不是一次性命令

这一页不适合：

- 完全一次性的、没有复用价值的任务

### Why ContextGo Fits This Scenario

普通自动化工具擅长执行固定脚本，但不擅长处理变化中的上下文。  
纯聊天工具又能理解需求，但很难持续运行。

ContextGo 更适合做中间这层：

- 有上下文
- 能持续跑
- 能让你远程看
- 能逐步变成工作系统

### Starter Kit

- Recommended Workbench: `Conversation Cowork Workbench`
- Recommended Connectors: `Project Docs`, `External Sources`, `Channel Targets`
- Recommended Runtime: `Stable general runtime`
- Recommended Agent Package: `Operations / Automation package`
- Recommended Skills: `schedules`, `commands`, `summary`, `notifications`
- Recommended Automation: `schedules + hooks + commands`
- Recommended Publish Path: `optional`
- Recommended Remote Mode: `strong fit`

### First-Day Workflow

1. 先挑一个你每周至少会重复 2 到 3 次的任务。
2. 先把它做成“可重复描述”的任务，不要一上来全自动。
3. 先让 Agent 跑一次，确认上下文够不够。
4. 再把它变成 schedule 或 command。
5. 观察 2 到 3 次结果后，再决定是否加 hooks。

### When To Level Up

先不要一开始就：

- 同时加很多 schedule
- 把高风险任务直接无人值守

用顺后再加：

- 失败后的恢复逻辑
- 状态通知
- 发布到渠道
- 手机端远程观察和干预

### Related Docs

- `Hooks, Commands, Schedules`
- `Remote Access Overview`
- `Publish Overview`
- `Context Reviews And Governance`

---

## 3.7 Personal Remote Workbench

- 中文标题：`个人远程工作台`
- 英文标题：`Personal Remote Workbench`
- slug：`/use-cases/personal-remote-workbench`
- 状态：`stable`

### Hero

ContextGo 不是让你把手机变成另一台主机，而是让桌面主机继续工作，而你可以在网页和手机端随时接入、查看、控制和继续任务。

### This Mode Is For You If...

这一页适合：

- 不想长时间守在电脑前
- 希望任务在桌面继续跑，自己只在需要时介入
- 希望在手机上也有接近桌面端的远程体验

这一页不适合：

- 希望手机完全脱离桌面独立承担全部执行的人

### Why ContextGo Fits This Scenario

很多“远程控制”产品只是把桌面画面搬到手机上。  
ContextGo 的价值更像：

- 桌面主机继续作为执行权威
- 网页和手机变成持续可用的工作入口
- 文件、上下文、任务状态都留在同一个系统里

这才是“我不用一直守在电脑前”的真正前提。

### Starter Kit

- Recommended Workbench: `Conversation Cowork Workbench`
- Recommended Connectors: `Host Runtime`, `Web Client`, `Mobile Uploads`
- Recommended Runtime: `Any stable host runtime`
- Recommended Agent Package: `General Cowork`
- Recommended Skills: `summary`, `status`, `remote-safe tasks`
- Recommended Automation: `scheduled reports`, `follow-up tasks`
- Recommended Publish Path: `optional`
- Recommended Remote Mode: `required`

### First-Day Workflow

1. 先在桌面主机把真实任务跑起来。
2. 确认主机在线、runtime ready、网页端可打开。
3. 再从浏览器打开同一台主机。
4. 最后用手机端继续查看和控制，而不是直接从手机开始。
5. 先体验查看状态、继续任务、上传文件这三类行为。

### When To Level Up

用顺以后再加：

- 定时报告
- 远程文件处理
- 多设备切换
- 渠道接入

### Related Docs

- `Remote Access Overview`
- `Desktop Host`
- `Mobile Shells`
- `Uploads, Files, And Host Processing`
