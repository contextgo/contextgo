---
title: Runtime Center
slug: /agents/runtime-center
description: 统一查看 Gemini、Claude Code、Codex、OpenCode 的安装、登录、配置、健康检查与外部 session 状态。
---

# Runtime Center

Runtime Center 是 ContextGo 里理解运行时状态的总入口。

它不是只告诉你“支持哪些 runtime”，而是把真正影响可用性的几层状态拆开：

- 有没有被发现
- 有没有完成登录或配置
- 能不能真正启动
- 有没有现成的外部 session 可以直接接管

## Runtime Center 在看什么

当前产品可见的运行时集合是：

- Gemini
- Claude Code
- Codex
- OpenCode

ContextGo 不把这些 runtime 的原生 home 目录搬进项目，也不会把 `.contextgo/` 当成某个 runtime 的私有 home。

更准确的说法是：

- ContextGo 识别 runtime-native global state
- ContextGo 在工作区根目录投影必要的 runtime workspace projection
- ContextGo 自己的项目元数据仍然留在 `.contextgo/`

## 运行时检测链路

当前产品对运行时的判断，大致分成四层：

### 1. 发现 CLI

系统会先尝试找到对应可执行文件：

- macOS / Linux 优先走 `which`
- Windows 优先走 `where`，必要时回退到 PowerShell `Get-Command`
- 检测时会先合并登录 shell 环境，再看 Finder / launchd 启动环境里缺失的 PATH
- 如果用户手动保存过自定义路径，也会参与最终解析

这一步回答的是：

- 这台主机上有没有这个 runtime 的可执行入口

### 2. 读取配置与鉴权位置

ContextGo 会识别该 runtime 的常见配置或鉴权文件位置，用来告诉你：

- 配置文件大概在哪里
- 认证状态应该去哪里排查

这一步不意味着 runtime 一定 ready，只是提供排查入口。

### 3. 真正启动可用性检查

Ready 不是“看起来存在”。

Runtime Center 里的健康检查会实际尝试启动或握手，这一步才更接近：

- 当前主机真的能启动这个 runtime
- 当前配置和登录状态足不足以发起任务

### 4. 外部 session 发现

如果某个 runtime 已经在原生环境里跑过会话，ContextGo 还会扫描这些 runtime-native global state 里的 session 线索，判断：

- 有没有现成会话可以接管
- 当前工作区能不能直接沿用已有上下文继续工作

## 已安装、已登录、已就绪，不是一个概念

Runtime Center 里最重要的不是“装了没”，而是不要把几个状态混成一个模糊的“已连接”。

- Installed / Detected
  - 说明可执行入口已经被找到
- Signed In / Configured
  - 说明配置文件或认证材料已经具备
- Ready
  - 说明当前主机和当前工作区真的可以启动任务

专门解释这层差异的页面在这里：

- [Installed, Signed In, Ready](./installed-signed-in-ready)

## 当前产品内一键安装支持

目前 Runtime Center 的“一键安装”采用同一条产品链路：

- 在产品内点击安装
- 由桌面主机执行 `npm install -g ...`
- 安装结束后立即刷新检测

这条链路当前对 macOS、Linux、Windows 统一成立，但它有明确边界：

- 它依赖本机已有 Node.js / npm
- 它当前不按平台切换为 `brew`、`apt`、`winget`、`choco`
- 它负责“把 CLI 安装上”，不替代后续的登录、配置、模型策略确认

当前产品支持的一键安装 runtime：

- Gemini
- Claude Code
- Codex
- OpenCode

## 每个 runtime 在 ContextGo 里怎么看

### Gemini

- CLI 检测名：`gemini`
- 常见用户配置：`~/.gemini/settings.json`
- 外部 session 发现线索：`~/.gemini/tmp/.../chats/session-*.json`
- 产品内一键安装：支持
- 官方文档：
  - [Gemini CLI Docs](https://geminicli.com/docs/)
  - [Installation](https://geminicli.com/docs/get-started/installation/)
  - [Authentication](https://geminicli.com/docs/get-started/authentication/)
  - [GitHub Repository](https://github.com/google-gemini/gemini-cli)

### Claude Code

- CLI 检测名：`claude`
- 常见用户配置：`~/.claude/settings.json`
- 外部 session 发现线索：`~/.claude/projects/**/*.jsonl`
- 产品内一键安装：支持
- 官方文档：
  - [Claude Code Quickstart](https://code.claude.com/docs/en/quickstart)
  - [Claude Code Settings](https://code.claude.com/docs/en/settings)
  - [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows)

### Codex

- CLI 检测名：`codex`
- 常见用户配置：`~/.codex/config.toml`
- 常见鉴权文件：`~/.codex/auth.json`
- 外部 session 发现线索：`~/.codex/state_*.sqlite`
- 产品内一键安装：支持
- 官方文档：
  - [OpenAI Codex CLI](https://developers.openai.com/codex/cli)
  - [Codex GitHub Repository](https://github.com/openai/codex)

### OpenCode

- CLI 检测名：`opencode`
- 常见配置与状态目录：
  - `~/.config/opencode/`
  - `~/.local/share/opencode/`
- 外部 session 发现线索：原生 `opencode.db`
- 产品内一键安装：支持
- 官方文档：
  - [OpenCode CLI Docs](https://opencode.ai/docs/cli/)

## ContextGo 和官方 runtime 的差异

如果只看官方 runtime 文档，你会看到的是各自的 CLI、会话、配置和原生工作流。

ContextGo 叠加的是另一层产品能力：

- **外部 session 接管**
  - 发现并导入已有会话，不要求你先手工导出一份历史
- **Context Engine**
  - 用 session、project、space、memory、governance 这一整套模型管理上下文，而不是只依赖单一 CLI 的局部会话历史
- **Context Connector**
  - 把文件、网页、协作工具、知识库、业务系统等外部上下文接进来
- **IM 多端发布**
  - 把 Agent 发布到 Telegram、Slack、Lark、Discord 等入口，并继续复用同一套上下文与能力包
- **Agent Package / Skills / Hooks / Commands / Schedules**
  - 在 runtime 之上提供开箱即用的产品能力层，而不是把第三方 CLI 的工作区布局直接当成产品边界

## 什么时候该继续看“接管外部 session”

如果你的真实问题不是“怎么装”，而是：

- 我已经在官方 CLI 里跑过一些会话
- 我想把那些对话直接带进 ContextGo
- 我不想手工复制一份历史再重开

那应该看：

- [External Session Takeover](./external-session-takeover)

## 下一步

- 想先分清状态差异：看 [Installed, Signed In, Ready](./installed-signed-in-ready)
- 想理解如何接管已有会话：看 [External Session Takeover](./external-session-takeover)
- 想从真实编码工作流进入：看 [Coding And Builder Workflow](../use-cases/coding-and-builder-workflow)
