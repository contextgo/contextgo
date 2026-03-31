import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillMarketService } from '@process/bridge/services/skillmarket/SkillMarketService';

const CONFIG_URL = 'https://market.example/config.js';
const SITE_URL = 'https://market.example';
const CURATED_MANIFEST_URL = `${SITE_URL}/data/curated_skills.json`;
const FULL_MANIFEST_URL = `${SITE_URL}/data/skills.json`;
const CURATED_STATS_URL = `${SITE_URL}/data/curated_stats.json`;
const INDUSTRY_URL = `${SITE_URL}/data/industry_index.json`;
const BUNDLE_URL = `${SITE_URL}/data/bundles.json`;
const PACKAGE_URL = `${SITE_URL}/packages/skillhub/market-skill/1.0.0.zip`;
const FALLBACK_PACKAGE_URL = `${SITE_URL}/packages/openclawmp/market-skill/1.0.0.zip`;

const createConfigResponse = () =>
  new Response(
    `window.SKILL_MARKET_CONFIG = ${JSON.stringify({
      brandName: 'ContextGo',
      siteUrl: SITE_URL,
      manifestUrl: './data/curated_skills.json',
      statsUrl: './data/curated_stats.json',
      fullManifestUrl: './data/skills.json',
      fullStatsUrl: './data/stats.json',
      industryUrl: './data/industry_index.json',
      bundleUrl: './data/bundles.json',
      packageBaseUrls: {
        skillhub: './packages/skillhub/',
        openclawmp: './packages/openclawmp/',
      },
      featuredCount: 8,
      pageSize: 24,
      defaultView: 'curated',
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
      sourceTotal: 15,
      reducedCount: 12,
      reductionRatio: 0.8,
      clusterCount: 5,
      sources: {
        skillhub: 2,
        openclawmp: 1,
      },
      topIndustries: [{ id: 'engineering', label: 'Engineering', count: 2 }],
      topCapabilities: [{ label: 'Engineering', count: 2 }],
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
          themes: ['code', 'cli'],
          industries: ['engineering'],
          primaryCapability: 'Engineering',
          selectionReason: 'Top pick',
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
          themes: ['analytics'],
          industries: ['research-analysis'],
          primaryCapability: 'Analysis',
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

const createMismatchedIdManifestResponse = () =>
  new Response(
    JSON.stringify({
      items: [
        {
          id: 'trackup-food-analyze',
          name: 'trackup-food-analyze',
          displayName: 'Trackup Food Analyze',
          version: '1.0.5',
          author: 'militing',
          description: 'Analyzes food-related tracking workflows.',
          categories: ['automation'],
          tags: ['food'],
          themes: ['analysis'],
          industries: ['operations'],
          primaryCapability: 'Analysis',
          archives: [
            {
              source: 'skillhub',
              relativePath: 'trackup-food-analyze/1.0.5.zip',
              label: 'SkillHub Archive',
            },
          ],
          metrics: {
            skillhub_installs: 4,
          },
        },
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

const createIndustryResponse = () =>
  new Response(
    JSON.stringify({
      industries: [
        {
          id: 'engineering',
          label: 'Engineering',
          summary: 'Build and ship software faster.',
          problems: ['Slow handoffs'],
          useCases: ['Code reviews'],
          outcomes: ['Higher throughput'],
          workflow: ['Inspect repo', 'Implement change'],
          count: 2,
          topThemes: ['code'],
          bundleIds: ['engineering-copilot'],
          recommendedSkillIds: ['market-skill::1.0.0::tester'],
        },
        {
          id: 'research-analysis',
          label: 'Research Analysis',
          summary: 'Track markets and summarize signals.',
          problems: ['Scattered sources'],
          useCases: ['Industry briefings'],
          outcomes: ['Faster weekly reports'],
          workflow: ['Collect', 'Summarize'],
          count: 1,
          topThemes: ['analytics'],
          bundleIds: ['research-briefing'],
          recommendedSkillIds: ['analytics-skill::2.0.0::tester'],
        },
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

const createBundleResponse = () =>
  new Response(
    JSON.stringify({
      bundles: [
        {
          id: 'engineering-copilot',
          title: 'Engineering Copilot',
          summary: 'Review, test, and ship changes.',
          industries: ['engineering'],
          forTeams: 'Engineering teams',
          deliverables: ['Code changes'],
          valuePoints: ['Faster reviews'],
          steps: [
            {
              label: 'Analyze',
              themes: ['code'],
              skillIds: ['market-skill::1.0.0::tester'],
            },
          ],
          skillIds: ['market-skill::1.0.0::tester', 'analytics-skill::2.0.0::tester'],
        },
        {
          id: 'engineering-foundation',
          title: 'Engineering Foundation',
          summary: 'Baseline automation for engineering teams.',
          industries: ['engineering'],
          forTeams: 'Platform teams',
          deliverables: ['Checklists'],
          valuePoints: ['Consistent quality'],
          steps: [
            {
              label: 'Verify',
              themes: ['cli'],
              skillIds: ['market-skill::1.0.0::tester'],
            },
          ],
          skillIds: ['market-skill::1.0.0::tester'],
        },
        {
          id: 'research-briefing',
          title: 'Research Briefing',
          summary: 'Collect signals and generate briefings.',
          industries: ['research-analysis'],
          forTeams: 'Research teams',
          deliverables: ['Briefings'],
          valuePoints: ['Clearer updates'],
          steps: [
            {
              label: 'Summarize',
              themes: ['analytics'],
              skillIds: ['analytics-skill::2.0.0::tester'],
            },
          ],
          skillIds: ['analytics-skill::2.0.0::tester'],
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
      if (url === CURATED_STATS_URL) return createStatsResponse();
      if (url === CURATED_MANIFEST_URL) return createManifestResponse();
      if (url === INDUSTRY_URL) return createIndustryResponse();
      if (url === BUNDLE_URL) return createBundleResponse();
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
    expect(result.stats.clusterCount).toBe(5);
    expect(result.industryIndex[0]?.recommendedSkills[0]?.id).toBe('market-skill::1.0.0::tester');
    expect(result.bundles[0]?.skills).toHaveLength(2);
    expect(result.categories).toEqual(['automation', 'developer-tools']);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'market-skill::1.0.0::tester',
      name: 'market-skill',
      displayName: 'Market Skill',
      installs: 42,
      stars: 2,
      primaryCapability: 'Engineering',
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

  it('filters bundles by industry and keeps industry-recommended bundles first', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === CONFIG_URL) return createConfigResponse();
      if (url === CURATED_STATS_URL) return createStatsResponse();
      if (url === CURATED_MANIFEST_URL) return createManifestResponse();
      if (url === INDUSTRY_URL) return createIndustryResponse();
      if (url === BUNDLE_URL) return createBundleResponse();
      throw new Error(`Unexpected URL: ${url}`);
    });

    const service = new SkillMarketService({
      fetchImpl,
      configUrl: CONFIG_URL,
      skillsDir: path.join(os.tmpdir(), 'unused-skill-market-industry'),
    });

    const result = await service.searchSkills({ industryId: 'engineering', limit: 10 });

    expect(result.items.map((item) => item.id)).toEqual(['market-skill::1.0.0::tester']);
    expect(result.bundles.map((bundle) => bundle.id)).toEqual(['engineering-copilot', 'engineering-foundation']);
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
      if (url === FULL_MANIFEST_URL) return createManifestResponse();
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
      if (url === FULL_MANIFEST_URL) return createManifestResponse();
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

  it('installs a skill when the full manifest id differs from the structured market skill id', async () => {
    skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-market-install-mismatched-id-'));
    const archiveBuffer = await createArchiveBuffer({
      'trackup-food-analyze/SKILL.md':
        '---\nname: trackup-food-analyze\ndescription: test skill\n---\n# Trackup Food Analyze',
    });
    const trackupPackageUrl = `${SITE_URL}/packages/skillhub/trackup-food-analyze/1.0.5.zip`;

    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === CONFIG_URL) return createConfigResponse();
      if (url === FULL_MANIFEST_URL) return createMismatchedIdManifestResponse();
      if (url === trackupPackageUrl) {
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

    const result = await service.installSkill({
      skillId: 'trackup-food-analyze::1.0.5::militing',
      archive: {
        source: 'skillhub',
        relativePath: 'trackup-food-analyze/1.0.5.zip',
      },
    });

    expect(result.skillName).toBe('trackup-food-analyze');
    expect(result.archiveUrl).toBe(trackupPackageUrl);
    await expect(fs.readFile(path.join(skillsDir, 'trackup-food-analyze', 'SKILL.md'), 'utf-8')).resolves.toContain(
      'trackup-food-analyze'
    );
  });
});
