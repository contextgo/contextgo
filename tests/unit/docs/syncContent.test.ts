import { describe, expect, it } from 'vitest';

import {
  buildDocsConfig,
  buildDocsRobotsTxt,
  buildDocsSitemapXml,
  buildNavigation,
  buildShellHome,
  transformMarkdown,
} from '../../../apps/docs/scripts/sync-lib.mjs';

describe('buildNavigation', () => {
  it('prefixes page ids for localized Mintlify navigation groups', () => {
    const groups = buildNavigation(
      [
        'index',
        {
          type: 'category',
          label: 'Start Here',
          link: { type: 'doc', id: 'start-here/index' },
          items: ['start-here/quick-start', 'start-here/product-map'],
        },
      ],
      { targetDir: 'en' }
    );

    expect(groups).toEqual([
      {
        group: 'Start Here',
        pages: ['en/start-here/index', 'en/start-here/quick-start', 'en/start-here/product-map'],
      },
    ]);
  });

  it('preserves nested category structure for mintlify sidebar groups', () => {
    const groups = buildNavigation(
      [
        {
          type: 'category',
          label: 'Start Here',
          link: { type: 'doc', id: 'start-here/index' },
          items: [
            {
              type: 'category',
              label: 'Foundations',
              items: ['start-here/what-is-contextgo', 'start-here/product-map'],
            },
            {
              type: 'category',
              label: 'Get Started',
              items: ['start-here/quick-start', 'start-here/choose-your-setup'],
            },
          ],
        },
      ],
      { language: 'en', targetDir: 'en' }
    );

    expect(groups).toEqual([
      {
        group: 'Start Here',
        pages: [
          'en/start-here/index',
          {
            group: 'Foundations',
            pages: ['en/start-here/what-is-contextgo', 'en/start-here/product-map'],
          },
          {
            group: 'Get Started',
            pages: ['en/start-here/quick-start', 'en/start-here/choose-your-setup'],
          },
        ],
      },
    ]);
  });

  it('localizes sidebar group labels for chinese docs', () => {
    const groups = buildNavigation(
      [
        {
          type: 'category',
          label: 'Start Here',
          link: { type: 'doc', id: 'start-here/index' },
          items: ['start-here/quick-start'],
        },
      ],
      { language: 'zh', targetDir: '' }
    );

    expect(groups).toEqual([
      {
        group: '开始',
        pages: ['start-here/index', 'start-here/quick-start'],
      },
    ]);
  });

  it('localizes nested sidebar group labels for chinese docs', () => {
    const groups = buildNavigation(
      [
        {
          type: 'category',
          label: 'Remote & Devices',
          link: { type: 'doc', id: 'remote/index' },
          items: [
            {
              type: 'category',
              label: 'Host Model',
              items: ['remote/remote-access-overview', 'remote/desktop-host'],
            },
            {
              type: 'category',
              label: 'Client Surfaces',
              items: ['remote/web-client', 'remote/mobile-shells'],
            },
          ],
        },
      ],
      { language: 'zh', targetDir: '' }
    );

    expect(groups).toEqual([
      {
        group: '远程与设备',
        pages: [
          'remote/index',
          {
            group: '主机模型',
            pages: ['remote/remote-access-overview', 'remote/desktop-host'],
          },
          {
            group: '客户端界面',
            pages: ['remote/web-client', 'remote/mobile-shells'],
          },
        ],
      },
    ]);
  });
});

describe('transformMarkdown', () => {
  it('removes legacy-only fields and rewrites english absolute links', () => {
    const source = `---
title: Start Here
slug: /start-here
id: index
hide_table_of_contents: true
---

# Start Here

1. Read [Quick Start](/start-here/quick-start)
`;

    const output = transformMarkdown(source, { language: 'en', urlPrefix: '/en' }, 'start-here/index');

    expect(output).toContain('title: Start Here');
    expect(output).not.toContain('slug:');
    expect(output).not.toContain('id:');
    expect(output).not.toContain('hide_table_of_contents:');
    expect(output).not.toContain('# Start Here');
    expect(output).toContain('[Quick Start](/en/start-here/quick-start)');
  });

  it('converts admonition blocks into plain blockquotes', () => {
    const source = `# Agent Teams

::::warning Preview

\`Agent Teams\` should be described as an upcoming direction.

::::
`;

    const output = transformMarkdown(source, { language: 'en', urlPrefix: '' }, 'collaboration/agent-teams');

    expect(output).toContain('> Warning: Preview');
    expect(output).toContain('> `Agent Teams` should be described as an upcoming direction.');
    expect(output).not.toContain('::::warning');
  });

  it('overrides chinese titles and removes leaked english descriptions', () => {
    const source = `---
title: Start Here
description: Start with ContextGo as a product, not as a list of disconnected features.
---

# Start Here

中文正文。
`;

    const output = transformMarkdown(source, { language: 'zh', urlPrefix: '' }, 'start-here/index');

    expect(output).toContain('title: 开始');
    expect(output).not.toContain('description: Start with ContextGo');
    expect(output).not.toContain('# Start Here');
  });
});

describe('docs shell config', () => {
  it('uses the product-brand docs shell instead of default mintlify chrome', () => {
    const config = buildDocsConfig([]);

    expect(config.appearance.default).toBe('light');
    expect(config.navbar.primary.label).toBe('Open ContextGo');
    expect(config.logo.light).toBe('/logo/light.png');
    expect(config.logo.dark).toBe('/logo/dark.png');
    expect(config.seo.metatags.robots).toBe('index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    expect(config.seo.metatags['og:image']).toBe('https://docs.contextgo.io/demo.png');
  });

  it('renders a docs-first home shell with the docs-specific product imagery', () => {
    const home = buildShellHome({ language: 'zh', urlPrefix: '' });

    expect(home).toContain('/brand/docs/workbench-home.png');
    expect(home).toContain('/brand/docs/start-here-overview.png');
    expect(home).toContain('产品文档系统');
    expect(home).toContain('docs-home-grid');
    expect(home).toContain('href="/start-here"');
  });
});

describe('docs SEO assets', () => {
  it('builds a crawlable robots.txt for the docs domain', () => {
    const robots = buildDocsRobotsTxt();

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://docs.contextgo.io/sitemap.xml');
    expect(robots).toContain('Host: https://docs.contextgo.io');
  });

  it('builds a sitemap with both default and english localized URLs', () => {
    const sitemap = buildDocsSitemapXml(['index', 'start-here/index', 'start-here/quick-start', 'use-cases/index']);

    expect(sitemap).toContain('<loc>https://docs.contextgo.io/</loc>');
    expect(sitemap).toContain('<loc>https://docs.contextgo.io/start-here/</loc>');
    expect(sitemap).toContain('<loc>https://docs.contextgo.io/start-here/quick-start/</loc>');
    expect(sitemap).toContain('<loc>https://docs.contextgo.io/en/</loc>');
    expect(sitemap).toContain('<loc>https://docs.contextgo.io/en/start-here/</loc>');
    expect(sitemap).toContain('<loc>https://docs.contextgo.io/en/start-here/quick-start/</loc>');
    expect(sitemap).toContain(
      'rel="alternate" hreflang="en" href="https://docs.contextgo.io/en/start-here/quick-start/"'
    );
    expect(sitemap).toContain('rel="alternate" hreflang="zh" href="https://docs.contextgo.io/start-here/quick-start/"');
  });
});
