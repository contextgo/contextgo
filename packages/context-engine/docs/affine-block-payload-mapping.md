# Markdown To AFFiNE Block Payload Mapping

## 状态

- 仅作为最小映射草案
- 当前阶段不要求真实写入 AFFiNE block tree

## 目标

定义 ContextGo 当前 markdown-first 内容，未来如何进入 AFFiNE Doc / Edgeless Canvas。

## 基本原则

当前阶段：

- Candidate / Artifact / Summary 内容主要以 markdown 字符串存在
- Promote to Doc / Board 也以 markdown-first 的形式写入 provider

未来阶段：

- markdown 需要映射到 AFFiNE block payload
- 但不应在第一阶段引入完整 block tree 复杂性

## Doc 最小映射

### 输入

```md
# Release Decision

Use the staged rollout checklist.

- Run focused tests
- Keep diffs small
```

### 最小映射策略

- 标题行 `# ...` → page title 或 paragraph title text
- 普通文本行 → `affine:paragraph`
- `- item` / `* item` → `affine:list`

### 输出形状（草案）

```ts
{
  type: 'affine:page',
  title: 'Release Decision',
  blocks: [
    { flavour: 'affine:paragraph', text: 'Use the staged rollout checklist.' },
    { flavour: 'affine:list', text: 'Run focused tests', props: { type: 'bulleted' } },
    { flavour: 'affine:list', text: 'Keep diffs small', props: { type: 'bulleted' } },
  ]
}
```

## Board 最小映射

### 输入

一段 candidate markdown。

### 最小映射策略

- 先映射成一个 `edgeless note card`
- 标题 = candidate summary
- body = markdown 全文
- preview = 前 2~3 行压缩摘要

### 输出形状（草案）

```ts
{
  type: 'affine:edgeless-note',
  title: 'Release Decision',
  markdown: '# Release Decision\n\nUse the staged rollout checklist...',
  preview: 'Release Decision · Use the staged rollout checklist · Run focused tests'
}
```

## 为什么先这样做

- markdown-first 让 ContextGo 能先跑通内容沉淀路径
- block payload helper 让未来切真实 AFFiNE 写入时不需要重做输入层
- 这样既避免现在过耦合，也不会把内容格式锁死

## 当前代码位置

最小 helper 已放在：

- `src/renderer/pages/space/affine/markdownToAffinePayload.ts`

它现在只是：

- 定义最小 payload 形状
- 提供 markdown → doc payload / board payload 的转换 helper

未来接真实 AFFiNE provider 时，可以在 bridge 层把这个 helper 替换成真实 block tree 写入逻辑。
