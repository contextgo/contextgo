import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPublicContentCollections } from '../../../apps/web/src/content-tools/build.mjs';

const tempDirs: string[] = [];

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeText = async (filePath: string, value: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, 'utf8');
};

const createMinimalContentRoot = async (options?: { omitDocsUpdatedAt?: boolean }): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-public-content-'));
  tempDirs.push(root);

  const docsIndex = {
    badge: 'Docs',
    title: 'Docs',
    description: 'Docs description',
    featuredLabel: 'Structure',
    featuredDescription: 'Docs structure',
    categories: [{ id: 'guides', title: 'Guides', description: 'Guide docs' }],
    order: ['hello-world'],
  };
  const blogIndex = {
    badge: 'Blog',
    title: 'Blog',
    description: 'Blog description',
    featuredLabel: 'Direction',
    featuredDescription: 'Blog direction',
    order: ['hello-world'],
  };
  const docsArticle = `---
eyebrow: Guide
title: Hello World
summary: Hello docs
readingTime: 1 min
${options?.omitDocsUpdatedAt ? '' : 'updatedAt: 2026-04-11'}
category: guides
---

## First step

Hello from docs.
`;
  const blogArticle = `---
eyebrow: Note
title: Hello Blog
summary: Hello blog
readingTime: 1 min
publishedAt: 2026-04-11
---

## First post

Hello from blog.
`;

  for (const locale of ['en', 'zh']) {
    await writeJson(path.join(root, 'docs', locale, 'index.json'), docsIndex);
    await writeText(path.join(root, 'docs', locale, 'hello-world.mdx'), docsArticle);
    await writeJson(path.join(root, 'blog', locale, 'index.json'), blogIndex);
    await writeText(path.join(root, 'blog', locale, 'hello-world.mdx'), blogArticle);
  }

  return root;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('buildPublicContentCollections', () => {
  it('builds docs and blog collections from localized content sources', async () => {
    const docsIndex = JSON.parse(
      await fs.readFile(path.resolve(process.cwd(), 'apps/web/src/content/docs/en/index.json'), 'utf8')
    ) as { order: string[] };
    const blogIndex = JSON.parse(
      await fs.readFile(path.resolve(process.cwd(), 'apps/web/src/content/blog/zh/index.json'), 'utf8')
    ) as { order: string[] };

    const built = await buildPublicContentCollections({
      contentRoot: path.resolve(process.cwd(), 'apps/web/src/content'),
      docsVersion: 'draft',
      exportedAt: '1970-01-01T00:00:00.000Z',
    });

    expect(built.docs.en.collection.docs.entries).toHaveLength(docsIndex.order.length);
    expect(built.blog.zh.collection.blog.entries).toHaveLength(blogIndex.order.length);
    expect(built.docs.en.collection.articles['quick-start'].html).toContain('id="before-you-begin"');
    expect(built.blog.en.collection.articles['context-before-agents'].html).toContain(
      'Why this product does not start'
    );
  });

  it('rejects docs articles that omit updatedAt metadata', async () => {
    const contentRoot = await createMinimalContentRoot({ omitDocsUpdatedAt: true });

    await expect(
      buildPublicContentCollections({
        contentRoot,
        docsVersion: 'draft',
        exportedAt: '1970-01-01T00:00:00.000Z',
      })
    ).rejects.toThrow('Docs articles require "updatedAt"');
  });
});
