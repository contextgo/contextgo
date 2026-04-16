# Project Runtime Boundary 设计

## 概述

这份设计为 ContextGo 当前支持的代码运行时定义一个按 `project` 收口的运行时边界：

- `gemini`
- `claude`
- `codex`
- `opencode`

目标是让运行时执行不再隐式消费 project 之外的全局用户状态，同时仍然允许用户决定某个 project 应该：

- 使用 ContextGo 托管的模型中心连接能力
- 导入本机已经配置好的本地 runtime
- 或在两者之间自动选择

这条边界覆盖：

- skills 加载
- runtime 配置文件
- 认证材料
- 模型默认选择
- 传给 runtime 子进程的环境变量

真正的执行边界应该是项目本身，而不是各 runtime 在用户主目录下的全局 home。

## 问题

当前实现是混合态：

- skills 正在逐步投影到 workspace 本地 runtime 目录
- 但 runtime config、auth、model default 仍然来自全局用户目录，例如 `~/.claude`、`~/.codex` 或 XDG home 路径
- shell 继承来的环境变量，例如 `CODEX_API_KEY`、`OPENAI_API_KEY`、`ANTHROPIC_*`，仍然会被传给 runtime 子进程

这会带来三个产品问题：

1. 一个 project 可能意外吃到 project 之外的规则、凭据或配置
2. skills 和 model/config state 的边界不一致
3. ContextGo 无法把模型中心干净地建模为项目自有能力，因为 runtime 行为仍依赖外部全局状态

## 目标

- 让当前 project 成为默认 runtime 边界
- 默认情况下禁止 runtime 子进程直接消费全局 runtime config
- 每个 project 只保留一份统一的 runtime policy，而不是按 agent 或 backend 再拆
- 允许用户为某个 project 选择：
  - 使用 ContextGo 托管的模型中心
  - 导入本地已配置好的 runtime
  - 或自动在两者之间回退
- 让 runtime-native 的 skill 目录仅作为 projection 目标
- 让 project 自有状态成为 runtime 执行的长期真实来源

## 非目标

- 不在这次设计里重做完整 assistant package 模型
- 不在这次设计里完整重做每个 runtime 的原生配置 schema
- 不要求首版无损导入所有第三方 runtime 配置
- 不改变当前支持的 coding runtime 集合
- 不在单个 project 内引入按 agent 或按 runtime 再分裂的 policy

## 产品规则

每个 project 只有一份 runtime boundary policy。

这份 policy 对该 project 中使用的所有支持中的 coding runtime 生效。

用户不应该在同一个 project 里再分别配置 Claude、Codex、OpenCode 的 runtime home 归属。用户只配置一份 project-level policy，剩下的 runtime-specific projection 由 ContextGo 负责物化。

## 选定模型

### 1. Project 级 runtime policy

每个 project 存储一份统一的 runtime policy，支持三个模式：

- `project_managed`
- `import_local_runtime`
- `auto`

含义如下：

- `project_managed`
  - ContextGo 模型中心是真实来源
  - runtime config 和 auth material 都被物化到 project 边界内
- `import_local_runtime`
  - 用户显式选择“使用我本机已经配置好的 runtime”
  - ContextGo 把需要的 config/auth material 导入到 project 边界
  - runtime 运行时仍然只读 project 内状态，不直接读全局 home
- `auto`
  - ContextGo 先尝试导入本地 runtime 配置
  - 如果没有可用的本地 runtime config，再回落到模型中心路径
  - 最终解析出来的有效状态仍然物化在 project 边界内

### 2. Project runtime home

每个 project 都拥有一份 project-owned runtime 根目录：

```text
.contextgo/runtime/
```

建议的首版布局：

```text
.contextgo/runtime/
  runtime.json
  skills/
  claude/
  codex/
  opencode/
  gemini/
```

这就是 runtime 自有状态的执行边界。

workspace 根目录下的 runtime-native 目录继续保留为兼容投影层：

```text
.claude/
.codex/
.opencode/
.gemini/
```

这些根目录下的 runtime 目录只是 runtime 兼容层需要时的派生视图，不是主要真实来源。

### 3. Project-owned 环境变量构建

启动 runtime 子进程时，ContextGo 应构造一套 project-scoped 环境，而不是直接透传用户全局 runtime home。

至少必须显式控制：

- `HOME`
- `XDG_CONFIG_HOME`
- `XDG_DATA_HOME`

同时必须停止无条件继承 shell 环境中的 runtime auth 变量，特别是：

- `CODEX_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`

如果某个 project 选择的模式确实需要这些值，ContextGo 应该在 policy 解析之后，以 project-selected 的形式重新注入，而不是直接吃 shell 里的全局值。

## 存储模型

### `runtime.json`

`runtime.json` 是 project 级 runtime policy 文档。

首版建议结构：

```json
{
  "version": 1,
  "mode": "project_managed",
  "resolvedSource": "model_center",
  "providerProtocol": "openai",
  "baseUrl": "https://example.internal/v1",
  "apiKeyRef": "project-secret:runtime-primary",
  "defaultModel": "gpt-5.4",
  "importedFrom": null,
  "lastImportedAt": null
}
```

字段含义：

- `mode`
  - 用户选择的 policy
- `resolvedSource`
  - `auto` 模式下最终解析出来的有效来源
- `providerProtocol`
  - 当前 project 选择的模型中心条目所使用的消息协议，例如 OpenAI-compatible 或 Anthropic-compatible
- `apiKeyRef`
  - 指向 project 自有的 secret material，或者 ContextGo 内部 project-scoped 的 secure-store 引用
- `defaultModel`
  - 该 project 跨支持中的 coding runtime 共享的默认模型标识

### Secret 处理

敏感值不应要求以明文形式直接提交进用户仓库。

允许的实现方式包括：

- project-scoped 的本地 secret 文件，并放在被忽略的 runtime state 下
- ContextGo 内部 project-scoped 的 secure-store 引用

这里真正重要的是架构规则，而不是具体存储格式：

- 运行时看到的 secret 必须是 project-scoped 的
- runtime 在执行时不需要回到 project 之外去拿它

## Skill 边界规则

Project runtime boundary 对 skills 的要求，必须和它对 model config 的要求一样严格。

必须满足：

- runtime discovery 只能看到 project-local 的 skill projection
- 全局 user skill 目录不能继续作为 live runtime source
- bundled/package skills 即使来自内置资源，也应该物化到 project 自有状态，而不是长期以 project 外 symlink source 的形式存在
- 如果用户希望把某个全局 skill 或 packaged skill 用到某个 project，ContextGo 应把它导入或物化到 project 边界内

这比当前实现更严格。当前实现里，project 下的 runtime 目录虽然存在，但仍可能通过 symlink 指向 project 外 skill source。

## 导入模型

`import_local_runtime` 必须是导入流程，而不是 passthrough 模式。

这个区别非常关键。

如果用户选择使用本机已经配置好的 runtime，ContextGo 应该：

1. 检查该 runtime 的全局 config/auth 位置
2. 提取最小必要的 runtime state
3. 在需要时做归一化或协议翻译
4. 写入 `.contextgo/runtime/<runtime>/...`
5. 使用 project-scoped runtime home 启动 runtime

导入完成后，runtime 执行不应再继续依赖原始全局文件。

### 首批导入目标

- Claude
  - 从 `~/.claude/settings.json` 导入
- Codex
  - 从 `~/.codex/config.toml` 导入
  - 同时导入相邻 auth material，例如 `auth.json`
- OpenCode
  - 从 `~/.config/opencode/opencode.json` 导入
  - 同时导入 XDG data 下的 auth 路径
- Gemini
  - 从当前 runtime 使用的 managed settings 位置导入

首版导入允许是部分导入。

首批只导入这些核心内容就够：

- model identity
- auth/base URL material
- 必要的执行参数

不要求第一阶段完整保留所有上游 runtime 的可选偏好项。

## ContextGo 模型中心集成

`project_managed` 模式应直接使用 ContextGo 的模型中心作为 runtime source。

产品已经具备统一模型中心抽象：

- 一套 API base
- 一套 key 或 auth material
- 一套消息协议契约，例如 OpenAI-compatible 或 Anthropic-compatible

Project runtime policy 应直接绑定到这层抽象。

必须满足：

- project 能记录自己选择的是哪一个模型中心 provider entry
- ContextGo 根据这个 project 选择去物化 runtime-specific config projection
- runtime 子进程最终只拿到 project-scoped 的 config 和 env

这样 ContextGo 就能支持多个 runtime CLI，而不必把它们各自的全局配置目录当成产品边界。

## Runtime-specific Projection 规则

Project runtime boundary 仍然是统一的，但每个 runtime 依然需要自己的兼容投影。

### Claude

- runtime settings path 解析必须变成按 project 感知
- model selection 应从 project runtime state 来，不再直接依赖 `~/.claude/settings.json`
- 如果 Claude 需要任何 runtime-facing 的 entry docs 或 config file，也应从 project runtime boundary 生成

### Codex

- config 和 auth path 解析必须变成按 project 感知
- approval policy 和 default model 应从 project runtime state 获取
- 一旦启用 project boundary，`~/.codex/config.toml` 不应再是活跃执行路径

### OpenCode

- config 和 auth 位置必须改成解析到 project runtime boundary 内
- ContextGo 需要把兼容文件物化到 `.contextgo/runtime/opencode/`

### Gemini

- 现有 managed settings lookup 在 project boundary 开启后，也应改成 project-owned 解析
- 模型中心映射应驱动 Gemini runtime 的有效模型来源

## 启动链路

需要引入一个专门的 runtime boundary resolver service。

建议服务名：

- `ProjectRuntimeService`

职责：

1. 读取 project 的 runtime policy
2. 解析有效来源是 `model_center` 还是 imported local runtime
3. 物化 runtime-specific config 到 project 自有状态
4. 构造 project-scoped 环境变量
5. 向上层返回可直接用于启动的 runtime metadata

建议启动顺序：

1. conversation/runtime 创建时先识别目标 workspace
2. runtime bootstrap 调用 `ProjectRuntimeService.resolve(workspace)`
3. service 确保 `.contextgo/runtime/` 已经最新
4. service 返回：
   - effective mode
   - runtime home 路径
   - 过滤后的环境变量
   - runtime-specific config 路径
5. 子进程启动时只使用这些值，不再回落去读 shell-global runtime config

## UI 与用户控制

Project 层面应该只暴露一套统一 runtime policy 控件。

不应该让用户在同一个 project 里再分别给 Claude、Codex、OpenCode 配一遍。

建议的 project-level 选项：

- `使用 ContextGo 模型中心`
- `导入本地 Runtime 配置`
- `自动`

配套动作：

- `立即导入`
- `重新导入本地配置`
- `重置为项目托管`
- `查看当前生效的 runtime config`

设置页和诊断页也应显示 project runtime config 的位置，而不是只显示全局 home 目录下的 config path。

## 迁移策略

### Phase 1：先把 project boundary 立住

这一阶段优先解决执行边界正确性，不追求完整 UX。

范围：

- 增加 project runtime policy 存储
- 增加 project runtime home 创建逻辑
- 过滤继承来的全局 runtime env 变量
- 把 runtime config path 解析改成按 project 感知
- 让 skills 真正变成 project-only，并物化到 project 自有状态

### Phase 2：补齐产品化集成

范围：

- 把 project runtime policy 和模型中心 UI / 存储打通
- 增加 import / re-import UX
- 完善 diagnostics 和 config viewer
- 补全各 runtime-specific import 的细节

这样分阶段可以把第一阶段聚焦在“边界必须正确”，降低整体落地风险。

## 主要改动点

预期第一批主要代码触点：

- `src/process/utils/initAgent.ts`
  - workspace skill materialization 和 runtime projection
- `src/process/utils/shellEnv.ts`
  - shell 继承过滤与 project-scoped env 构建
- `src/process/agent/acp/acpConnectors.ts`
  - 给 ACP runtime 注入 project runtime home
- `src/process/agent/acp/index.ts`
  - 去掉直接读取全局 Claude model 的逻辑
- `src/process/agent/acp/utils.ts`
  - Claude settings path resolver 改成按 project 感知
- `src/process/agent/codex/connection/CodexConnection.ts`
  - Codex config/auth path resolver 改成按 project 感知
- `src/process/bridge/acpConversationBridge.ts`
  - 设置页与 diagnostics 改为展示 project runtime config，而不是只展示全局 config
- 在 `src/process/services/` 下新增 project runtime resolver/service

## 验收标准

- 一个 project 在默认情况下可以运行支持中的 coding runtime，而不直接读取全局 runtime config
- 一个 project 可以在模型中心托管与导入本地 runtime 两种模式之间切换
- 本地 runtime 配置是被导入到 project 边界，而不是长期 passthrough 到全局 home
- runtime 子进程最终只看到 project-selected 的 auth/config env
- runtime skill discovery 只看到 project 自有的 skill state
- 设置与诊断界面能够解释当前 project 的有效 runtime source

## 风险

### Runtime 兼容性缺口

部分 runtime 默认假定自己运行在用户全局 home 语义下。把它们切到 project-scoped runtime home 后，可能暴露兼容性边角问题。

### 导入保真度有限

首版导入不一定能完整保留所有上游配置。第一阶段应优先保证 model/auth 执行正确，而不是追求所有偏好项无损迁移。

### 测试基线扩散

当前大量测试默认使用全局 config path。路径解析改成按 project 感知后，需要同步更新不少 fixture。

### Secret 存储方案

Project-scoped secret 到底落本地忽略文件还是 secure store，需要和 ContextGo 的安全存储边界一起定，但这不应该阻塞 project boundary 本身先落下来。

## 为什么这样设计

这份设计故意是严格的。

如果 ContextGo 允许 runtime 执行继续直接消费全局 config，那么即便 skills 已经 project 化，也不代表真正建立了 project boundary。runtime 仍然有一部分在 project 外。

把“使用本地已配置 runtime”建模为 import flow，而不是 passthrough flow，就能在保留用户选择权的同时，不牺牲你要的干净 project 边界。这也是后续这些能力成立的基础：

- 可预测的执行语义
- project-scoped 的模型中心集成
- 更好的远程执行 / 迁移可移植性
- 更清晰的产品边界
