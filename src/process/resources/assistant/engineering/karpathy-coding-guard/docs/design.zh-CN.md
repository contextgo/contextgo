# Karpathy Coding Guard 预置助手设计稿

这份文档记录内置 `Karpathy Coding Guard` agent package 的第一版吸收设计。

目标不是把上游仓库当作一个单文件 `CLAUDE.md` 插件原样搬进来，而是把其中最有价值的编码约束内化成 ContextGo 自己的一方工程助手，让用户在开箱即用时就能得到更少假设、更小 diff、更强验证边界的编码行为约束。

## 已真实下载并阅读的上游参考

### 1. `forrestchang/andrej-karpathy-skills`

- 本地仓库：`/Users/bytedance/contextgo/agent-repo/andrej-karpathy-skills`
- Commit：`c9a44ae835fa2f5765a697216692705761a53f40`
- License：MIT

本轮实际阅读的正文：

- `README.md`
- `skills/karpathy-guidelines/SKILL.md`
- `.claude-plugin/plugin.json`

## 为什么它应该成为一个独立内置 Agent Package

ContextGo 现在已经有两类工程向内置助手：

- `Superpowers Harness`
  - 偏完整的 spec / plan / TDD / review / verification 工程纪律
- `Everything Claude Code Harness`
  - 偏大规模外部工程 harness 与技能包吸收

但还缺一种更聚焦的工程助手类型：

- 不强调大而全流程编排
- 不强调角色大 catalog
- 专门约束 AI 在“真正写代码”时最容易犯的判断失真

`Karpathy Coding Guard` 要解决的是另一层问题：

- 模型替用户偷偷补全模糊前提
- 模型把简单改动做成过度抽象
- 模型顺手清理、顺手重构、顺手改无关代码
- 模型在没有明确成功标准时就直接开始写

一句话：

- `Superpowers` 负责完整工程流程纪律
- `Everything Claude Code` 负责 absorbed harness 与大 skill catalog
- `Karpathy Coding Guard` 负责编码决策边界与最小可验证改动约束

## 蒸馏边界

这个 package 应该吸收的是 **编码行为约束方法**，不是上游插件打包方式本身。

### 保留什么

- `Think Before Coding`
- `Simplicity First`
- `Surgical Changes`
- `Goal-Driven Execution`
- 对模糊前提、过度设计、无关改动和弱验证标准的明确警惕

### 不直接引入什么

- 上游 `.claude-plugin` 结构作为产品边界
- 单个大 skill 直接原样照搬
- 把 ContextGo 的 runtime-neutral package 模型退化回 `CLAUDE.md` 插件模型
- 把轻量行为约束助手扩张成完整自动化编排系统

### ContextGo 内化方式

这个 package 应该被映射成 ContextGo 原生构件：

- 教模型如何收敛编码决策边界的 assistant rules
- 一组更细粒度的 packaged skills
- 一份强调 assumptions / changes / verification 的 workspace scaffold
- 基于 `agent-package.json` 的标准 package 注册与投影

## 建议的 package 身份定义

### Package id

- `karpathy-coding-guard`

### Assistant id

- `builtin-karpathy-coding-guard`

### 展示名称

- `Karpathy Coding Guard`

### 推荐领域

- `Engineering`

### 定位

一个围绕 linked workspace 展开的内置工程助手，专注于编码前假设审计、实现时的简单性约束、最小必要改动、diff 收敛，以及面向成功标准的执行闭环。

## 建议的一方蒸馏 skill 包

这个 package 不应该把上游的一个大 skill 继续保留为一个大 skill。

更合适的方式是拆成 5 个聚焦 skill：

1. `assumption-audit`

- 在开始编码前识别不确定前提、隐含解释、缺失约束和需要确认的地方。
- 禁止模型静默选择一种解释然后一路跑下去。

2. `simplicity-first`

- 约束实现保持最小可行，不为单次需求预建抽象层。
- 用来抑制“为了未来灵活性而提前复杂化”。

3. `surgical-change`

- 强调只改和本次目标直接相关的文件与代码段。
- 允许清理由本次修改直接产生的 orphan，但不顺手改历史遗留问题。

4. `goal-driven-execution`

- 先写成功标准，再组织实现与验证。
- 对 bugfix、feature、refactor 都要求落到可验证目标。

5. `diff-minimization-review`

- 用于实现后或 review 前的自检。
- 重点检查 diff 里是否混入了无关改动、过度结构化和未经验证的扩展实现。

## 为什么第一版不加 hooks / commands / schedules

这个 package 的价值不在自动化编排，而在行为约束。

第一版如果强行加：

- hooks
- commands
- schedules

反而会把边界做大，变成另一个工程 harness。

因此第一版只保留：

- `workspaceScaffold`
- `skills`

这能让它作为一个完整 Agent Package 出现，同时保持它是“新的助手类型”，而不是另一个 workflow bundle。

## 建议的 workspace scaffold

工作空间初始化后，应把仓库约束沉淀到以下几类文档槽位：

- `docs/assumptions/`
  - 记录开始编码前需要确认、未确认和已确认的关键前提
- `docs/changes/`
  - 记录本次任务允许触达的范围与不应扩大的边界
- `docs/verification/`
  - 记录成功标准、验证命令和验证结果

这与 package 的核心理念一致：

- 先明确假设
- 再限制改动边界
- 最后用清晰验证闭环收口

## Package Surface 设计

建议 package root 位于：

- `src/process/resources/assistant/engineering/karpathy-coding-guard/`

建议包含：

- `agent-package.json`
- `AGENTS.md`
- `docs/`
- `workspace/`
- `skills/`

安装边界保持现有协议：

- `.contextgo/` 是安装源
- 只把 `skills` 投影到 runtime-native skill 目录
- 不把 package 重新建模成 runtime-owned preset

## 预期收益

完成后，用户将直接获得一种新的内置工程 Agent：

- 不需要先安装外部插件
- 不需要理解上游 CLAUDE 插件分发方式
- 在 ContextGo 的 Agent 列表里直接可见
- 绑定 workspace 后即可用 package 自带 skills 和 scaffold 工作
- 在做小中型编码任务时，默认更克制、更可验证、更少无关 diff
