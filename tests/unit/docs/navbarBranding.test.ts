import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docsStyleSource = readFileSync('apps/docs/site/style.css', 'utf8');

describe('docs navbar brand icon styling', () => {
  it('styles the Discord and GitHub navbar links as icon buttons', () => {
    expect(docsStyleSource).toContain("#navbar a[href='https://discord.gg/6HWsa2jB5w']");
    expect(docsStyleSource).toContain("#navbar a[href='https://github.com/contextgo/contextgo']");
    expect(docsStyleSource).toContain('/logo/social/discord.svg');
    expect(docsStyleSource).toContain('/logo/social/github.svg');
    expect(docsStyleSource).toContain('mask-image');
    expect(docsStyleSource).toContain('--docs-brand-discord');
    expect(docsStyleSource).toContain('--docs-brand-github');
    expect(docsStyleSource).toContain('opacity: 0.72;');
    expect(docsStyleSource).toContain('align-self: center;');
    expect(docsStyleSource).toContain('height: 2rem;');
    expect(docsStyleSource).toContain('width: 2rem;');
    expect(docsStyleSource).toContain('vertical-align: middle;');
    expect(docsStyleSource).toContain('margin-right: -0.25rem;');
  });

  it('does not keep the docs social links inside the old outlined button shell', () => {
    expect(docsStyleSource).not.toContain(`background: var(--docs-surface-strong);
  border: 1px solid var(--docs-border);
  border-radius: 999px;
  box-shadow: var(--docs-shadow-soft);`);
  });
});
