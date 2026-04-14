# ContextGo Remote Access Reference

## Product Boundary

ContextGo 的远程访问模型以这条边界为准：

- **Host Runtime** 是真实执行宿主
- **Official Remote** 是默认的用户态远程入口
- **desktop / mobile / browser** 都是连接到 host 的客户端外壳

这意味着：

- 浏览器访问仍然存在
- host-side WebUI runtime 仍然存在
- 但桌面端不再把 `WebUI / 远程连接` 设置页作为一等产品入口

如果用户提到这些旧路径：

- `设置 → WebUI`
- `/settings/webui`

应直接说明：这些都是旧入口；当前默认入口是 **Official Remote**。

## Choose The Right Path

### 1. 普通远程使用

适用：

- 想从手机、平板、浏览器、另一台电脑打开自己的 ContextGo
- 想跨设备继续同一台 host 的工作

推荐路径：

- 登录同一个 ContextGo 云账号
- 打开 **Official Remote** 设备列表
- 从设备列表进入目标 host

这是默认产品路径。

### 2. LAN / Tailscale / 自建网络路径

适用：

- 想在同一局域网内直接访问
- 想通过 Tailscale、ZeroTier、反向代理、自建 VPN 或公网域名访问
- 不想走 Official Remote 中继

推荐路径：

- 把它视为 **host-managed WebUI deployment**
- 参考 [`docs/WEBUI_GUIDE.md`](../../../../../../docs/WEBUI_GUIDE.md)
- 不要再指导用户去找桌面里的 `WebUI` 设置页

### 3. 服务器 / 长驻部署

适用：

- Linux/macOS 服务器长期在线
- systemd / LaunchAgent / 容器 / 远程运维

推荐路径：

- 使用 `--webui` 或等价启动方式运行 host-side WebUI runtime
- 需要外网访问时，再结合 `--remote`、反向代理、VPN 或云侧接入方案
- 详细启动方法看 [`docs/WEBUI_GUIDE.md`](../../../../../../docs/WEBUI_GUIDE.md)

### 4. IM / Bot 集成配置

适用：

- Telegram
- Lark
- DingTalk
- Slack

入口：

- `设置 → IM 渠道`

不要说成 `WebUI 设置 → Channel`。

## Guidance Rules

### Rule 1: 先讲 Official Remote

只要用户的问题不是明确的运维 / 自建网络问题，就先推荐 Official Remote。

### Rule 2: 浏览器访问仍然支持，但性质变了

正确说法：

> WebUI 仍然支持，但它现在属于 host-side runtime / deployment 能力，而不是普通用户在桌面设置里直接打开的默认入口。

### Rule 3: 旧入口一律解释为历史路径

如果用户问：

- “为什么我找不到 WebUI 设置页了？”
- “为什么 `/settings/webui` 打不开了？”

应该回答：

> 这是有意的产品收口。普通远程访问现在走 Official Remote；旧的 WebUI 设置页不再作为一等入口，旧路由会被重定向。需要自建浏览器访问时，请按 host-side WebUI runtime 的方式部署。

### Rule 4: 不要把运维路径包装成默认用户路径

以下能力仍可存在，但要明确是高级路径：

- 局域网浏览器访问
- Tailscale / VPN
- 反向代理
- 自托管公网域名
- 服务器长期运行

## Quick Operator Notes

### LAN

- 适合同 Wi-Fi / 同局域网设备
- 需要 host-side WebUI runtime 正在运行

### Tailscale / VPN

- 适合跨网络但不想暴露公网入口
- 仍然是访问 host-side WebUI runtime

### Reverse Proxy / Public Domain

- 适合高级用户、自建部署、固定域名访问
- 由用户自己控制网络暴露与安全策略

### Official Remote

- 适合绝大多数普通用户
- 统一账号、设备列表、设备打开流程

## Troubleshooting Framing

### “我在设置里找不到 WebUI 了”

- 说明这是产品调整，不是 bug
- 指向 Official Remote 或 `docs/WEBUI_GUIDE.md`

### “旧链接跳到 system settings 了”

- 说明 `/settings/webui` 已是 legacy route
- 这是兼容性重定向，不代表入口还存在

### “我只是想开浏览器访问这台主机”

- 说明这仍然支持
- 但要按 host/runtime 部署能力来操作，不再是桌面产品设置入口

## Canonical References

- `docs/tech/mobile-remote-control.md`
- `docs/tech/architecture.md`
- `docs/WEBUI_GUIDE.md`
