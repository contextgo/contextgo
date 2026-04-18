import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildBlogIndexNowUrls,
  buildDocsIndexNowUrls,
  buildSiteCoreIndexNowUrls,
} from '../../../scripts/seo/indexnow-lib.mjs';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('indexnow-lib', () => {
  it('includes core site urls and search-intent landing pages', () => {
    const urls = buildSiteCoreIndexNowUrls();

    expect(urls).toContain('https://contextgo.io/en');
    expect(urls).toContain('https://contextgo.io/zh/connect');
    expect(urls).toContain('https://contextgo.io/en/solutions/ai-workbench');
    expect(urls).toContain('https://contextgo.io/zh/solutions/multi-agent-collaboration-workspace');
  });

  it('builds blog urls from localized content roots', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-blog-indexnow-'));
    tempDirs.push(root);

    const blogIndex = {
      order: ['hello-world'],
    };

    await fs.mkdir(path.join(root, 'blog', 'en'), { recursive: true });
    await fs.mkdir(path.join(root, 'blog', 'zh'), { recursive: true });
    await fs.writeFile(path.join(root, 'blog', 'en', 'index.json'), `${JSON.stringify(blogIndex)}\n`, 'utf8');
    await fs.writeFile(path.join(root, 'blog', 'zh', 'index.json'), `${JSON.stringify(blogIndex)}\n`, 'utf8');

    const urls = await buildBlogIndexNowUrls({ contentRoot: root });

    expect(urls).toContain('https://contextgo.io/en/blog');
    expect(urls).toContain('https://contextgo.io/zh/blog/hello-world');
  });

  it('builds docs urls from generated mintlify pages', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-docs-indexnow-'));
    tempDirs.push(root);

    await fs.mkdir(path.join(root, 'start-here'), { recursive: true });
    await fs.mkdir(path.join(root, 'en', 'start-here'), { recursive: true });
    await fs.writeFile(path.join(root, 'index.mdx'), '# Docs\n', 'utf8');
    await fs.writeFile(path.join(root, 'start-here', 'quick-start.mdx'), '# Quick Start\n', 'utf8');
    await fs.writeFile(path.join(root, 'en', 'index.mdx'), '# Docs\n', 'utf8');
    await fs.writeFile(path.join(root, 'en', 'start-here', 'quick-start.mdx'), '# Quick Start\n', 'utf8');

    const urls = await buildDocsIndexNowUrls({ siteRoot: root });

    expect(urls).toContain('https://docs.contextgo.io');
    expect(urls).toContain('https://docs.contextgo.io/start-here/quick-start');
    expect(urls).toContain('https://docs.contextgo.io/en/start-here/quick-start');
  });
});
