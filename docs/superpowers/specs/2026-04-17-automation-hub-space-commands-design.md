# Automation Hub Space Commands 设计

## Goal

把 `commands` 从“只有 project-local”扩成“两层命令库”：

- `Space Commands`
- `Project Local Commands`

并把 `Skill Market` 的入口收口进现有的 automation modal，避免聊天头部继续挂一个并列入口。

首版只做 `commands`，不把同样的继承模型扩到 `hooks` 或 `schedules`。

## 范围

这次设计覆盖：

- `Space Commands` 的持久化真源
- conversation 实际生效命令的合并规则
- automation modal 内的最小 UI 调整
- `Skill Market` 入口从聊天头部迁到 automation modal

这次设计不覆盖：

- `hooks` / `schedules` 的 space 继承
- 把 commands / hooks 做成新的内置 skill 创建流
- 多用户、协作权限、审批语义
- Agent Package 的 commands 安装模型重做
- vault 中的 space-level automation 文档镜像

## 当前状态

当前实现里：

- project commands 保存在项目 `.contextgo/commands.json`
- conversation 的 managed command library 只读取 project-local `commands.json`
- automation modal 的 `commands` tab 只编辑 project-local 命令
- `Skill Market` 在聊天头部是单独按钮，弹独立 modal
- `ProjectCapabilityService` 和 `SpaceVaultContextSyncService` 仍把 project 目录下的 `.contextgo/*` 视为 project capability 的真源

这导致两个产品问题：

1. 用户无法在同一 `Space` 下复用一套通用 commands
2. automation 相关入口分散，`Skill Market` 和 automation modal 并列，信息架构不收口

## 备选方案

### 方案 A：`Space` 持久化存 shared commands，project 计算有效命令

做法：

- `Space Commands` 存到 `Space` 自身持久化数据
- `Project Local Commands` 继续保存在项目 `.contextgo/commands.json`
- conversation 生效命令在读取时做 merge

优点：

- 真正符合 “space 高于 project” 的产品模型
- 不需要把 shared commands 复制到每个 project
- project override 语义天然清晰

缺点：

- 需要给 `Space` 增加 automation 相关持久化字段和 bridge

### 方案 B：把 shared commands 同步复制到每个 project 的 `.contextgo/commands.json`

优点：

- 运行时读取路径几乎不用改

缺点：

- project 文件会和 space 共享数据混在一起
- 复制、回写、冲突和漂移都很脏
- 破坏 `.contextgo/commands.json` 作为 project-local 真源的边界

### 方案 C：直接做完整 automation 继承模型

把 commands、hooks、schedules 一次性都拉到 `Space` 层。

优点：

- 概念完整

缺点：

- 首版改动面过大
- 很容易把 commands 这个最明确的需求和其他能力绑死

## 选定方案

选择方案 A。

理由：

- 这是唯一同时满足“space 共享”“project override”“不污染 project `.contextgo` 真源”的方案
- 也最符合当前 `Space -> Project -> Thread` 的长期产品边界
- 可以用最小改动先只落 `commands`

## 产品规则

### 1. 两层命令库

每个 conversation 的 managed commands 来自两层：

- `Space Commands`
- `Project Local Commands`

### 2. 生效顺序

有效命令顺序固定为：

1. `Space Commands`
2. `Project Local Commands`

冲突时：

- `Project Local Commands` 覆盖 `Space Commands`

这里的“冲突”以 slash command 名称为准，按大小写不敏感比较。

### 3. 自动继承

只要 conversation 绑定了 `spaceId`，就默认继承 `Space Commands`。

不需要用户在 project 里手动开启。

### 4. 编辑共享命令

从 project 场景进入 automation modal 时：

- 编辑 `Space Commands`，直接更新 `Space` 上的共享命令
- 不默认生成 local override

### 5. project-local 仍然保留

`Project Local Commands` 不删除，继续保留在 `.contextgo/commands.json`。

它的职责变成：

- 承载 project 专属命令
- 在同名时覆盖 `Space Commands`

## 信息架构

### Automation modal

首版不重命名产品文案，仍然叫 `Automation` / `自动化`。

现有 tab 保持不变：

- `skills`
- `hooks`
- `commands`
- `schedules`
- `runtime`

### Skill Market 入口

聊天头部移除单独的 `Project Skill Market` 按钮。

`Skill Market` 入口迁入 automation modal 的 `skills` tab。

首版采用最小改动方式：

- 保留现有 `ProjectSkillMarketModal`
- 在 `skills` tab 内提供入口按钮或区块打开它
- `Skill Market` 的安装目标仍然是当前 project 的 `.contextgo/skills`
- 没有 workspace 时，入口隐藏或禁用

这意味着这次只是“入口收口”，不是“skills 改成 space 共享”。

### Commands tab

`commands` tab 拆成两个独立区块：

1. `Space Commands`
2. `Project Local Commands`

首版复用现有 `ManagedCommandLibraryEditor` 两次，不做新的统一编辑器。

这样有几个好处：

- shared 和 local 的写入目标天然分开
- “编辑 shared command 直接改 space” 可以自然实现
- 不需要在一张混合列表里处理来源、回写目标和 override 行为

### 无 workspace / 无 space 的表现

- 有 `spaceId`、无 workspace：
  - 可以编辑 `Space Commands`
  - `Project Local Commands` 区块显示不可用
- 有 workspace、无 `spaceId`：
  - 继续只支持 `Project Local Commands`
  - `Space Commands` 区块显示不可用
- 两者都有：
  - 两个区块都可用

不做“猜测当前 selected space 并自动绑定”的隐式行为，避免把 project 错绑到错误的 `Space`。

## 数据模型

### Space 持久化

`Space Commands` 的真源存到 `Space` 持久化数据，而不是 project 文件。

首版建议给 `TSpace` 增加一个可扩展的 automation 状态：

```ts
type SpaceAutomationState = {
  version: 1;
  commands?: ManagedSlashCommandRecord[];
};

type TSpace = {
  // existing fields
  automation?: SpaceAutomationState;
};
```

数据库层新增 `spaces.automation_json` 列，序列化 `TSpace.automation`。

原因：

- 当前只做 `commands`
- 但字段命名需要给未来 `hooks` / `schedules` 预留空间
- 比单独塞一个顶层 `sharedCommands` 更容易演进

### Project 持久化

`Project Local Commands` 继续存到：

```text
.contextgo/commands.json
```

这个文件仍然只代表 project-local 命令层，不承载 space 共享层。

### Bridge / service 形态

首版不开放通用 `updateSpace` 给 renderer。

新增 commands 专用 bridge / service 即可：

- 读取某个 space 的 command library
- 保存某个 space 的 command library

这样改动更小，也避免把 renderer 直接耦合到完整 `TSpace` 更新语义。

## 生效合并规则

### Effective library

conversation 的 managed command library 计算规则为：

```text
effective = merge(spaceCommands, projectLocalCommands)
```

其中：

- `spaceCommands` 来自 `conversation.extra.spaceId -> Space.automation.commands`
- `projectLocalCommands` 来自 `conversation workspace -> .contextgo/commands.json`

### Merge 规则

先分别对两层命令做标准化，再合并：

- 每层内部先走 `normalizeManagedSlashCommandLibrary`
- 合并时按 command name 做大小写不敏感覆盖
- project-local 胜出

结果顺序：

- 先保留未被覆盖的 `Space Commands`
- 再追加 `Project Local Commands`

这样既满足“先 space 后 project”的展示顺序，也保证 project override 生效。

### Runtime 读取入口

首版把 merge 放在当前 managed command library 的读取路径上，而不是把 shared commands 复制到 project 文件里。

也就是：

- `conversationBridge.resolveManagedSlashCommandLibrary(...)` 负责读取并合并
- `useSlashCommands` 继续消费这个有效结果

这样 runtime 和 UI 对“什么命令实际生效”的理解是一致的。

## 编辑规则

### Space Commands

在 `commands` tab 的 `Space Commands` 区块里：

- 新建：写入 `Space.automation.commands`
- 编辑：写入 `Space.automation.commands`
- 删除：写入 `Space.automation.commands`
- 启停：写入 `Space.automation.commands`

### Project Local Commands

在 `Project Local Commands` 区块里：

- 新建：写入 `.contextgo/commands.json`
- 编辑：写入 `.contextgo/commands.json`
- 删除：写入 `.contextgo/commands.json`
- 启停：写入 `.contextgo/commands.json`

### Override 语义

如果 local command 与 shared command 同名：

- 当前 project 实际执行 local 版本
- 该 project 的 `Space Commands` 原记录仍保留，不被改写
- 同一 `Space` 下其他 project 仍继续看到 shared 版本

首版不做：

- 自动把 shared command 拷贝为 local override
- 在命令卡片上做复杂的 override 来源可视化
- “编辑继承行时弹选择器” 之类的混合交互

## 与现有 Agent Package 模型的关系

这次不改变 Agent Package 对 commands 的安装边界。

也就是：

- package command seeds 仍物化到 project `.contextgo/commands.json`
- `Space Commands` 是用户在 `Space` 维度维护的共享层
- 它不是 package payload install surface 的替代品

这能保持当前规则成立：

- package / workspace bootstrap 仍然是 project-local
- `Space Commands` 只是额外叠加的一层 ContextGo 产品能力

## 与 Space Vault / capability mirror 的关系

首版不改 `ProjectCapabilityService` 和 `SpaceVaultContextSyncService` 的边界。

保持：

- project capability 文档仍只镜像 project-local `.contextgo/*`
- `Space Commands` 不伪装成 project-local capability

原因：

- 当前 vault mirror 明确把 project 目录视为 project capability 的真源
- space 共享层属于新的 space-level automation 状态，不应该偷偷写进 project capability 语义里

如果以后需要在 vault 里浏览 `Space Commands`，应该单独设计 `space automation` 文档，而不是复用 project capability note。

## 兼容性与迁移

### 现有项目

现有 `.contextgo/commands.json` 完全保留，不需要迁移。

没有 shared commands 的旧项目行为不变。

### 现有 spaces

旧 space 记录默认没有 `automation_json`：

- 读取时按空命令库处理
- 不需要一次性迁移脚本

### 旧 conversation

如果旧 conversation 没有 `spaceId`：

- 继续只读取 project-local commands
- 不自动推断 shared commands 所属 space

这是为了避免错误绑定。

## 风险

### 1. conversation 未绑定 `spaceId`

这会让一部分旧会话暂时看不到 `Space Commands`。

这是可接受的首版取舍，因为错误继承比暂时缺失更危险。

### 2. 文案需要从“唯一真源”改成“两层来源”

当前命令相关文案大量写着 project `commands.json` 是唯一真源。

这次需要同步改成：

- project-local 是本地层真源
- space 有自己的共享层真源

否则 UI 会自相矛盾。

### 3. Skill Market 仍是 project-local

入口虽然收口进 automation modal，但它安装的仍然是 project-local skills。

这不是 bug，而是首版明确范围。

## 验证

至少补以下验证：

### Process / persistence

- `Space` 的 automation commands 能写入并读回
- 缺失 `automation_json` 时返回空库
- 合并时 project-local 同名命令覆盖 shared 命令

### Conversation slash commands

- 只有 `spaceId` 时返回 shared commands
- 只有 workspace 时返回 project-local commands
- 同时存在时返回 merge 后结果

### Renderer

- automation modal 的 `commands` tab 出现两个区块
- `Space Commands` 在没有 `spaceId` 时显示不可用
- `Project Local Commands` 在没有 workspace 时显示不可用
- `Skill Market` 入口出现在 automation modal 内
- 聊天头部不再渲染单独的 `Project Skill Market` 按钮

## 实施边界

这是 `C1. 最小改动版`。

落地时优先保证：

- source of truth 清晰
- merge 规则正确
- UI 收口成立

不在这一版顺手扩展：

- space-wide skills
- hooks / schedules 继承
- 命令市场
- 命令来源高级可视化
