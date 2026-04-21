import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const navbarSource = readFileSync('apps/web/src/components/Navbar.tsx', 'utf8');
const homeClientSource = readFileSync('apps/web/src/app/[lang]/HomeClient.tsx', 'utf8');
const englishDictionarySource = readFileSync('apps/web/src/dictionaries/en.ts', 'utf8');
const chineseDictionarySource = readFileSync('apps/web/src/dictionaries/zh.ts', 'utf8');

describe('web header social branding', () => {
  it('renders Discord and GitHub as branded header icons', () => {
    expect(navbarSource).toContain("const DEFAULT_DISCORD_URL = 'https://discord.gg/6HWsa2jB5w';");
    expect(navbarSource).toContain('/social/discord.svg');
    expect(navbarSource).toContain('/social/github.svg');
  });

  it('removes the duplicate Discord community CTA from the homepage hero', () => {
    expect(homeClientSource).not.toContain('https://discord.gg/6HWsa2jB5w');
    expect(homeClientSource).not.toContain('dict.hero.community_btn');
  });

  it('drops the now-unused community button dictionary keys', () => {
    expect(englishDictionarySource).not.toContain('community_btn');
    expect(chineseDictionarySource).not.toContain('community_btn');
  });
});
