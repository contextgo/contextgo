import { describe, expect, it } from 'vitest';

import { buildNavigation, transformMarkdown } from '../../../apps/docs/scripts/sync-lib.mjs';

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

    const output = transformMarkdown(source, { urlPrefix: '/en' });

    expect(output).toContain('title: Start Here');
    expect(output).not.toContain('slug:');
    expect(output).not.toContain('id:');
    expect(output).not.toContain('hide_table_of_contents:');
    expect(output).toContain('[Quick Start](/en/start-here/quick-start)');
  });

  it('converts admonition blocks into plain blockquotes', () => {
    const source = `# Agent Teams

::::warning Preview

\`Agent Teams\` should be described as an upcoming direction.

::::
`;

    const output = transformMarkdown(source, { urlPrefix: '' });

    expect(output).toContain('> Warning: Preview');
    expect(output).toContain('> `Agent Teams` should be described as an upcoming direction.');
    expect(output).not.toContain('::::warning');
  });
});
