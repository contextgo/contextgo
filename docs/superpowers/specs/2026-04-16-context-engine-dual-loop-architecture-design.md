# Context Engine 双循环架构设计

日期：2026-04-16

## 目标

冻结 ContextGo 下一阶段 Context Engine 的架构与边界规则，使其满足以下目标：

- project 本地上下文继续作为 agent 在项目内工作的真实事实源
- 后台上下文治理从零散增强升级为系统化机制
- session、project、space 三层上下文能够持续演化，但不会退化成隐藏的黑盒数据库
- 产品继续朝“面向普通人的原生 AI 工作台”方向推进

本 spec 只聚焦于架构约束与数据流边界。

它**不**定义内部 skill bundle、具体 prompt 文本或 job payload schema 的最终实现细节。这些属于边界冻结之后的后续细化话题。

## 产品定位

ContextGo 是一个 desktop-first、local-first、multi-agent 的工作系统。

它的 Context Engine 不应该表现成一个独立于产品之外的 memory database，而应该通过 ContextGo 已经拥有的 vault-backed workspace layout 来管理上下文。

用户可见、agent 可直接消费的项目上下文，必须继续保持可编辑、可检查、可版本化。

## 硬性事实源规则

项目本地上下文是 project 执行层的最终事实源。

这意味着在 project 内工作的 agent 应直接消费如下 project 文件面：

- `AGENTS.md`
- `docs/`
- `skills/`
- project working notes
- project 维度的 hooks、commands、schedules 等 capability surface

Context Engine 不能把这些文件替换成“只有 engine store 才知道”的隐藏真相。

相反：

- vault-backed 的 project/session 文件承载 project 可见的上下文事实
- engine 持有跨边界治理状态、长周期记忆、时序与过期状态、promotion 元数据等更高层信息

## 工作区边界

核心工作区边界定义如下：

- `space -> vault root`
- `project -> project root`
- `session -> project-root session area`

Context Engine 通过这套 vault-backed layout 管理上下文，而不是在旁边再建一套并行目录体系。

### Space 作用域

vault root 承载 space 级上下文面，例如：

- 跨 project 笔记
- space memory digests
- 用户画像与长周期上下文投影
- connector 派生的 space summaries

### Project 作用域

project root 承载 project 执行上下文面，例如：

- `AGENTS.md`
- `docs/`
- `skills/`
- project working notes
- hooks、commands、schedules 的 capability review notes

### Session 作用域

session 上下文位于 project root 之下，是 project 维度的运行时上下文层。

它承载：

- session timeline
- session working context
- session checkpoints

## 双循环架构

Context Engine 作为一个单一 orchestration core 运行，但正式分为两条主循环。

### Session Loop

目的：

- 捕捉当前正在发生的任务事实
- 保持当前任务上下文可继续工作
- 为后续 turn 提供更好的注入素材

输出：

- `session timeline`
- `session working context`
- `session checkpoints`

### Project / Space Evolution Loop

目的：

- 从 session 工作中检测稳定信号
- 演化 project 上下文文件
- 提炼跨 session、跨 project 的长期上下文
- 让 connector 派生上下文流入真正有用的产品表面

输出：

- project docs updates
- `AGENTS.md` proposals
- skill update proposals
- space-level digests
- 用户画像与跨项目模式记忆

## 运行时结构

运行时整体形状是：

- 一个 `Context Orchestrator`
- 三个固定治理身份
- 多个普通角色助手

产品层**不应**向用户暴露大量后台 context assistants。

## 固定治理身份

### 1. Session Steward

职责：

- 追加 session 事实到 timeline
- 重写 session working context
- 在关键事件上生成稳定 checkpoint
- 为 runtime 注入提供最近可复用的 session 侧上下文

主要写入范围：

- session timeline
- session working context
- session checkpoints

### 2. Project Curator

职责：

- 将稳定的 session 结果提升为 project docs
- 维护 project-level context 质量
- 生成 `AGENTS.md` 更新提议
- 基于真实使用证据生成 skill 更新提议
- 汇总 project 级 capability 行为

主要写入范围：

- project docs
- project working notes
- project capability review notes

主要 proposal 范围：

- `AGENTS.md`
- `skills/`
- hooks、commands、schedules 行为提议

### 3. Space Curator

职责：

- 维护跨 session、跨 project 的上下文
- 建立用户画像与长周期模式
- 管理时序、陈旧度与过期状态
- 将 connector 派生上下文消化为 space-level context

主要写入范围：

- space-level docs
- engine-held 的 profile 与长周期记忆
- connector digests

向下游输出的 proposal 范围：

- project-level promotion candidates

## 内部实现规则

实现层可以存在多于三个的内部 assistant package、skill bundle 或 worker profile。

但是：

- 产品可见的治理身份始终固定为三个
- 内部 helper agents 只是实现细节
- 非用户任务对话型的 context agents 不能出现在主 assistant catalog 中

用户可见的控制面应该是专门的 runtime console，而不是大批后台助手。

## 用户可见的运行控制台

设置页应暴露一个单独的 Context Engine runtime console，用于展示：

- Context Engine automation 是否启用
- 最近的 context jobs
- 每个 job 由哪个治理身份执行
- proposals、accepted updates、rejected updates
- failed jobs 与 retry 状态
- schedule 与 hook 活动
- connector digestion 活动

用户应看到的是“治理与控制”，而不是一堆后台 assistant。

## Session 上下文模型

session 使用双文档分离模型。

### Session Timeline

特征：

- append-only
- 时间有序
- 以事实为主，不以 prompt 可读性为主
- 适合归档、追溯和回放

典型事件类型：

- user query started
- assistant reply completed
- user interruption
- tool result recorded
- skill execution recorded
- checkpoint created

### Session Working Context

特征：

- 持续重写
- 以“当前是否有用”为优化目标
- 汇总 active goal、constraints、pending work、active references
- 不等于“最近聊天记录”

它是一个移动的注意力窗口，而不是纯时间窗口。

### Session Checkpoints

特征：

- 在重要边界生成
- 稳定到足以输入 project 与 space 演化循环
- 生成后不再重写

建议触发点：

- interruption
- strategy shift
- compaction trigger
- milestone reached
- idle interval boundary
- 显式 close 或 flush

## 自动化触发模型

编排内核使用混合触发模型：

- hooks 负责近实时事实采集
- schedules 负责周期维护
- commands 负责用户显式触发的治理动作
- typed context events 负责 engine 内部路由

三个固定身份只在被调度到对应 job 时运行。

它们不是永久常驻、自由活动的后台聊天助手。

## Connector 上下文规则

connector 派生上下文必须进入同一套流动体系。

每个 connector 输入都应先被分类为：

- session-relevant
- project-relevant
- space-relevant

默认情况下，connector raw material 不应直接进入 prompt。

它应先被整理成：

- 当下直接相关时进入 session working context
- 对项目长期有效时进入 project docs 或 notes
- 具备跨项目长期价值时进入 space digest 或长期记忆

## 写回等级

所有自动写回分为四个等级。

### Level 0：事实追加

append-only、风险最低、默认全自动。

示例：

- session timeline
- checkpoints
- runtime history
- connector raw digest log
- skill usage log

### Level 1：工作上下文重写

允许覆盖旧内容，但聚焦当前任务，默认全自动。

示例：

- session working context
- project working notes
- active task summaries

### Level 2：项目文档整理

面向长期 project 可消费上下文，可自动写，但必须受护栏约束。

示例：

- decision notes
- workflow notes
- connector integration notes
- project memory digest docs

### Level 3：规则 / 能力面演化

风险更高，默认 proposal-first。

示例：

- `AGENTS.md`
- `skills/`
- hooks、commands、schedules 行为提议

## `AGENTS.md` 的特殊规则

`AGENTS.md` 同时承担：

- 执行入口
- 项目规则面
- 上下文索引

默认只允许以下 proposal 类型：

- 索引补全
- 稳定规则补充
- 上下文入口路由调整

默认不允许自动做的事情：

- 大范围风格重写
- 删除已有规则
- 大规模结构重排
- 注入与项目执行无关的重人格内容

## `skills/` 的特殊规则

skill 演化必须从证据出发，而不是直接自由改写。

允许的输出类型：

- usage evidence note
- skill patch proposal
- new skill candidate

默认自动化应止步于“证据”和“提议”，而不是直接改正式 skill 内容。

## 注入策略

注入应按五层结构组装上下文。

### Layer 1：Session Active Context

包含：

- session working context
- recent checkpoint conclusions
- active constraints
- pending work

优先级：

- 最高

### Layer 2：Project Core Context

包含：

- 当前相关的 `AGENTS.md` guidance
- 当前相关的 project docs
- 当前相关的 skill summaries
- project capability notes

优先级：

- 第二

### Layer 3：Space / User Long-Horizon Context

包含：

- 用户画像
- 跨项目稳定模式
- 长周期偏好

优先级：

- 第三

### Layer 4：Connector-Derived Context

包含：

- 当前相关的外部上下文 digest
- 与任务相关的 connector summaries

优先级：

- 第四，除非被明确提升为任务关键

### Layer 5：Skill / Capability Evidence

包含：

- 推荐使用某 skill 的短提示
- 常见失败提醒
- command / schedule / hook 的上下文提示

优先级：

- 辅助层，不是主叙事层

### 裁剪顺序

预算不足时按以下顺序裁剪：

1. connector-derived context
2. space / user long-horizon context
3. 非核心 project docs
4. capability evidence
5. 最后才裁 session active context

这样可以保护“我当前在干什么”和“这个项目当前明确要求什么”不被噪声淹没。

## 与现有 ContextGo 架构的关系

这份设计是在 ContextGo 当前方向上继续细化，而不是另起一套模型。

它与以下方向一致：

- `Space` 作为产品层边界
- 事件驱动的 Context Engine 维护路径
- project-local vault surfaces
- skills、hooks、commands、schedules 的 runtime-neutral capability ownership

它明确拒绝：

- 用 filesystem-first 产品模型替代 `Space`
- 把 Context Engine 变成面对用户的一大堆后台 assistant
- 用隐藏 engine state 取代 project 文件作为执行事实源

## 非目标

这份文档暂时不定义：

- 每个治理身份最终使用哪些具体 packaged skills
- internal governance helpers 的最终 package manifest
- 每种自动化路径的精确 job payload schema
- session 文件的最终 vault path 命名
- Level 3 proposals 的最终审批 UI

这些属于边界被接受之后的后续设计话题。

## 验收标准

当以下条件全部成立时，可以认为这份架构约束被接受：

- project-local files 仍是 project 执行层最终事实源
- Context Engine 通过 vault-backed 目录工作，而不是在旁边另起一套
- 双循环被明确建模
- 三个固定治理身份被明确固定
- 用户看到的是 runtime console，而不是很多后台 assistants
- 写回等级明确
- 注入顺序明确
- connector context 进入同一套流动模型

## 推荐的下一步设计

在这份 spec 被接受后，下一份设计应继续定义：

- `Session Steward / Project Curator / Space Curator` 的 skill 装配与切换协议
- hooks、schedules、commands 如何映射到具体 context job types
