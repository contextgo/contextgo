# ContextGo Headless Server Deployment Guide

Deploy ContextGo WebUI on headless Linux servers — cloud VMs, Kubernetes Pods, and containers — with proxy auto-fallback support.

**Translations**: [中文版](#中文版--chinese-version) below.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Virtual Display (Xvfb)](#virtual-display-xvfb)
- [Service Management Script](#service-management-script)
- [Remote Access](#remote-access)
- [Proxy with Auto-Fallback](#proxy-with-auto-fallback)
- [Troubleshooting](#troubleshooting)
- [Architecture Overview](#architecture-overview)

---

## Prerequisites

- Linux x86_64 (Ubuntu 20.04+ / Debian 11+ recommended)
- At least 2GB RAM
- ContextGo `.deb` package from [contextgo/contextgo-releases](https://github.com/contextgo/contextgo-releases/releases)

---

## Installation

```bash
# Resolve the latest public release from contextgo/contextgo-releases
VERSION=$(curl -fsSL "https://api.github.com/repos/contextgo/contextgo-releases/releases/latest" \
  | grep '"tag_name"' | head -1 | sed 's/.*"v\([^\"]*\)\".*/\1/')
DEB_FILENAME="ContextGo-${VERSION}-linux-amd64.deb"

# Download the latest .deb package
wget "https://github.com/contextgo/contextgo-releases/releases/download/v${VERSION}/${DEB_FILENAME}"

# Install
sudo dpkg -i "$DEB_FILENAME"
sudo apt-get install -f -y  # Fix missing dependencies
```

> **Package note**: The current public Linux x64 asset resolves to `ContextGo-1.0.0-linux-amd64.deb`.
>
> **Container note**: If you encounter dependency errors for `libegl1` / `libgles2` (common with NVIDIA runtime in containers), use `dpkg --force-all -i "$DEB_FILENAME"` to force install.

---

## Virtual Display (Xvfb)

ContextGo is an Electron app and requires a display server. On headless servers (no monitor), use Xvfb to create a virtual display:

```bash
sudo apt-get install -y xvfb
```

Xvfb is used automatically by the startup script below via `xvfb-run`.

---

## Service Management Script

Since many cloud/container environments lack systemd, use the following nohup-based script.

Create `/opt/ContextGo/start-contextgo.sh`:

```bash
#!/bin/bash
# ContextGo WebUI headless startup script
# Usage: ./start-contextgo.sh [start|stop|restart|status]

PIDFILE="/var/run/contextgo.pid"
LOGFILE="/var/log/contextgo.log"
WORKDIR="$HOME"  # Change to your workspace directory

start() {
    if [ -f "$PIDFILE" ] && kill -0 "$(cat $PIDFILE)" 2>/dev/null; then
        echo "ContextGo is already running (PID: $(cat $PIDFILE))"
        return 1
    fi
    echo "Starting ContextGo WebUI..."
    cd "$WORKDIR"

    nohup xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" \
        /usr/bin/ContextGo --webui --remote --no-sandbox \
        > "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    sleep 3
    if kill -0 "$(cat $PIDFILE)" 2>/dev/null; then
        echo "ContextGo started successfully (PID: $(cat $PIDFILE))"
        echo "WebUI: http://$(hostname -I | awk '{print $1}'):25809"
    else
        echo "ContextGo failed to start. Check log: $LOGFILE"
        rm -f "$PIDFILE"
        return 1
    fi
}

stop() {
    if [ ! -f "$PIDFILE" ]; then
        echo "ContextGo is not running (no PID file)"
        return 1
    fi
    PID=$(cat "$PIDFILE")
    echo "Stopping ContextGo (PID: $PID)..."
    kill "$PID" 2>/dev/null
    sleep 2
    kill -9 "$PID" 2>/dev/null
    pkill -f "ContextGo --webui" 2>/dev/null
    rm -f "$PIDFILE"
    echo "ContextGo stopped."
}

restart() {
    stop
    sleep 1
    start
}

status() {
    if [ -f "$PIDFILE" ] && kill -0 "$(cat $PIDFILE)" 2>/dev/null; then
        echo "ContextGo is running (PID: $(cat $PIDFILE))"
        ss -tlnp | grep 25809
    else
        echo "ContextGo is not running."
        rm -f "$PIDFILE" 2>/dev/null
    fi
}

case "${1:-start}" in
    start)   start ;;
    stop)    stop ;;
    restart) restart ;;
    status)  status ;;
    *)       echo "Usage: $0 {start|stop|restart|status}" ;;
esac
```

```bash
chmod +x /opt/ContextGo/start-contextgo.sh
```

> **Tip**: `WORKDIR` determines the directory ContextGo can access for file operations. Set it to your project workspace.

---

## Remote Access

The current public Linux `.deb` package starts ContextGo WebUI on port **25809** in `--webui` mode. Choose a method based on your network setup:

### Option A: Direct Access (Public IP)

Open port 25809 in your cloud provider's security group or firewall, then access via `http://YOUR_SERVER_IP:25809`.

### Option B: ngrok Tunnel (NAT / K8s / No Public IP)

```bash
pip3 install pyngrok
ngrok config add-authtoken YOUR_TOKEN

# Start tunnel
nohup ngrok http 25809 --log=stdout > /var/log/ngrok.log 2>&1 &

# Get public URL
curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "
import sys, json
[print(t['public_url']) for t in json.load(sys.stdin)['tunnels']]
"
```

> Note: ngrok free tier generates a new URL on each restart. You can claim a free static domain at [ngrok dashboard](https://dashboard.ngrok.com/).

### Option C: SSH Tunnel (From Your Local Machine)

```bash
ssh -L 25809:127.0.0.1:25809 user@YOUR_SERVER_IP
# Then access: http://localhost:25809
```

---

## Proxy with Auto-Fallback

If your server needs a proxy for certain APIs (e.g., via an SSH reverse tunnel to a local VPN), use the **PAC auto-fallback** approach: try proxy first, fall back to direct connection when the proxy is unavailable. No restart needed.

### Step 1: SSH Reverse Tunnel (Run on Your Local Machine)

Forward your local proxy port to the server:

```bash
ssh -R 7897:127.0.0.1:7897 user@YOUR_SERVER_IP
```

> Replace `7897` with your actual proxy port. The tunnel is active as long as the SSH session is open.

### Step 2: PAC File for ContextGo (Electron / Chromium Layer)

Using `--proxy-server` is fragile — when the proxy goes down, **all** requests fail including the WebUI itself. Instead, use a **PAC (Proxy Auto-Configuration) file** that provides automatic fallback.

Create `/opt/ContextGo/proxy.pac`:

```javascript
function FindProxyForURL(url, host) {
  // Localhost and private networks: always direct
  if (
    isPlainHostName(host) ||
    host === '127.0.0.1' ||
    host === 'localhost' ||
    shExpMatch(host, '10.*') ||
    shExpMatch(host, '192.168.*') ||
    shExpMatch(host, '172.16.*')
  ) {
    return 'DIRECT';
  }
  // All other requests: try proxy first, fallback to direct
  return 'PROXY 127.0.0.1:7897; DIRECT';
}
```

Then update the `nohup xvfb-run ...` line in your startup script:

```bash
    nohup xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" \
        /usr/bin/ContextGo --webui --remote --no-sandbox \
        --proxy-pac-url="file:///opt/ContextGo/proxy.pac" \
        > "$LOGFILE" 2>&1 &
```

**How it works**:

- Chromium natively supports PAC proxy rules
- `"PROXY 127.0.0.1:7897; DIRECT"` means: try the proxy, and if it fails (connection refused / timeout), automatically fall back to a direct connection
- Failover is per-request and real-time — no restart needed when the SSH tunnel connects or disconnects

### Step 3: Auto-Detect Proxy for Shell Commands

Shell tools like `curl` and `wget` use `http_proxy` environment variables. Add automatic detection to `~/.bashrc` so the proxy env vars are set/unset dynamically before every command:

```bash
# === Proxy Auto-Detect ===
_auto_proxy() {
    if (echo > /dev/tcp/127.0.0.1/7897) 2>/dev/null; then
        export http_proxy=http://127.0.0.1:7897
        export https_proxy=http://127.0.0.1:7897
        export ALL_PROXY=socks5://127.0.0.1:7897
    else
        unset http_proxy https_proxy ALL_PROXY 2>/dev/null
    fi
}
_auto_proxy
PROMPT_COMMAND="_auto_proxy;${PROMPT_COMMAND}"
# === Proxy Auto-Detect End ===
```

**How it works**:

- `PROMPT_COMMAND` runs before every shell prompt, re-checking proxy availability
- SSH tunnel connected → proxy env vars set automatically
- SSH tunnel disconnected → proxy env vars cleared, commands use direct connection
- No manual intervention or terminal restart needed

### Step 4: ContextGo Internal Proxy (Gemini API)

For Gemini API calls, configure the proxy inside ContextGo WebUI:

**Settings → Gemini Settings → Proxy** → `http://127.0.0.1:7897`

> This proxy is handled by ContextGo's Node.js layer (separate from the Chromium layer). When the SSH tunnel is down, Gemini API calls will fail, but the WebUI and other APIs remain functional.

---

## Troubleshooting

| Issue                                     | Solution                                                     |
| ----------------------------------------- | ------------------------------------------------------------ |
| `dpkg` dependency errors in containers    | `dpkg --force-all -i "$DEB_FILENAME"`                        |
| ContextGo can only access `/tmp`          | Set `WORKDIR` in the startup script to your workspace path   |
| WebUI not accessible remotely             | Check firewall rules, or use ngrok / SSH tunnel              |
| All requests fail when proxy is down      | Use PAC file (`--proxy-pac-url`) instead of `--proxy-server` |
| `curl` fails after SSH tunnel disconnects | Add `PROMPT_COMMAND` auto-detect to `~/.bashrc` (see Step 3) |
| Port 25809 already in use                 | `kill $(lsof -t -i:25809)` then restart                      |
| Xvfb errors                               | `apt-get install -y xvfb libxkbcommon-x11-0`                 |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│  Headless Linux Server / Container               │
│                                                  │
│  start-contextgo.sh                                 │
│       │                                          │
│       ▼                                          │
│  xvfb-run (virtual display)                      │
│       │                                          │
│       ▼                                          │
│  ┌────────────────────────────┐                  │
│  │  ContextGo (Electron)        │                   │
│  │  ├─ Chromium (port 25809) │                   │
│  │  │  └─ proxy.pac          │──► PAC decides:   │
│  │  │     per-request        │   PROXY or DIRECT │
│  │  └─ Node.js (API calls)   │                   │
│  └────────────────────────────┘                  │
│           │                                      │
│           ▼                                      │
│  ┌─────────────────────────┐                     │
│  │ SSH Reverse Tunnel      │                     │
│  │ 127.0.0.1:7897          │                     │
│  │ (when available)        │                     │
│  └─────────────────────────┘                     │
│           │                                      │
│  ┌────────┴───────┐                              │
│  │  ngrok tunnel  │ (optional, for public URL)   │
│  └────────────────┘                              │
└──────────────────────────────────────────────────┘
```

---

---

# 中文版 / Chinese Version

# ContextGo 无头服务器部署指南

在无图形界面的 Linux 服务器（云主机、K8s Pod、容器）上部署 ContextGo WebUI，支持代理自动回退。

## 前置条件

- Linux x86_64（推荐 Ubuntu 20.04+ / Debian 11+）
- 至少 2GB 内存
- ContextGo `.deb` 安装包（[下载地址](https://github.com/contextgo/contextgo-releases/releases)）

## 安装

```bash
# 获取 contextgo/contextgo-releases 的最新版本号
VERSION=$(curl -fsSL "https://api.github.com/repos/contextgo/contextgo-releases/releases/latest" \
  | grep '"tag_name"' | head -1 | sed 's/.*"v\([^\"]*\)\".*/\1/')
DEB_FILENAME="ContextGo-${VERSION}-linux-amd64.deb"

# 下载最新 .deb 包
wget "https://github.com/contextgo/contextgo-releases/releases/download/v${VERSION}/${DEB_FILENAME}"

# 安装
sudo dpkg -i "$DEB_FILENAME"
sudo apt-get install -f -y  # 修复依赖
```

> **安装包说明**：当前公开 Linux x64 安装包会解析到 `ContextGo-1.0.0-linux-amd64.deb`。
>
> **容器环境**：若遇到 `libegl1` / `libgles2` 依赖错误（常见于 NVIDIA 运行时），可用 `dpkg --force-all -i "$DEB_FILENAME"` 强制安装。

## 虚拟显示 (Xvfb)

ContextGo 是 Electron 应用，需要显示服务。无头服务器需安装 Xvfb：

```bash
sudo apt-get install -y xvfb
```

## 服务管理脚本

许多云/容器环境没有 systemd，使用以下基于 nohup 的管理脚本。

创建 `/opt/ContextGo/start-contextgo.sh`：

```bash
#!/bin/bash
# ContextGo WebUI 无头启动脚本
# 用法: ./start-contextgo.sh [start|stop|restart|status]

PIDFILE="/var/run/contextgo.pid"
LOGFILE="/var/log/contextgo.log"
WORKDIR="$HOME"  # 改为你的工作目录

start() {
    if [ -f "$PIDFILE" ] && kill -0 "$(cat $PIDFILE)" 2>/dev/null; then
        echo "ContextGo 已在运行 (PID: $(cat $PIDFILE))"
        return 1
    fi
    echo "正在启动 ContextGo WebUI..."
    cd "$WORKDIR"

    nohup xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" \
        /usr/bin/ContextGo --webui --remote --no-sandbox \
        > "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    sleep 3
    if kill -0 "$(cat $PIDFILE)" 2>/dev/null; then
        echo "ContextGo 启动成功 (PID: $(cat $PIDFILE))"
        echo "WebUI: http://$(hostname -I | awk '{print $1}'):25809"
    else
        echo "ContextGo 启动失败，请查看日志: $LOGFILE"
        rm -f "$PIDFILE"
        return 1
    fi
}

stop() {
    if [ ! -f "$PIDFILE" ]; then
        echo "ContextGo 未在运行"
        return 1
    fi
    PID=$(cat "$PIDFILE")
    echo "正在停止 ContextGo (PID: $PID)..."
    kill "$PID" 2>/dev/null
    sleep 2
    kill -9 "$PID" 2>/dev/null
    pkill -f "ContextGo --webui" 2>/dev/null
    rm -f "$PIDFILE"
    echo "ContextGo 已停止。"
}

restart() { stop; sleep 1; start; }

status() {
    if [ -f "$PIDFILE" ] && kill -0 "$(cat $PIDFILE)" 2>/dev/null; then
        echo "ContextGo 运行中 (PID: $(cat $PIDFILE))"
        ss -tlnp | grep 25809
    else
        echo "ContextGo 未在运行。"
        rm -f "$PIDFILE" 2>/dev/null
    fi
}

case "${1:-start}" in
    start) start ;; stop) stop ;; restart) restart ;; status) status ;;
    *) echo "用法: $0 {start|stop|restart|status}" ;;
esac
```

## 远程访问

当前公开 Linux `.deb` 包在 `--webui` 模式下实际监听端口为 **25809**，根据网络环境选择访问方式：

| 方式       | 适用场景              | 命令                                       |
| ---------- | --------------------- | ------------------------------------------ |
| 直接访问   | 有公网 IP             | 安全组开放 25809 端口                      |
| ngrok 穿透 | NAT / K8s / 无公网 IP | `ngrok http 25809`                         |
| SSH 隧道   | 仅个人使用            | `ssh -L 25809:127.0.0.1:25809 user@server` |

## 代理自动回退

当服务器需要通过代理访问某些 API（如通过 SSH 反向隧道连接本地 VPN）时，使用 **PAC 自动回退**：代理可用时走代理，不可用时自动直连，无需重启。

### 第一步：SSH 反向隧道（本地电脑执行）

```bash
ssh -R 7897:127.0.0.1:7897 user@YOUR_SERVER
```

### 第二步：PAC 代理文件（ContextGo Electron 层）

`--proxy-server` 的问题：代理一断，**所有请求**全挂。改用 PAC 文件实现自动回退。

创建 `/opt/ContextGo/proxy.pac`：

```javascript
function FindProxyForURL(url, host) {
  if (
    isPlainHostName(host) ||
    host === '127.0.0.1' ||
    host === 'localhost' ||
    shExpMatch(host, '10.*') ||
    shExpMatch(host, '192.168.*') ||
    shExpMatch(host, '172.16.*')
  ) {
    return 'DIRECT';
  }
  return 'PROXY 127.0.0.1:7897; DIRECT';
}
```

启动脚本中添加参数：`--proxy-pac-url="file:///opt/ContextGo/proxy.pac"`

**原理**：Chromium 原生支持 PAC，`PROXY ...; DIRECT` 表示先尝试代理，失败自动直连，每个请求实时判断。

### 第三步：Shell 命令代理自动检测

在 `~/.bashrc` 中添加，让 `curl` 等命令也能自动检测代理：

```bash
# === Proxy Auto-Detect ===
_auto_proxy() {
    if (echo > /dev/tcp/127.0.0.1/7897) 2>/dev/null; then
        export http_proxy=http://127.0.0.1:7897
        export https_proxy=http://127.0.0.1:7897
        export ALL_PROXY=socks5://127.0.0.1:7897
    else
        unset http_proxy https_proxy ALL_PROXY 2>/dev/null
    fi
}
_auto_proxy
PROMPT_COMMAND="_auto_proxy;${PROMPT_COMMAND}"
# === Proxy Auto-Detect End ===
```

**原理**：`PROMPT_COMMAND` 在每次命令提示符前执行，自动检测代理端口是否可达，实时切换。

### 第四步：ContextGo 内置代理（Gemini API）

在 WebUI 中设置：**Settings → Gemini Settings → Proxy** → `http://127.0.0.1:7897`

> 此代理由 Node.js 层处理，独立于 Chromium。隧道断开时仅 Gemini API 受影响。

## 常见问题

| 问题                    | 解决方案                              |
| ----------------------- | ------------------------------------- |
| 容器内 dpkg 依赖报错    | `dpkg --force-all -i` 强制安装        |
| ContextGo 只能访问 /tmp | 修改启动脚本中的 `WORKDIR`            |
| 远程无法访问 WebUI      | 检查防火墙/安全组，或使用 ngrok       |
| 代理断开后所有请求失败  | 用 PAC 文件替代 `--proxy-server`      |
| SSH 断开后 curl 失败    | bashrc 添加 `PROMPT_COMMAND` 自动检测 |
| 端口 25809 被占用       | `kill $(lsof -t -i:25809)` 后重启     |
