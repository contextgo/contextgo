# Context Engine 治理运行时协议设计

日期：2026-04-16

## 目标

定义 ContextGo 固定治理身份的运行时协议，明确它们如何装配、触发和被观察。

这份 spec 建立在已经接受的双循环架构之上，正式冻结以下内容：

- `Session Steward / Project Curator / Space Curator` 如何加载 skills
- hooks、schedules、commands 如何触发治理工作
- governance jobs 如何路由与被观察
- 内部实现细分如何被稳定的产品层治理身份所吸收

这份文档**不**定义最终 prompt 文本，也不定义每个身份最终加载哪些具体 packaged skills。它定义的是协议与边界，而不是最终素材清单。

## Phase 1 状态

- `Session Steward` 的最小治理协议已进入实现
- `session_compaction` job 已携带治理身份元数据
- `Session Steward` 已开始通过 `working-context` 与 session checkpoints 写出 vault artifacts
- `Project Curator`、`Space Curator` 的 skill 装配和控制台观察面仍待后续实现

## Phase 2 状态

- `Project Curator` job 已携带 `project_doc / project_rules / project_skill` artifact targets
- `Project Curator` 已开始通过 project proposal formatter 产出 append-first proposal notes
- timer/manual project capability curation trigger 文案已切到 docs + proposals 语义
- `Space Curator` 的 skill 装配、connector digestion 与 runtime console 仍待后续实现

## Phase 3 状态

- `Space Curator` job 已携带 `space_digest / profile_memory` artifact targets
- `Space Curator` 已开始写出 space digest 与 profile-memory artifact
- `connector_digest` 已开始输出 source-aware detail
- runtime console 与完整的 temporal expiration policy 仍待后续实现

## 架构前提

本文默认以下架构已经冻结：

- project-local files 继续作为项目执行的最终事实源
- Context Engine 通过 vault-backed 的 project / space layout 工作
- session 与 project/space 演化构成双循环系统
- 治理身份固定为：
  - `Session Steward`
  - `Project Curator`
  - `Space Curator`
- 面向用户的控制入口是 runtime console，而不是一长串后台 assistant 列表

## 运行时模型

治理运行时共有四层：

1. `Context Orchestrator`
2. 固定治理身份
3. 内部 skill bundles
4. 触发面：`hooks`、`schedules`、`commands`、connector ingress

只有 orchestrator 负责路由工作。

只有三个固定身份是产品可见的治理角色。

内部 helper agents、worker profiles、package variants 可以存在，但都只是实现细节。

## 固定治理身份

### Session Steward

目的：

- 管理当前 session 上下文质量
- 保持当前任务上下文可继续工作
- 提供最贴近 session 的注入素材

主要工作产物：

- session timeline
- session working context
- session checkpoints

### Project Curator

目的：

- 演化项目本地上下文文件
- 将稳定 session 结果提升为项目文档与提议
- 跟踪 project-owned skills、hooks、commands、schedules 的 capability drift

主要工作产物：

- project docs updates
- project working notes
- project capability review notes
- `AGENTS.md` proposals
- skill update proposals

### Space Curator

目的：

- 维护跨 session、跨 project 的上下文
- 将 connector 派生上下文整理成更高层、更长期的形式
- 管理 profile、时序、staleness、expiration 状态

主要工作产物：

- space-level docs
- 用户画像投影
- 跨项目模式总结
- connector digests
- temporal memory governance state

## Skill 装配协议

固定治理身份不能依赖一整段巨大的静态提示词。

它们必须通过显式 skill assembly 来运行。

每次治理执行都由以下四层装配而成。

### Layer A：Identity Base Rules

这是稳定的身份级规则，定义：

- 允许写入的范围
- proposal 与 direct-write 的默认行为
- 预期输出风格
- 明确禁止触碰的目标

示例：

- `Session Steward` 不能直接修改 project `AGENTS.md`
- `Project Curator` 对 `AGENTS.md` 和 `skills/` 默认 proposal-first
- `Space Curator` 不能直接覆盖活跃 project session 文件

这层规则应该长期稳定，变化频率极低。

### Layer B：Role Core Skills

这是随治理身份长期绑定的核心 skill 组。

#### Session Steward 核心技能

- `session-timeline-writer`
- `session-working-context-rewriter`
- `session-checkpoint-distiller`
- `session-injection-preparer`
- `task-state-summarizer`
- `constraint-window-manager`

#### Project Curator 核心技能

- `project-doc-curation`
- `project-decision-promoter`
- `agents-index-updater`
- `skill-usage-review`
- `capability-surface-mapper`
- `project-context-patch-generator`

#### Space Curator 核心技能

- `user-profile-distillation`
- `cross-project-pattern-synthesis`
- `temporal-memory-governance`
- `connector-context-digestion`
- `space-context-promotion`
- `expiration-and-staleness-manager`

具体文件名后续可以演化，但协议上假定每个治理身份都会绑定一组稳定且较小的核心 skill。

### Layer C：Job-Specific Skills

根据 job type 临时加载的附加技能。

示例：

- `session_compaction`
  - `compaction-summarizer`
  - `pending-task-detector`
  - `active-constraint-extractor`
- `project_promotion`
  - `project-doc-patcher`
  - `decision-note-writer`
- `project_capability_curation`
  - `skill-usage-analyzer`
  - `agents-index-patcher`
  - `capability-review-note-writer`
- `space_memory_distillation`
  - `user-profile-merger`
  - `cross-project-pattern-builder`
- `connector_digest`
  - `connector-event-normalizer`
  - `external-context-classifier`

job-specific skill bundles 必须显式、确定、可重放。

### Layer D：Contextual Augmentation Skills

这是根据 durable project/space context 动态附加的 skill。

来源可以包括：

- project 范围内的 context skills
- space 层晋升出的 context skills
- 未来 engine 自己维护的高层 context skill packages

这些 skill 只有在以下条件匹配时才会被装配：

- project
- space
- connector kind
- capability kind
- recent signal kinds
- job payload type

Contextual augmentation 绝不能隐式发生。

每一次选择都必须记录到 job execution snapshot 中。

## Skill 来源

治理 skill 装配只允许使用三类来源：

1. `system packaged skills`
2. `project-scoped context skills`
3. `space-promoted context skills`

运行时不能静默扫描任意 runtime-native 目录，并把它们直接当作治理 skill 来源。

规范性的所有权模型仍然是：

- project-local capability files 持有 project truth
- package-managed skills 承载可复用执行单元
- runtime-native directories 只是 projection

## Skill 选择规则

装配过程分三步：

1. 加载 identity base rules 与 role core skills
2. 根据 job type 加载 job-specific skills
3. 根据当前 project / space / signals 决定是否追加 contextual augmentation skills

选择算法应优先优化：

- determinism
- 小而稳定的 active skill set
- explainability
- bounded write scope

选择算法应避免：

- 贪心加载全部可用 skills
- 隐式 prompt 膨胀
- 将无关的 space/global context 污染进 project 运行面

## 执行快照要求

每次治理 job 执行都必须记录一份 snapshot，至少包含：

- governance identity
- job type
- trigger source
- loaded core skills
- loaded job-specific skills
- loaded contextual augmentation skills
- contextual-selection rationale
- write scope
- 最终产生 direct writes 还是 proposals

这份 snapshot 必须在 runtime console 中可见。

## 触发协议

所有治理活动都从触发面开始，但触发面必须被严格限制。

允许的触发类型：

- hooks
- schedules
- commands
- connector ingress

触发面本身不直接重写上下文文件。

它们只产生标准化事实或显式请求。

再由 orchestrator 将其转换成 typed context jobs。

## Hooks 协议

### 目的

hooks 用于捕捉近实时执行事实，并发出轻量治理信号。

### 允许的 hook 类别

#### Session lifecycle hooks

示例：

- turn started
- turn completed
- user interruption
- resume
- tool finished
- skill finished

默认路由：

- `Session Steward`

典型 job：

- `session_fact_append`
- `session_working_context_refresh`
- `session_checkpoint_create`
- `session_signal_detect`

#### Project capability hooks

示例：

- repeated skill invocation
- repeated command use
- repeated hook block or warning
- repeated schedule success or failure

默认路由：

- `Project Curator`

典型 job：

- `project_capability_curation`
- `skill_usage_digest`
- `agents_patch_proposal`

#### Connector ingress hooks

示例：

- external resource synced
- external message ingested
- repository activity captured
- browser / clipboard import completed

orchestrator 必须先把 connector 输入分类为：

- session-relevant
- project-relevant
- space-relevant

然后再路由给：

- `Session Steward`
- `Project Curator`
- `Space Curator`

### hook 限制

hook 可以做：

- capture facts
- normalize small payloads
- attach evidence references
- enqueue jobs

hook 不能做：

- 直接重写 docs
- 直接修改 `AGENTS.md`
- 直接修改正式 skill 文件
- 承担大型总结与重治理工作

## Schedules 协议

### 目的

schedules 负责慢循环、维护、蒸馏与过期治理。

### schedule 类别

#### Short-cycle schedules

建议频率：

- 每 5-15 分钟
- 或按 idle window 触发

默认路由：

- `Session Steward`

典型 job：

- `session_working_context_refresh`
- `session_checkpoint_create`
- `session_compaction`

#### Project maintenance schedules

建议频率：

- hourly
- half-daily
- daily

默认路由：

- `Project Curator`

典型 job：

- `project_doc_curation`
- `project_promotion`
- `project_capability_curation`
- `agents_patch_proposal`
- `skill_patch_proposal`

#### Space distillation schedules

建议频率：

- nightly
- daily
- weekly

默认路由：

- `Space Curator`

典型 job：

- `space_memory_distillation`
- `user_profile_refresh`
- `cross_project_pattern_synthesis`
- `connector_digest`
- `temporal_memory_expiration`

### schedule 限制

schedules 适合做：

- consolidation
- distillation
- expiration
- proposal batch generation

schedules 不适合做：

- 超低延迟的 turn 注入
- 高频重写 project truth files
- 强依赖当前对话即时反馈的逻辑

## Commands 协议

### 目的

commands 是显式人工治理入口。

它能让用户在不了解内部 hooks / schedules 的情况下，仍能主动触发治理动作。

### command 类别

#### Session commands

示例：

- `/context-session-refresh`
- `/context-session-checkpoint`
- `/context-session-compact`

默认路由：

- `Session Steward`

#### Project commands

示例：

- `/context-project-curate`
- `/context-project-propose-agents`
- `/context-project-review-skills`

默认路由：

- `Project Curator`

#### Space commands

示例：

- `/context-space-distill`
- `/context-space-profile-refresh`
- `/context-space-digest-connectors`

默认路由：

- `Space Curator`

### command 限制

commands 可以：

- 强制触发一次治理执行
- 指定 target scope
- 未来再增加 conservative / standard / aggressive mode
- 返回 report、proposal 或 update result

commands 不应：

- 绕过 writeback 边界
- 绕过 runtime console 历史
- 在协议外直接调用任意隐藏后台 assistant

## Trigger-To-Job 转换规则

一条硬规则：

**trigger 描述“发生了什么”，job 描述“应该做什么”。**

例如：

- repeated skill failures 不能直接修改某个 skill 文件
- 它只能先变成 evidence
- 再由 orchestrator 转换为 `project_capability_curation`

再例如：

- accumulated connector imports 不能直接改 profile
- 它只能先变成 relevance facts
- 再被转换成 `connector_digest` 或 `space_memory_distillation`

这样可以保持：

- trigger surface 稳定
- job policy 可演进
- 三类治理身份边界清晰

## Job 类型归属

默认归属关系如下：

### Session Steward 负责的 job

- `session_fact_append`
- `session_working_context_refresh`
- `session_checkpoint_create`
- `session_compaction`
- `session_injection_prepare`

### Project Curator 负责的 job

- `project_doc_curation`
- `project_promotion`
- `project_capability_curation`
- `agents_patch_proposal`
- `skill_patch_proposal`

### Space Curator 负责的 job

- `space_memory_distillation`
- `user_profile_refresh`
- `cross_project_pattern_synthesis`
- `connector_digest`
- `temporal_memory_expiration`

## Runtime Console 要求

runtime console 必须能够回答以下问题：

- 是什么触发了这次治理执行
- 产生了什么 job
- 由哪个治理身份执行
- 加载了哪些 skill
- 写了哪些 surfaces
- 哪些输出只是 proposal
- 哪些失败了，为什么失败

runtime console 不是装饰性面板，而是治理自动化的 explainability 边界。

## 与现有 ContextGo 运行时面的关系

这套协议应直接复用 ContextGo 已有能力，而不是另发明一套自动化模型。

它应与以下现有结构协同：

- assistant packages
- project-local `.contextgo` automation files
- project capability mirrors into the space vault
- typed context events
- queued context jobs

## 默认变更策略

当前阶段先采用简单策略：

- project docs：默认允许自动写
- `AGENTS.md`：append-first、增量 patch
- `skills/`：append-first、增量 patch

这份 spec **刻意不**定义复杂的 `AGENTS.md / skills` 低风险自动通过分类体系。

这部分如果后续需要，可以再加。

## 非目标

这份文档暂时不定义：

- internal governance helpers 的最终 package IDs 或 manifest layout
- 每个治理身份最终的 packaged skill 清单
- 最终给用户暴露的 command 名称
- proposal review 的最终审批 UI
- session timeline / working context / checkpoints 的最终 vault path 命名

## 验收标准

当以下条件都成立时，可以认为这份运行时协议已被接受：

- 三个治理身份保持固定
- 内部实现可以细拆，但不改变产品层治理身份
- skill assembly 是显式且分层的
- hooks、schedules、commands 都统一通过 typed context jobs 路由
- triggers 不直接改 project truth files
- runtime console 可观察性是协议组成部分
- project / space scoped context skills 可以参与治理，但不会变成隐式黑盒 prompt 状态

## 推荐下一步

在这份协议被接受后，下一步实现规划应继续定义：

- 精确的 job schema 增量
- session timeline / working context / checkpoints 的具体 vault path layout
- 三个治理身份的最小 packaged skill 集
- runtime console 第一版面板与事件视图
