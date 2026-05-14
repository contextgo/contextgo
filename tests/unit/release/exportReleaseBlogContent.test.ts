import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exportReleaseBlogContent } from '../../../scripts/release/export-release-blog-content.mjs';

const tempDirs: string[] = [];

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeText = async (filePath: string, value: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, 'utf8');
};

const createMinimalBlogContentRoot = async (): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-release-blog-'));
  tempDirs.push(root);

  const blogIndex = {
    badge: 'Blog',
    title: 'Blog',
    description: 'Blog description',
    featuredLabel: 'Direction',
    featuredDescription: 'Blog direction',
    order: ['hello-world'],
  };
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
    await writeJson(path.join(root, 'blog', locale, 'index.json'), blogIndex);
    await writeText(path.join(root, 'blog', locale, 'hello-world.mdx'), blogArticle);
  }

  return root;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('exportReleaseBlogContent', () => {
  it('exports only release blog payloads without touching docs artifacts', async () => {
    const contentRoot = await createMinimalBlogContentRoot();
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-release-target-'));
    tempDirs.push(target);

    await exportReleaseBlogContent({
      contentRoot,
      target,
      exportedAt: '1970-01-01T00:00:00.000Z',
      sourceRef: 'refs/heads/main',
    });

    const articlePayload = JSON.parse(
      await fs.readFile(path.join(target, 'site/blog/en/hello-world/article.json'), 'utf8')
    ) as {
      article: { title: string };
      sourceRef: string;
    };

    expect(await fs.readFile(path.join(target, 'site/blog/zh/hello-world/source.mdx'), 'utf8')).toContain(
      'Hello from blog.'
    );
    expect(articlePayload.article.title).toBe('Hello Blog');
    expect(articlePayload.sourceRef).toBe('refs/heads/main');
    await expect(fs.access(path.join(target, 'site/docs'))).rejects.toThrow();
    await expect(fs.access(path.join(target, 'site/README.md'))).rejects.toThrow();
  });
});
