# CI/CD 设置指南

## 概述

这个项目配置了 GitHub Actions CI/CD 流水线，支持自动构建、测试和发布到多个平台，并且支持在 GitHub-hosted runner 与 self-hosted runner 之间切换。

## 工作流说明

### 1. `build-and-release.yml` - 主构建和发布流

- **触发时机**: 手动 `workflow_dispatch`
- **功能**:
  - 代码质量检查 (ESLint, Prettier, TypeScript)
  - 多平台构建 (macOS Intel/Apple Silicon, Windows, Linux)
  - 在明确发版时执行正式桌面构建
  - 创建发布产物与后续 release 资产
  - 支持通过仓库变量切换到 self-hosted runner
- **流程**:
  1. 根据仓库变量生成构建矩阵和 runner 配置
  2. 代码质量检查
  3. 多平台并行构建
  4. 执行发布相关资产整理
  5. 等待后续发布操作

### 2. `build-manual.yml` - 手动构建流

- **触发时机**: 手动 `workflow_dispatch`
- **功能**:
  - 按平台单独构建，适合调试单个平台构建问题
  - 支持通过 `runner_mode` 输入切换 `self-hosted` 或 `hosted`
  - 在 self-hosted 模式下读取仓库变量中的 runner labels

### 3. `deploy-site.yml` - Hosted Services 部署流

- **触发时机**:
  - 推送到 `main`
  - 手动 `workflow_dispatch`
- **功能**:
  - 部署 `apps/web/` 到 Cloudflare Pages
  - 部署 `apps/cloud/` 到单台 VM 上的 `/opt/contextgo-cloud`
  - 自动重建 hosted remote shell 需要的 `out/renderer`
  - 云端部署前执行 `bun run cloud:test`
- **手动触发输入**:
  - `deploy_target=site`
  - `deploy_target=cloud`
  - `deploy_target=both`

### 4. `pr-checks.yml` - 默认轻量 PR 检查

- **触发时机**:
  - PR 自动触发：仅轻量检查
  - 手动 `workflow_dispatch`：可按需重跑，并可通过输入跳过 build test
- **默认自动保留**:
  - `Code Quality`
  - Linux 侧轻量 `Unit Tests`
  - `I18n Check`
- **显式标签触发**:
  - `ci:build-test`：启用 `Build Test` 与 `Release Script Test`
  - `ci:coverage`：启用 `Coverage Test`

这意味着：

- 默认 PR 不会自动跑跨平台构建
- 默认 PR 不会自动跑覆盖率
- 需要更重 CI 时，由维护者显式打标签

### 5. 其他重工作流治理

- `pr-e2e-artifacts.yml`：手动触发
- `gpt-review.yml` / `gpt-pr-assessment.yml` / `ai_pr_reviewer.yml`：手动触发
- `bump-homebrew.yml`：手动触发

## 推荐的 GitHub Actions Variables 配置

在仓库的 Settings → Secrets and variables → Actions → Variables 中配置：

```text
BUILD_RUNNER_MODE=self-hosted
RELEASE_BUILD_PLATFORMS=linux
PR_CHECKS_PLATFORM_SCOPE=linux-only
SELF_HOSTED_CONTROL_RUNNER_LABELS_JSON=["self-hosted","Linux","X64","contextgo-org","tencent-sh-1"]
SELF_HOSTED_MACOS_RUNNER_LABELS_JSON=["self-hosted","macOS","arm64","contextgo-macos"]
SELF_HOSTED_WINDOWS_RUNNER_LABELS_JSON=["self-hosted","Windows","x64","contextgo-windows"]
SELF_HOSTED_LINUX_RUNNER_LABELS_JSON=["self-hosted","Linux","X64","contextgo-org","tencent-sh-1"]
```

说明：

- `BUILD_RUNNER_MODE` 可选 `hosted` 或 `self-hosted`
- `RELEASE_BUILD_PLATFORMS` 可填 `all`，或逗号分隔的平台子集，例如 `macos-arm64,linux`
- `PR_CHECKS_PLATFORM_SCOPE` 当前支持 `linux-only` 或 `all`，推荐默认保持 `linux-only`
- `*_LABELS_JSON` 必须是 JSON 数组字符串
- 如果 self-hosted runner 还没有覆盖所有平台，不要把 `RELEASE_BUILD_PLATFORMS` 设成 `all`

当前已确认的组织级 runner：

- `tencent-sh-1-org-runner`
- labels: `self-hosted`, `Linux`, `X64`, `contextgo-org`, `tencent-sh-1`, `cn-shanghai`, `docker-builder`

这意味着：

- 现在可以把 Linux 类 CI/CD job 切到该机器
- 现在不能把 macOS / Windows 构建也切成 self-hosted，否则会一直排队

## 必需的 GitHub Secrets 配置

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中配置以下 Secrets：

### macOS 应用签名 (可选，用于发布到 Mac App Store)

```
APPLE_ID=你的苹果开发者账号邮箱
APPLE_ID_PASSWORD=应用专用密码
TEAM_ID=苹果开发者团队ID
IDENTITY=签名证书名称
```

### GitHub Token

```
GH_TOKEN=你的Personal Access Token (github_pat_开头)
```

**注意**:

- 现在工作流已经支持优先使用内建的 `github.token`
- `GH_TOKEN` 不再是 GitHub 侧操作的硬性前提
- 如果后续有跨仓库发布、特殊权限要求或你希望固定使用 PAT，再配置 `GH_TOKEN`

### Environment Secrets

在 Settings → Environments → release 中也需要配置：

```
GH_TOKEN=相同的Personal Access Token
```

如果当前发布流程只操作本仓库资源，这一项可以暂时留空，先依赖 `github.token`。

### Website 部署

```
CLOUDFLARE_API_TOKEN=Cloudflare API Token
CLOUDFLARE_ACCOUNT_ID=Cloudflare Account ID
```

### GCP 原生 Cloud 自动部署

推荐把 cloud 部署切到 GCP 原生链路：GitHub Actions 通过 `google-github-actions/auth` 获取 Google Cloud 身份，再直接使用 `gcloud compute scp/ssh` 发布到 GCE VM。

必需的 GitHub Actions Variables / Secrets：

```text
GCP_PROJECT_ID=contextgo
GCP_COMPUTE_ZONE=asia-east2-a
GCP_COMPUTE_VM_INSTANCE=ctxgo-hk-1
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/123456789/locations/global/workloadIdentityPools/github/providers/contextgo
GCP_SERVICE_ACCOUNT_EMAIL=github-deploy@contextgo.iam.gserviceaccount.com
```

推荐同时配置以下 GitHub Actions Variables：

```text
CLOUD_DEPLOY_PATH=/opt/contextgo-cloud
CLOUD_ENV_FILE=/etc/contextgo-cloud/contextgo-cloud.env
CLOUD_SERVICE_NAME=contextgo-cloud
CLOUD_DEPLOY_OWNER=contextgo
```

远端 `${CLOUD_ENV_FILE}` 里至少需要补齐以下 OIDC 配置，InferMesh 才能通过 `auth.contextgo.io` 完成单点登录：

```text
CONTEXTGO_OIDC_CLIENT_ID=infermesh-oidc-client
CONTEXTGO_OIDC_CLIENT_SECRET=<generate-a-strong-shared-secret>
CONTEXTGO_OIDC_REDIRECT_URIS=https://newapi.infermesh.org/oauth/oidc,https://newapi-admin.infermesh.org/oauth/oidc
CONTEXTGO_OIDC_SIGNING_KEY_PEM='-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----'
CONTEXTGO_OIDC_SIGNING_KEY_ID=contextgo-auth-1
```

补充说明：

- `CONTEXTGO_OIDC_CLIENT_SECRET` 是 ContextGo Cloud 与 InferMesh OIDC client 之间的共享密钥，不应提交到仓库。
- `CONTEXTGO_OIDC_SIGNING_KEY_PEM` 用于签发 `id_token`，必须是 RSA 私钥 PEM。
- 仓库里提供了 `apps/cloud/systemd/contextgo-cloud.env.example` 模板，首次部署时会自动拷贝为 `${CLOUD_ENV_FILE}`；如果这些 OIDC 项缺失，deploy workflow 会直接失败。

说明：

- workflow 会把 `apps/cloud/` 和新构建的 `out/renderer/` 一起打包上传到 GCE VM
- workflow 不再依赖 `CLOUD_VM_HOST` / `CLOUD_VM_SSH_USER` / `CLOUD_VM_SSH_PRIVATE_KEY` 这类长期 SSH secrets
- GCE 连接通过 `gcloud compute scp` 和 `gcloud compute ssh` 完成，默认使用短期 SSH key
- 远端会保留 `${CLOUD_DEPLOY_PATH}/.venv`
- 远端会自动写入或更新 `CONTEXTGO_RENDERER_BUILD_ROOT=${CLOUD_DEPLOY_PATH}/out/renderer`
- 远端会覆盖 `/etc/systemd/system/${CLOUD_SERVICE_NAME}.service`，然后执行 `systemctl daemon-reload && systemctl restart`

## 如何获取 Apple 签名配置

### 1. Apple ID App-Specific Password

1. 访问 [appleid.apple.com](https://appleid.apple.com)
2. 登录你的 Apple ID
3. 在"Sign-In and Security"部分点击"App-Specific Passwords"
4. 生成新的应用专用密码
5. 复制生成的密码作为 `APPLE_ID_PASSWORD`

### 2. Team ID

1. 访问 [Apple Developer Portal](https://developer.apple.com/account/)
2. 在"Membership Details"中找到 Team ID
3. 复制 Team ID 作为 `TEAM_ID`

### 3. 签名证书 Identity

1. 打开 Xcode 或 Keychain Access
2. 查看已安装的开发者证书
3. 证书名称类似："Developer ID Application: Your Name (TEAM_ID)"
4. 复制完整证书名称作为 `IDENTITY`

## 使用方法

### 推荐发布流程 (使用 release.sh)

1. 确保代码质量符合要求
2. 使用发布脚本升级版本:

   ```bash
   # 修复版本
   ./scripts/release.sh patch

   # 功能版本
   ./scripts/release.sh minor

   # 重大版本
   ./scripts/release.sh major

   # 预发布版本
   ./scripts/release.sh prerelease
   ```

3. 脚本会自动:
   - 运行代码质量检查
   - 升级版本号
   - 创建 git tag
   - 推送到对应发布分支
4. 进入 GitHub Actions，手动运行 `Build and Release`
5. 确认本次需要的发布平台与可选 mobile shell 输入
6. 等待 workflow 完成后继续后续 release 操作
7. 编辑并发布最终发布说明

### 手动构建

1. 打开 GitHub Actions 中的 `🔨 Manual Build`
2. 选择分支和平台
3. 如果已经切到 self-hosted，保持 `runner_mode=self-hosted`
4. 如果只是临时验证公开仓库 / hosted runner 行为，再切成 `hosted`

### 手动发布注意事项

1. 手动修改 `package.json` 中的版本号或使用发布脚本准备版本
2. 提交并推送发布相关变更
3. 不会自动启动正式发布构建
4. 需要维护者手动运行 `Build and Release`

### 版本管理规范

- `patch`: 修复bug (1.0.0 → 1.0.1)
- `minor`: 新功能 (1.0.0 → 1.1.0)
- `major`: 重大更新 (1.0.0 → 2.0.0)
- `prerelease`: 预发布版本 (1.0.0 → 1.0.1-beta.0)

## 构建产物

成功构建后，将生成以下文件：

### macOS

- `.dmg` 文件 (Intel 和 Apple Silicon 版本)
- 应用程序包

### Windows

- `.exe` NSIS 安装程序 (x64/arm64)
- `.zip` 便携版应用 (x64/arm64)

### Linux

- `.deb` 安装包 (x64/arm64/armv7l)
- `.AppImage` 便携式应用 (x64/arm64/armv7l)

## 故障排查

### 常见问题

1. **Release创建失败 (403错误)**
   - 先检查是否真的需要自定义 `GH_TOKEN`
   - 如果 workflow 只是在当前仓库创建 release，优先确认 `github.token` 权限是否足够
   - 如果必须使用 PAT，再检查 `GH_TOKEN` 是否正确配置

2. **macOS 签名失败**
   - 检查 Apple ID 和密码是否正确
   - 确认 Team ID 和证书名称准确
   - 验证苹果开发者账号状态

3. **self-hosted workflow 一直排队**
   - 检查仓库是否已经注册 self-hosted runner
   - 检查 runner labels 是否和 `*_LABELS_JSON` 完全匹配
   - 检查 `RELEASE_BUILD_PLATFORMS` 是否包含了当前没有 runner 的平台

4. **构建超时 (Windows)**
   - Windows 构建通常最慢 (可能40分钟+)
   - 考虑禁用 MSI target 加速构建

5. **重复tag错误**
   - CI/CD 会检查并跳过已存在的 tag
   - 如果手动创建了 tag，CI/CD 不会重复创建

### 调试方法

1. 查看 GitHub Actions 日志
2. 本地运行相同的构建命令测试
3. 检查 package.json 中的构建脚本

## 安全建议

1. 定期更新 GitHub Actions 版本
2. 使用最小权限原则配置 Secrets
3. 定期审查和清理未使用的 Secrets
4. 监控构建日志，避免敏感信息泄露

## 进阶配置

### 自动更新检查

可以集成应用内自动更新功能，配合 GitHub Releases API 实现自动更新提醒。

### 多环境部署

可以扩展工作流支持开发、测试、生产环境的分别部署。

### 性能优化

- 使用构建缓存加速构建
- 并行构建不同平台
- 优化依赖安装速度
