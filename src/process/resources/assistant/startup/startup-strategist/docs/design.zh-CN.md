# Startup Strategist 预置助手设计稿

这份文档记录内置 `Startup Strategist` assistant preset 的第一版吸收设计。

目标不是把上游 startup bundle 原样搬进来，而是把其中最强的创业战略工作流蒸馏成 ContextGo 自己的一方预置助手，帮助创始人和 zero-to-one 团队从 startup idea 走到 segment choice、value proposition、GTM 和指标体系。

## 已真实下载并阅读的上游参考

### 1. `rameerez/claude-code-startup-skills`

- 本地仓库：`/Users/bytedance/contextgo/agent-repo/claude-code-startup-skills`
- Commit：`410f81f83e4ac309032eab3d3265353f97ea665f`
- License：MIT

本轮实际阅读的正文：

- `README.md`
- `skills/customer-empathy/SKILL.md`

### 2. `phuryn/pm-skills`

- 本地仓库：`/Users/bytedance/contextgo/agent-repo/phuryn-pm-skills`
- Commit：`36ccefdc6c2e00d7c0c12cb0a52bf93e8ec50da4`
- License：MIT

本轮实际阅读的 startup 正文：

- `pm-product-strategy/skills/startup-canvas/SKILL.md`
- `pm-product-strategy/skills/value-proposition/SKILL.md`
- `pm-product-strategy/skills/swot-analysis/SKILL.md`
- `pm-go-to-market/skills/ideal-customer-profile/SKILL.md`
- `pm-go-to-market/skills/gtm-strategy/SKILL.md`
- `pm-marketing-growth/skills/north-star-metric/SKILL.md`

## 为什么它应该成为一个独立内置 preset

`PM Workbench` 已经覆盖了：

- 证据驱动的产品发现
- 面向产品团队的战略框架
- PRD、优先级和路线图规划

这些能力很重要，但它默认站在“已经有一定产品基础”的阶段。

`Startup Strategist` 应该往前站一层，专门处理 founder stage 的关键问题：

- 这个问题是否值得围绕它创业
- beachhead segment 到底是谁
- 价值主张是否足够强
- 哪些 tradeoff 才是真正定义这门生意的
- 初始 GTM motion 是否可信
- 什么指标体系才代表真实用户价值

一句话：

- `Startup Strategist` 负责 zero-to-one 的战略选择
- `PM Workbench` 负责把这些选择继续转成产品运营决策

## 蒸馏边界

这个 preset 应该吸收方法，不应该照搬上游包的结构。

### 保留什么

- 以 customer empathy 和 JTBD 为起点的 founder framing
- 把 strategy 和 business model 分开的 startup canvas
- 带 alternatives 的 value proposition 结构
- beachhead segment 的 ICP 定义方式
- SWOT 式战略诊断
- 有渠道和 message discipline 的 GTM 规划
- 北极星指标和 input metrics 的成套定义

### 不直接引入什么

- 上游 plugin metadata 和 command 打包形式
- 把 Google Doc 或模板链接当成产品依赖
- 上游 marketplace 分发机制
- 忽略 startup 不确定性的泛 PM 输出

### ContextGo 内化方式

这个 preset 应该被映射成 ContextGo 原生构件：

- 教 startup 决策行为的 assistant rules
- 一套一方蒸馏 skill 包
- 一组 founder workflow 对应的 workspace commands
- 把 linked workspace 作为 canvas、brief 和验证计划的默认承载位置

## 建议的 preset 身份定义

### Assistant id

- `builtin-startup-strategist`

### 展示名称

- `Startup Strategist`

### 推荐领域

- `Startup Strategy`

### 定位

一个围绕已关联 workspace 展开的内置 founder 战略助手，专注于 startup idea 压测、segment choice、value proposition、GTM 设计、北极星指标和 founder 级战略摘要。

## 建议的一方蒸馏技能包

建议的技能包名称：

- `startup-strategist-pack`

### 核心 skills

1. `startup-founder-problem-framing`

- 从 founder 的信念出发，但强制回到 customer empathy、JTBD、问题紧迫度和最短价值路径。
- 明确拆开 evidence、观察到的痛点和 founder 直觉。

2. `startup-startup-canvas`

- 生成一版把 strategy 和 business model 分开的 startup canvas。
- 把 vision、segment choice、value proposition、tradeoff、growth motion、capabilities、defensibility、cost structure 和 revenue streams 摊开。

3. `startup-value-proposition`

- 用 who、why、what before、how、what after、alternatives 结构化价值主张。
- 结尾必须产出可直接复用的 positioning statement。

4. `startup-ideal-customer-profile`

- 用 firmographic 或角色信号、行为模式、JTBD、痛点、采购上下文和 disqualification rules 定义 beachhead segment。

5. `startup-strategic-diagnosis`

- 把 market timing、alternatives、SWOT、战略压力点和 must-be-true 假设放在一起。
- 它不是泛泛市场综述，而是 startup 压测框架。

6. `startup-go-to-market-strategy`

- 把 beachhead segment 和 value proposition 变成一版聚焦的 GTM motion，包括渠道、message、proof assets 和 90 天计划。

7. `startup-north-star-metric`

- 负责定义北极星指标和 3-5 个 input metrics。
- 指标系统必须围绕真实用户价值，而不是 vanity metrics。

8. `startup-founder-brief`

- 把当前 startup 状态沉淀成一版 founder 级战略摘要，包含 thesis、choices、risks、tests 和 next moves。

## 建议的默认启用技能

这个 preset 建议默认启用 startup pack 本身：

- `startup-founder-problem-framing`
- `startup-startup-canvas`
- `startup-value-proposition`
- `startup-ideal-customer-profile`
- `startup-strategic-diagnosis`
- `startup-go-to-market-strategy`
- `startup-north-star-metric`
- `startup-founder-brief`

## 建议的 workspace commands

### 1. `stress-idea`

使用：

- `startup-founder-problem-framing`
- `startup-strategic-diagnosis`
- `startup-startup-canvas`

作用：

- 压测这个 startup idea 是否真的在可信市场条件下解决了足够真实的问题

### 2. `design-canvas`

使用：

- `startup-startup-canvas`

作用：

- 生成一版完整的 startup canvas，把 strategy 和 business model 分开表达

### 3. `scan-market`

使用：

- `startup-strategic-diagnosis`
- `startup-founder-problem-framing`

作用：

- 在投入前先看 market timing、alternatives、SWOT 和主要压力点

### 4. `define-icp`

使用：

- `startup-ideal-customer-profile`
- `startup-founder-problem-framing`

作用：

- 识别真正的 beachhead customer，并明确什么人不属于 fit

### 5. `shape-value-prop`

使用：

- `startup-value-proposition`
- `startup-founder-problem-framing`
- `startup-ideal-customer-profile`

作用：

- 把模糊承诺变成 segment-specific 的 value proposition 和 positioning statement

### 6. `plan-gtm`

使用：

- `startup-go-to-market-strategy`
- `startup-ideal-customer-profile`
- `startup-value-proposition`

作用：

- 为 beachhead segment 设计最小可信 GTM motion

### 7. `set-north-star`

使用：

- `startup-north-star-metric`
- `startup-go-to-market-strategy`

作用：

- 选定 startup 的核心指标和少数真正重要的领先指标

### 8. `write-founder-brief`

使用：

- `startup-founder-brief`
- `startup-startup-canvas`
- `startup-strategic-diagnosis`
- `startup-go-to-market-strategy`

作用：

- 把当前创业方向沉淀成 founder-ready 的战略摘要
