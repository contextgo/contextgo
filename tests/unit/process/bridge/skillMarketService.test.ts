import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillMarketService } from '@process/bridge/services/skillmarket/SkillMarketService';

const CONFIG_URL = 'https://market.example/config.js';
const SITE_URL = 'https://market.example';
const MANIFEST_URL = `${SITE_URL}/data/skills.json`;
const STATS_URL = `${SITE_URL}/data/stats.json`;
const PACKAGE_URL = `${SITE_URL}/packages/skillhub/market-skill/1.0.0.zip`;
const FALLBACK_PACKAGE_URL = `${SITE_URL}/packages/openclawmp/market-skill/1.0.0.zip`;

const createConfigResponse = () =>
  new Response(
    `window.SKILL_MARKET_CONFIG = ${JSON.stringify({
      brandName: 'ContextGo',
      siteUrl: SITE_URL,
      manifestUrl: './data/skills.json',
      statsUrl: './data/stats.json',
      packageBaseUrls: {
        skillhub: './packages/skillhub/',
        openclawmp: './packages/openclawmp/',
      },
      featuredCount: 8,
      pageSize: 24,
    })};`,
    {
      status: 200,
      headers: { 'Content-Type': 'application/javascript' },
    }
  );

const createStatsResponse = () =>
  new Response(
    JSON.stringify({
      total: 3,
      categories: ['developer-tools', 'automation'],
      sources: {
        skillhub: 2,
        openclawmp: 1,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

const createManifestResponse = () =>
  new Response(
    JSON.stringify({
      items: [
        {
          id: 'market-skill::1.0.0::tester',
          name: 'market-skill',
          displayName: 'Market Skill',
          version: '1.0.0',
          author: 'tester',
          description: 'Scans workspaces and reports findings.',
          categories: ['developer-tools'],
          tags: ['scanner', 'workspace'],
          archives: [
            {
              source: 'skillhub',
              relativePath: 'market-skill/1.0.0.zip',
              label: 'SkillHub Archive',
            },
            {
              source: 'openclawmp',
              relativePath: 'market-skill/1.0.0.zip',
              label: 'OpenClawMP Archive',
            },
          ],
          metrics: {
            skillhub_installs: 42,
            skillhub_stars: 2,
          },
          popularity: 9000,
        },
        {
          id: 'analytics-skill::2.0.0::tester',
          name: 'analytics-skill',
          displayName: 'Analytics Skill',
          version: '2.0.0',
          author: 'tester',
          description: 'Builds analytics summaries.',
          categories: ['automation'],
          tags: ['analytics'],
          archives: [
            {
              source: 'skillhub',
              relativePath: 'analytics-skill/2.0.0.zip',
              label: 'SkillHub Archive',
            },
          ],
          metrics: {
            skillhub_installs: 12,
          },
          popularity: 1200,
        },
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

const createArchiveBuffer = async (files: Record<string, string>): Promise<Buffer> => {
  const zip = new JSZip();
  for (const [filePath, content] of Object.entries(files)) {
    zip.file(filePath, content);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
};

describe('SkillMarketService.searchSkills', () => {
  it('returns ranked results and catalog metadata', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === CONFIG_URL) return createConfigResponse();
      if (url === STATS_URL) return createStatsResponse();
      if (url === MANIFEST_URL) return createManifestResponse();
      throw new Error(`Unexpected URL: ${url}`);
    });

    const service = new SkillMarketService({
      fetchImpl,
      configUrl: CONFIG_URL,
      skillsDir: path.join(os.tmpdir(), 'unused-skill-market-search'),
    });

    const result = await service.searchSkills({ query: 'scanner', limit: 10 });

    expect(result.total).toBe(1);
    expect(result.totalAvailable).toBe(3);
    expect(result.categories).toEqual(['developer-tools', 'automation']);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'market-skill::1.0.0::tester',
      name: 'market-skill',
      displayName: 'Market Skill',
      installs: 42,
      stars: 2,
    });
  });

  it('throws when the catalog config request fails', async () => {
    const service = new SkillMarketService({
      fetchImpl: vi.fn(async () => new Response('boom', { status: 500 })),
      configUrl: CONFIG_URL,
      skillsDir: path.join(os.tmpdir(), 'unused-skill-market-error'),
    });

    await expect(service.searchSkills({ query: 'anything' })).rejects.toThrow('Failed to fetch Skill Market config');
  });
});

describe('SkillMarketService.installSkill', () => {
  let skillsDir = '';

  afterEach(async () => {
    if (skillsDir) {
      await fs.rm(skillsDir, { recursive: true, force: true });
      skillsDir = '';
    }
  });

  it('falls back to the next archive and installs the downloaded skill', async () => {
    skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-market-install-'));
    const archiveBuffer = await createArchiveBuffer({
      'market-skill/SKILL.md': '---\nname: market-skill\ndescription: test skill\n---\n# Market Skill',
      'market-skill/tool.py': 'print("hello")\n',
    });

    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === CONFIG_URL) return createConfigResponse();
      if (url === STATS_URL) return createStatsResponse();
      if (url === MANIFEST_URL) return createManifestResponse();
      if (url === PACKAGE_URL) return new Response('missing', { status: 404 });
      if (url === FALLBACK_PACKAGE_URL) {
        return new Response(archiveBuffer, {
          status: 200,
          headers: { 'Content-Type': 'application/zip' },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const service = new SkillMarketService({
      fetchImpl,
      configUrl: CONFIG_URL,
      skillsDir,
    });

    const result = await service.installSkill({ skillId: 'market-skill::1.0.0::tester' });

    expect(result.skillName).toBe('market-skill');
    expect(result.archiveUrl).toBe(FALLBACK_PACKAGE_URL);
    await expect(fs.readFile(path.join(skillsDir, 'market-skill', 'SKILL.md'), 'utf-8')).resolves.toContain(
      'name: market-skill'
    );
    await expect(fs.readFile(path.join(skillsDir, 'market-skill', 'tool.py'), 'utf-8')).resolves.toContain('hello');
  });

  it('fails when the downloaded archive does not contain a skill entry point', async () => {
    skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-market-install-error-'));
    const archiveBuffer = await createArchiveBuffer({
      'README.md': '# Missing skill entry point',
    });

    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === CONFIG_URL) return createConfigResponse();
      if (url === MANIFEST_URL) return createManifestResponse();
      if (url === PACKAGE_URL || url === FALLBACK_PACKAGE_URL) {
        return new Response(archiveBuffer, {
          status: 200,
          headers: { 'Content-Type': 'application/zip' },
        });
      }

      return createStatsResponse();
    });

    const service = new SkillMarketService({
      fetchImpl,
      configUrl: CONFIG_URL,
      skillsDir,
    });

    await expect(service.installSkill({ skillId: 'market-skill::1.0.0::tester' })).rejects.toThrow(
      'Downloaded archive does not contain a SKILL.md entry point'
    );
  });
});
