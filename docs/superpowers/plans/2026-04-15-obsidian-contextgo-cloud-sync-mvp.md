# Obsidian + ContextGo Cloud 单人多设备整库同步 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通同一 ContextGo 账号下桌面端与手机端的 Obsidian 整库同步 MVP，让 `connector` 插件执行面、`apps/cloud` 同步编排面、主仓产品接线面形成一条可运行闭环。

**Architecture:** 采用 `Cloud 编排 + 多设备本地副本` 模型。`connector` 仓负责 Obsidian runtime、插件与 push/pull 执行，`apps/cloud` 负责 `vault_binding / replica / change_batch / checkpoint` 编排，主仓负责 `Space -> vault binding -> replica` 的产品模型和 UI 状态面。第一版仅覆盖单人同账号多设备整库同步，不做多人协作、复杂 CRDT 与精细交互式冲突处理。

**Tech Stack:** TypeScript, Bun, Electron renderer/main, Python FastAPI (`apps/cloud`), Obsidian plugin/runtime in sibling `../connector`, Vitest, existing ContextGo Cloud device/account infrastructure

---

### Task 1: 固定跨仓同步合同与最小数据模型

**Files:**

- Create: `docs/superpowers/specs/2026-04-15-obsidian-contextgo-cloud-sync-contract.md`
- Modify: `docs/tech/repo-topology.md`
- Modify: `docs/tech/space-model.md`
- Modify: `apps/cloud/README.md`
- Reference: `/Users/bytedance/contextgo/connector/connect/obsidian.md`

- [ ] **Step 1: 写出失败前提检查清单**

```md
需要先明确并固定以下合同，否则后续三个仓会反复返工：

- Cloud 一等对象：vault_binding / replica / file_manifest / change_batch / sync_checkpoint
- 同步文件分类：content / attachment / obsidian-config / workspace-state
- 手机端是本地可写 replica，不是只读远控端
- Cloud 不是唯一文件权威，而是同步编排权威
- 第三方同步只提示风险，不承诺正式兼容
```

- [ ] **Step 2: 先写合同 spec，明确字段和边界**

```md
# Obsidian ContextGo Cloud Sync Contract

## Objects

- vault_binding
- replica
- change_batch
- sync_checkpoint

## Shared identifiers

- space_id
- vault_binding_id
- replica_id
- device_id
- global_cursor

## File classes

- content
- attachment
- obsidian-config
- workspace-state
```

- [ ] **Step 3: 在主仓文档里补 Cloud sync 的产品边界**

```md
新增规则：

- `apps/cloud` 负责 Obsidian vault sync control plane
- `connector` 仓负责插件和本地执行面
- 主仓负责产品语义、UI 与 Space 接线
```

- [ ] **Step 4: 校对文档一致性**

Run: `rg -n "obsidian|vault_binding|replica|change_batch|sync_checkpoint" docs apps/cloud/README.md`
Expected: 新旧文档都指向同一套对象命名，没有冲突命名。

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-04-15-obsidian-contextgo-cloud-sync-contract.md docs/tech/repo-topology.md docs/tech/space-model.md apps/cloud/README.md
git commit -m "docs(sync): define obsidian cloud sync contract"
```

### Task 2: 在 `apps/cloud` 落地同步编排 API 与持久化对象

**Files:**

- Modify: `apps/cloud/contextgo_cloud/app.py`
- Modify: `apps/cloud/contextgo_cloud/config.py`
- Create: `apps/cloud/contextgo_cloud/obsidian_sync.py`
- Create: `apps/cloud/tests/test_obsidian_sync_api.py`
- Reference: `src/common/types/cloud.ts`

- [ ] **Step 1: 先写失败测试，覆盖最小同步闭环**

```python
def test_register_replica_returns_binding_and_checkpoint(client):
    response = client.post("/api/obsidian-sync/replicas/register", json={
        "space_id": "space_1",
        "device_id": "device_desktop_a",
        "platform": "desktop",
        "vault_fingerprint": "vault_hash_1",
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["replica_id"]
    assert payload["vault_binding_id"]
    assert payload["checkpoint"]["applied_cursor"] == 0
```

- [ ] **Step 2: 再写上传 batch 的失败测试**

```python
def test_push_change_batch_assigns_global_cursor(client):
    register = client.post("/api/obsidian-sync/replicas/register", json={
        "space_id": "space_1",
        "device_id": "device_desktop_a",
        "platform": "desktop",
        "vault_fingerprint": "vault_hash_1",
    }).json()

    response = client.post("/api/obsidian-sync/batches/push", json={
        "vault_binding_id": register["vault_binding_id"],
        "replica_id": register["replica_id"],
        "base_cursor": 0,
        "entries": [
            {"path": "Space Home.md", "file_class": "content", "content_hash": "h1", "body": "# home"}
        ],
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["assigned_cursor"] == 1
```

- [ ] **Step 3: 写最小实现，使注册 API 通过**

```python
# apps/cloud/contextgo_cloud/obsidian_sync.py
class ObsidianSyncStore:
    def __init__(self):
        self.bindings = {}
        self.replicas = {}
        self.batches = []
        self.next_cursor = 1

    def register_replica(self, space_id, device_id, platform, vault_fingerprint):
        vault_binding_id = f"vault_{space_id}"
        replica_id = f"replica_{device_id}"
        self.bindings.setdefault(vault_binding_id, {
            "vault_binding_id": vault_binding_id,
            "space_id": space_id,
            "last_global_cursor": 0,
        })
        self.replicas[replica_id] = {
            "replica_id": replica_id,
            "vault_binding_id": vault_binding_id,
            "device_id": device_id,
            "platform": platform,
            "vault_fingerprint": vault_fingerprint,
            "applied_cursor": 0,
        }
        return {
            "vault_binding_id": vault_binding_id,
            "replica_id": replica_id,
            "checkpoint": {"applied_cursor": 0},
        }
```

- [ ] **Step 4: 写最小实现，使 batch push API 通过**

```python
def push_batch(self, vault_binding_id, replica_id, base_cursor, entries):
    assigned_cursor = self.next_cursor
    self.next_cursor += 1
    batch = {
        "vault_binding_id": vault_binding_id,
        "replica_id": replica_id,
        "base_cursor": base_cursor,
        "assigned_cursor": assigned_cursor,
        "entries": entries,
    }
    self.batches.append(batch)
    self.bindings[vault_binding_id]["last_global_cursor"] = assigned_cursor
    return {"assigned_cursor": assigned_cursor}
```

- [ ] **Step 5: 补 pull API 的失败测试**

```python
def test_pull_batches_returns_pending_changes_for_another_replica(client):
    desktop = client.post("/api/obsidian-sync/replicas/register", json={
        "space_id": "space_1",
        "device_id": "device_desktop_a",
        "platform": "desktop",
        "vault_fingerprint": "vault_hash_1",
    }).json()
    mobile = client.post("/api/obsidian-sync/replicas/register", json={
        "space_id": "space_1",
        "device_id": "device_mobile_a",
        "platform": "mobile",
        "vault_fingerprint": "vault_hash_1",
    }).json()

    client.post("/api/obsidian-sync/batches/push", json={
        "vault_binding_id": desktop["vault_binding_id"],
        "replica_id": desktop["replica_id"],
        "base_cursor": 0,
        "entries": [
            {"path": "Space Home.md", "file_class": "content", "content_hash": "h1", "body": "# home"}
        ],
    })

    response = client.post("/api/obsidian-sync/batches/pull", json={
        "vault_binding_id": mobile["vault_binding_id"],
        "replica_id": mobile["replica_id"],
        "after_cursor": 0,
    })

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["batches"]) == 1
    assert payload["batches"][0]["assigned_cursor"] == 1
```

- [ ] **Step 6: 实现 pull + checkpoint 更新**

```python
def pull_batches(self, vault_binding_id, replica_id, after_cursor):
    pending = [
        batch for batch in self.batches
        if batch["vault_binding_id"] == vault_binding_id
        and batch["assigned_cursor"] > after_cursor
        and batch["replica_id"] != replica_id
    ]
    return {"batches": pending}
```

- [ ] **Step 7: 跑 cloud 定向测试**

Run: `python -m pytest apps/cloud/tests/test_obsidian_sync_api.py -q`
Expected: 新增的 register / push / pull / checkpoint 用例全部 PASS。

- [ ] **Step 8: Commit**

```bash
git add apps/cloud/contextgo_cloud/app.py apps/cloud/contextgo_cloud/obsidian_sync.py apps/cloud/tests/test_obsidian_sync_api.py
git commit -m "feat(cloud): add obsidian sync control plane mvp"
```

### Task 3: 在 `connector` 仓补齐 Obsidian runtime + 插件执行 MVP

**Files:**

- Modify: `/Users/bytedance/contextgo/connector/src/connectors/obsidian.ts`
- Modify: `/Users/bytedance/contextgo/connector/src/connectors/catalog.ts`
- Create: `/Users/bytedance/contextgo/connector/src/connectors/obsidianSync.ts`
- Create: `/Users/bytedance/contextgo/connector/tests/obsidianSync.test.ts`
- Create: `/Users/bytedance/contextgo/connector/plugins/obsidian-contextgo/manifest.json`
- Create: `/Users/bytedance/contextgo/connector/plugins/obsidian-contextgo/main.ts`

- [ ] **Step 1: 先写失败测试，验证 runtime summary 暴露 sync endpoint 与 replica 信息**

```ts
it('returns sync endpoint and replica metadata for obsidian runtime', () => {
  const summary = buildObsidianRuntimeSummaryForTest({
    vaultPath: '/tmp/vault',
    contextgoBaseUrl: 'https://api.contextgo.io',
    replicaId: 'replica_mobile_1',
  });

  expect(summary.sync_endpoint).toBe('https://api.contextgo.io/api/obsidian-sync');
  expect(summary.replica_id).toBe('replica_mobile_1');
});
```

- [ ] **Step 2: 写失败测试，验证本地文件变更会生成 `change_batch`**

```ts
it('builds a change batch from vault file changes', () => {
  const batch = buildObsidianChangeBatch({
    replicaId: 'replica_desktop_1',
    baseCursor: 4,
    changes: [{ path: 'Space Home.md', body: '# hello', fileClass: 'content' }],
  });

  expect(batch.replica_id).toBe('replica_desktop_1');
  expect(batch.base_cursor).toBe(4);
  expect(batch.entries[0]?.path).toBe('Space Home.md');
});
```

- [ ] **Step 3: 实现 batch builder 的最小代码**

```ts
export function buildObsidianChangeBatch(input: {
  replicaId: string;
  baseCursor: number;
  changes: Array<{ path: string; body?: string; fileClass: string }>;
}) {
  return {
    replica_id: input.replicaId,
    base_cursor: input.baseCursor,
    entries: input.changes.map((change) => ({
      path: change.path,
      file_class: change.fileClass,
      body: change.body ?? '',
    })),
  };
}
```

- [ ] **Step 4: 为插件 scaffold 写最小 manifest 和主入口**

```json
{
  "id": "contextgo",
  "name": "ContextGo",
  "version": "0.1.0",
  "minAppVersion": "1.6.0",
  "description": "ContextGo vault sync plugin",
  "author": "ContextGo",
  "isDesktopOnly": false
}
```

```ts
export default class ContextGoPlugin extends Plugin {
  async onload(): Promise<void> {
    console.log('[ContextGoPlugin] loaded');
  }
}
```

- [ ] **Step 5: 给 `cgo obsidian runtime` 加字段输出与 catalog readiness**

```ts
return {
  ...summary,
  replica_id: config.replica_id ?? '(unset)',
  sync_endpoint: buildSyncEndpoint(contextgoBaseUrl),
  plugin_installed: existsSync(pluginDir),
};
```

- [ ] **Step 6: 跑 connector 定向测试**

Run: `bun test /Users/bytedance/contextgo/connector/tests/obsidianSync.test.ts`
Expected: runtime summary / batch builder 用例 PASS。

- [ ] **Step 7: Commit**

```bash
git -C /Users/bytedance/contextgo/connector add src/connectors/obsidian.ts src/connectors/obsidianSync.ts src/connectors/catalog.ts plugins/obsidian-contextgo/manifest.json plugins/obsidian-contextgo/main.ts tests/obsidianSync.test.ts
git -C /Users/bytedance/contextgo/connector commit -m "feat(obsidian): scaffold sync runtime and plugin mvp"
```

### Task 4: 主仓接入 `Space -> Vault Binding -> Replica` 产品模型

**Files:**

- Modify: `src/common/types/cloud.ts`
- Modify: `src/process/services/cloud/CloudService.ts`
- Modify: `src/common/adapter/ipcBridge.ts`
- Create: `src/renderer/pages/settings/Connectors/ObsidianSyncPanel.tsx`
- Modify: `src/renderer/components/layout/Sider.tsx`
- Create: `tests/unit/renderer/settings/ObsidianSyncPanel.dom.test.tsx`

- [ ] **Step 1: 先写失败测试，验证 UI 能展示 vault binding 和 replica 状态**

```ts
it('renders obsidian vault binding with replica health and risk flags', async () => {
  render(<ObsidianSyncPanel binding={{
    vaultBindingId: 'vault_space_1',
    spaceId: 'space_1',
    replicas: [
      { replicaId: 'desktop_a', platform: 'desktop', healthStatus: 'ok' },
      { replicaId: 'mobile_a', platform: 'mobile', healthStatus: 'ok' },
    ],
    riskLevel: 'external-sync-risk',
  }} />);

  expect(screen.getByText('vault_space_1')).toBeInTheDocument();
  expect(screen.getByText('desktop_a')).toBeInTheDocument();
  expect(screen.getByText('mobile_a')).toBeInTheDocument();
  expect(screen.getByText('external-sync-risk')).toBeInTheDocument();
});
```

- [ ] **Step 2: 给 Cloud 类型加最小 Obsidian sync 结构**

```ts
export type CloudObsidianReplica = {
  replicaId: string;
  platform: 'desktop' | 'mobile';
  healthStatus: 'ok' | 'warn' | 'error';
  lastSyncedAt?: string;
};

export type CloudObsidianVaultBinding = {
  vaultBindingId: string;
  spaceId: string;
  riskLevel?: 'normal' | 'external-sync-risk' | 'high-drift';
  replicas: CloudObsidianReplica[];
};
```

- [ ] **Step 3: 在 `CloudService` 增加读取 vault sync status 的 provider**

```ts
async getObsidianSyncStatus(spaceId: string): Promise<CloudObsidianVaultBinding | null> {
  const response = await this.fetchJson(`/api/obsidian-sync/spaces/${encodeURIComponent(spaceId)}`);
  return normalizeObsidianVaultBinding(response);
}
```

- [ ] **Step 4: 实现最小 `ObsidianSyncPanel`**

```tsx
export default function ObsidianSyncPanel({ binding }: { binding: CloudObsidianVaultBinding }) {
  return (
    <div>
      <div>{binding.vaultBindingId}</div>
      <div>{binding.riskLevel ?? 'normal'}</div>
      {binding.replicas.map((replica) => (
        <div key={replica.replicaId}>
          <span>{replica.replicaId}</span>
          <span>{replica.platform}</span>
          <span>{replica.healthStatus}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: 在设置页或侧边产品入口挂出最小状态面**

```tsx
{obsidianBinding ? <ObsidianSyncPanel binding={obsidianBinding} /> : null}
```

- [ ] **Step 6: 跑主仓定向测试**

Run: `bun run test -- tests/unit/renderer/settings/ObsidianSyncPanel.dom.test.tsx`
Expected: vault binding / replica / risk flag 用例 PASS。

- [ ] **Step 7: Commit**

```bash
git add src/common/types/cloud.ts src/process/services/cloud/CloudService.ts src/common/adapter/ipcBridge.ts src/renderer/pages/settings/Connectors/ObsidianSyncPanel.tsx src/renderer/components/layout/Sider.tsx tests/unit/renderer/settings/ObsidianSyncPanel.dom.test.tsx
git commit -m "feat(sync): surface obsidian cloud sync status"
```

### Task 5: 完成跨仓 MVP 验证与文档回写

**Files:**

- Modify: `docs/superpowers/specs/2026-04-15-obsidian-contextgo-cloud-sync-design.md`
- Modify: `apps/cloud/README.md`
- Modify: `/Users/bytedance/contextgo/connector/connect/obsidian.md`

- [ ] **Step 1: 记录 MVP 手工验收路径**

```md
1. 桌面 A 注册 replica
2. 手机 B 注册 replica
3. 桌面 A 修改 `Space Home.md`
4. 桌面 A push batch 到 Cloud
5. 手机 B pull 并应用
6. 主仓 UI 显示两个 replica 状态正常
```

- [ ] **Step 2: 跑三个面向的最小验证命令**

Run: `python -m pytest apps/cloud/tests/test_obsidian_sync_api.py -q`
Expected: Cloud sync API tests pass

Run: `bun test /Users/bytedance/contextgo/connector/tests/obsidianSync.test.ts`
Expected: connector sync runtime tests pass

Run: `bun run test -- tests/unit/renderer/settings/ObsidianSyncPanel.dom.test.tsx`
Expected: main repo UI status panel tests pass

- [ ] **Step 3: 回写文档中的 MVP 状态与已知限制**

```md
- 当前仅支持单人同账号多设备
- `.obsidian/workspace.json` 纳入同步，但采用 latest-wins
- 检测第三方同步风险，但不承诺正式兼容
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-15-obsidian-contextgo-cloud-sync-design.md apps/cloud/README.md
git commit -m "docs(sync): record obsidian cloud sync mvp verification"
```
