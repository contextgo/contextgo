import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docsStyleSource = readFileSync('apps/docs/site/style.css', 'utf8');

describe('docs navbar brand icon styling', () => {
  it('styles the Discord and GitHub navbar links as icon buttons', () => {
    expect(docsStyleSource).toContain("#navbar a[href='https://discord.gg/6HWsa2jB5w']");
    expect(docsStyleSource).toContain("#navbar a[href='https://github.com/contextgo/contextgo-releases']");
    expect(docsStyleSource).toContain('/logo/social/discord.svg');
    expect(docsStyleSource).toContain('/logo/social/github.svg');
    expect(docsStyleSource).toContain('mask-image');
  });
});
