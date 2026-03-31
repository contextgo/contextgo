import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { getSkillsDir } from '@process/utils/initStorage';

const DEFAULT_CONFIG_URL = 'https://www.skillmarket.com.cn/config.js';
const DEFAULT_PAGE_SIZE = 24;
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
const STATS_CACHE_TTL_MS = 5 * 60 * 1000;
const MANIFEST_CACHE_TTL_MS = 10 * 60 * 1000;

export type SkillMarketArchive = {
  source: string;
  relativePath: string;
  label?: string;
};

type SkillMarketConfigPayload = {
  brandName?: string;
  siteUrl?: string;
  manifestUrl?: string;
  statsUrl?: string;
  packageBaseUrls?: Record<string, string>;
  featuredCount?: number;
  pageSize?: number;
};

type SkillMarketConfig = {
  brandName: string;
  siteUrl: string;
  manifestUrl: string;
  statsUrl: string;
  packageBaseUrls: Record<string, string>;
  featuredCount: number;
  pageSize: number;
};

type SkillMarketStats = {
  total: number;
  categories: string[];
  sources: Record<string, number>;
};

type SkillMarketManifestItem = {
  id: string;
  name: string;
  displayName?: string;
  version?: string;
  author?: string;
  description?: string;
  categories?: string[];
  tags?: string[];
  sources?: string[];
  homepage?: string;
  readmeUrl?: string;
  installCommand?: string;
  archives?: SkillMarketArchive[];
  metrics?: Record<string, number>;
  popularity?: number;
};

type SkillMarketManifest = {
  items: SkillMarketManifestItem[];
};

export type SkillMarketSearchItem = {
  id: string;
  name: string;
  displayName: string;
  version: string;
  author: string;
  description: string;
  categories: string[];
  tags: string[];
  homepage?: string;
  readmeUrl?: string;
  archives: SkillMarketArchive[];
  popularity: number;
  installs: number;
  stars: number;
};

export type SkillMarketSearchParams = {
  query?: string;
  limit?: number;
  offset?: number;
  forceRefresh?: boolean;
};

export type SkillMarketSearchResult = {
  items: SkillMarketSearchItem[];
  total: number;
  totalAvailable: number;
  siteUrl: string;
  pageSize: number;
  featuredCount: number;
  categories: string[];
  sources: Record<string, number>;
};

export type SkillMarketInstallParams = {
  skillId: string;
  archive?: SkillMarketArchive;
};

export type SkillMarketInstallResult = {
  skillName: string;
  installedPath: string;
  archiveUrl: string;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type SkillMarketServiceOptions = {
  fetchImpl?: typeof fetch;
  configUrl?: string;
  skillsDir?: string;
};

const normalizeString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const normalizeMetrics = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(Object.entries(value).map(([key, rawValue]) => [key, normalizeNumber(rawValue)]));
};

const tokenizeQuery = (query: string): string[] => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

const resolveUrl = (value: string | undefined, base: string): string => new URL(value || '.', base).toString();

const getInstallCount = (metrics: Record<string, number>): number =>
  (metrics.skillhub_installs || 0) + (metrics.openclawmp_installs || 0);

const getStarCount = (metrics: Record<string, number>): number =>
  (metrics.skillhub_stars || 0) + (metrics.openclawmp_total_stars || 0) + (metrics.openclawmp_github_stars || 0);

const normalizeSearchItem = (item: SkillMarketManifestItem): SkillMarketSearchItem => {
  const metrics = normalizeMetrics(item.metrics);

  return {
    id: normalizeString(item.id),
    name: normalizeString(item.name),
    displayName: normalizeString(item.displayName) || normalizeString(item.name),
    version: normalizeString(item.version),
    author: normalizeString(item.author),
    description: normalizeString(item.description),
    categories: normalizeStringArray(item.categories),
    tags: normalizeStringArray(item.tags),
    homepage: normalizeString(item.homepage) || undefined,
    readmeUrl: normalizeString(item.readmeUrl) || undefined,
    archives: Array.isArray(item.archives)
      ? item.archives
          .map((archive) => ({
            source: normalizeString(archive.source),
            relativePath: normalizeString(archive.relativePath),
            label: normalizeString(archive.label) || undefined,
          }))
          .filter((archive) => archive.source && archive.relativePath)
      : [],
    popularity: normalizeNumber(item.popularity),
    installs: getInstallCount(metrics),
    stars: getStarCount(metrics),
  };
};

const scoreItem = (item: SkillMarketSearchItem, tokens: string[]): number => {
  if (tokens.length === 0) {
    return item.popularity * 10 + item.installs * 50 + item.stars * 100;
  }

  const haystacks = {
    name: item.name.toLowerCase(),
    displayName: item.displayName.toLowerCase(),
    author: item.author.toLowerCase(),
    description: item.description.toLowerCase(),
    categories: item.categories.map((category) => category.toLowerCase()),
    tags: item.tags.map((tag) => tag.toLowerCase()),
  };

  let score = 0;

  for (const token of tokens) {
    let tokenMatched = false;

    if (haystacks.name === token || haystacks.displayName === token) {
      score += 5000;
      tokenMatched = true;
    } else if (haystacks.name.startsWith(token) || haystacks.displayName.startsWith(token)) {
      score += 3200;
      tokenMatched = true;
    } else if (haystacks.name.includes(token) || haystacks.displayName.includes(token)) {
      score += 2200;
      tokenMatched = true;
    }

    if (haystacks.author.includes(token)) {
      score += 900;
      tokenMatched = true;
    }

    if (haystacks.tags.some((tag) => tag.includes(token))) {
      score += 700;
      tokenMatched = true;
    }

    if (haystacks.categories.some((category) => category.includes(token))) {
      score += 600;
      tokenMatched = true;
    }

    if (haystacks.description.includes(token)) {
      score += 300;
      tokenMatched = true;
    }

    if (!tokenMatched) {
      return -1;
    }
  }

  return score + item.popularity / 1000 + item.installs / 10 + item.stars * 5;
};

const sanitizeZipEntryPath = (entryName: string): string => {
  const normalized = path.posix.normalize(entryName.replace(/\\/g, '/'));

  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Unsafe archive entry: ${entryName}`);
  }

  return normalized.replace(/^\/+/, '');
};

const parseSkillFrontMatter = (content: string): { name: string; description: string } => {
  const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) {
    return { name: '', description: '' };
  }

  const frontMatter = frontMatterMatch[1];
  const nameMatch = frontMatter.match(/^name:\s*(.+)$/m);
  const descriptionMatch = frontMatter.match(/^description:\s*['"]?(.+?)['"]?$/m);

  return {
    name: normalizeString(nameMatch?.[1]),
    description: normalizeString(descriptionMatch?.[1]),
  };
};

export class SkillMarketService {
  private readonly fetchImpl: typeof fetch;
  private readonly configUrl: string;
  private readonly skillsDir: string;

  private configCache: CacheEntry<SkillMarketConfig> | null = null;
  private statsCache: CacheEntry<SkillMarketStats> | null = null;
  private manifestCache: CacheEntry<SkillMarketManifest> | null = null;

  constructor(options: SkillMarketServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.configUrl = options.configUrl || DEFAULT_CONFIG_URL;
    this.skillsDir = options.skillsDir || getSkillsDir();
  }

  async searchSkills(params: SkillMarketSearchParams = {}): Promise<SkillMarketSearchResult> {
    const limit = Math.max(1, Math.min(params.limit || DEFAULT_PAGE_SIZE, 50));
    const offset = Math.max(0, params.offset || 0);
    const [config, stats, manifest] = await Promise.all([
      this.getConfig(Boolean(params.forceRefresh)),
      this.getStats(Boolean(params.forceRefresh)),
      this.getManifest(Boolean(params.forceRefresh)),
    ]);

    const tokens = tokenizeQuery(params.query || '');
    const rankedItems = manifest.items
      .map(normalizeSearchItem)
      .map((item) => ({ item, score: scoreItem(item, tokens) }))
      .filter((entry) => entry.score >= 0)
      .toSorted((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.item.popularity !== left.item.popularity) {
          return right.item.popularity - left.item.popularity;
        }

        if (right.item.installs !== left.item.installs) {
          return right.item.installs - left.item.installs;
        }

        return left.item.name.localeCompare(right.item.name);
      });

    return {
      items: rankedItems.slice(offset, offset + limit).map((entry) => entry.item),
      total: rankedItems.length,
      totalAvailable: Math.max(stats.total, manifest.items.length),
      siteUrl: config.siteUrl,
      pageSize: config.pageSize,
      featuredCount: config.featuredCount,
      categories: stats.categories,
      sources: stats.sources,
    };
  }

  async installSkill(params: SkillMarketInstallParams): Promise<SkillMarketInstallResult> {
    const skillId = normalizeString(params.skillId);
    if (!skillId) {
      throw new Error('Skill id is required');
    }

    const [config, manifest] = await Promise.all([this.getConfig(false), this.getManifest(false)]);
    const item = manifest.items.find((candidate) => normalizeString(candidate.id) === skillId);

    if (!item) {
      throw new Error(`Skill "${skillId}" was not found in Skill Market`);
    }

    const normalizedItem = normalizeSearchItem(item);
    const archives = this.getCandidateArchives(config, normalizedItem, params.archive);

    if (archives.length === 0) {
      throw new Error(`Skill "${normalizedItem.name}" does not provide a downloadable archive`);
    }

    let lastError: Error | null = null;

    for (const archive of archives) {
      try {
        const buffer = await this.downloadArchive(archive.archiveUrl);
        return await this.extractAndInstallArchive(normalizedItem.name, buffer, archive.archiveUrl);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError || new Error(`Failed to install skill "${normalizedItem.name}"`);
  }

  private async getConfig(forceRefresh: boolean): Promise<SkillMarketConfig> {
    const now = Date.now();
    if (!forceRefresh && this.configCache && this.configCache.expiresAt > now) {
      return this.configCache.value;
    }

    const response = await this.fetchImpl(this.configUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Skill Market config (${response.status})`);
    }

    const content = await response.text();
    const rawConfig = this.parseConfig(content);
    const siteUrl = normalizeString(rawConfig.siteUrl) || 'https://www.skillmarket.com.cn';
    const siteBaseUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
    const config: SkillMarketConfig = {
      brandName: normalizeString(rawConfig.brandName) || 'ContextGo',
      siteUrl,
      manifestUrl: resolveUrl(rawConfig.manifestUrl, siteBaseUrl),
      statsUrl: resolveUrl(rawConfig.statsUrl, siteBaseUrl),
      packageBaseUrls: Object.fromEntries(
        Object.entries(rawConfig.packageBaseUrls || {}).map(([source, baseUrl]) => [
          source,
          resolveUrl(baseUrl, siteBaseUrl),
        ])
      ),
      featuredCount: Math.max(1, normalizeNumber(rawConfig.featuredCount) || 8),
      pageSize: Math.max(1, normalizeNumber(rawConfig.pageSize) || DEFAULT_PAGE_SIZE),
    };

    this.configCache = {
      value: config,
      expiresAt: now + CONFIG_CACHE_TTL_MS,
    };

    return config;
  }

  private async getStats(forceRefresh: boolean): Promise<SkillMarketStats> {
    const now = Date.now();
    if (!forceRefresh && this.statsCache && this.statsCache.expiresAt > now) {
      return this.statsCache.value;
    }

    const config = await this.getConfig(forceRefresh);
    const response = await this.fetchImpl(config.statsUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Skill Market stats (${response.status})`);
    }

    const rawStats = (await response.json()) as {
      total?: number;
      categories?: string[];
      sources?: Record<string, number>;
    };
    const stats: SkillMarketStats = {
      total: Math.max(0, normalizeNumber(rawStats.total)),
      categories: normalizeStringArray(rawStats.categories),
      sources:
        rawStats.sources && typeof rawStats.sources === 'object'
          ? Object.fromEntries(
              Object.entries(rawStats.sources).map(([key, value]) => [key, Math.max(0, normalizeNumber(value))])
            )
          : {},
    };

    this.statsCache = {
      value: stats,
      expiresAt: now + STATS_CACHE_TTL_MS,
    };

    return stats;
  }

  private async getManifest(forceRefresh: boolean): Promise<SkillMarketManifest> {
    const now = Date.now();
    if (!forceRefresh && this.manifestCache && this.manifestCache.expiresAt > now) {
      return this.manifestCache.value;
    }

    const config = await this.getConfig(forceRefresh);
    const response = await this.fetchImpl(config.manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Skill Market catalog (${response.status})`);
    }

    const rawManifest = (await response.json()) as { items?: SkillMarketManifestItem[] };
    const manifest: SkillMarketManifest = {
      items: Array.isArray(rawManifest.items) ? rawManifest.items : [],
    };

    this.manifestCache = {
      value: manifest,
      expiresAt: now + MANIFEST_CACHE_TTL_MS,
    };

    return manifest;
  }

  private parseConfig(content: string): SkillMarketConfigPayload {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');

    if (start < 0 || end < start) {
      throw new Error('Skill Market config.js does not contain a valid JSON object');
    }

    return JSON.parse(content.slice(start, end + 1)) as SkillMarketConfigPayload;
  }

  private getCandidateArchives(
    config: SkillMarketConfig,
    item: SkillMarketSearchItem,
    preferredArchive?: SkillMarketArchive
  ): Array<{ archive: SkillMarketArchive; archiveUrl: string }> {
    const seen = new Set<string>();
    const candidates = preferredArchive ? [preferredArchive, ...item.archives] : item.archives;

    return candidates
      .filter((archive) => archive.source && archive.relativePath)
      .map((archive) => {
        const packageBaseUrl = config.packageBaseUrls[archive.source];
        if (!packageBaseUrl) {
          return null;
        }

        const dedupeKey = `${archive.source}:${archive.relativePath}`;
        if (seen.has(dedupeKey)) {
          return null;
        }

        seen.add(dedupeKey);
        return {
          archive,
          archiveUrl: resolveUrl(archive.relativePath, packageBaseUrl),
        };
      })
      .filter((archive): archive is { archive: SkillMarketArchive; archiveUrl: string } => Boolean(archive));
  }

  private async downloadArchive(archiveUrl: string): Promise<Buffer> {
    const response = await this.fetchImpl(archiveUrl);
    if (!response.ok) {
      throw new Error(`Failed to download archive (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Downloaded archive is empty');
    }

    return Buffer.from(arrayBuffer);
  }

  private async extractAndInstallArchive(
    expectedSkillName: string,
    archiveBuffer: Buffer,
    archiveUrl: string
  ): Promise<SkillMarketInstallResult> {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-skill-market-'));

    try {
      const extractDir = path.join(tempRoot, 'package');
      await fs.mkdir(extractDir, { recursive: true });
      await this.extractZipArchive(archiveBuffer, extractDir);

      const skillRoot = await this.selectSkillRoot(extractDir, expectedSkillName);
      const skillInfo = await this.readSkillInfo(skillRoot);
      const targetDir = path.join(this.skillsDir, skillInfo.name);

      await fs.mkdir(this.skillsDir, { recursive: true });

      try {
        await fs.access(targetDir);
        throw new Error(`Skill "${skillInfo.name}" already exists`);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('already exists')) {
          // Target does not exist, continue.
        } else {
          throw error;
        }
      }

      await this.copyDirectory(skillRoot, targetDir);

      return {
        skillName: skillInfo.name,
        installedPath: targetDir,
        archiveUrl,
      };
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }

  private async extractZipArchive(buffer: Buffer, destinationDir: string): Promise<void> {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.values(zip.files);

    for (const entry of entries) {
      if (entry.dir) {
        continue;
      }

      const relativePath = sanitizeZipEntryPath(entry.name);
      if (!relativePath) {
        continue;
      }

      const targetPath = path.join(destinationDir, relativePath);
      const parentDir = path.dirname(targetPath);
      await fs.mkdir(parentDir, { recursive: true });
      const fileBuffer = await entry.async('nodebuffer');
      await fs.writeFile(targetPath, fileBuffer);
    }
  }

  private async selectSkillRoot(rootDir: string, expectedSkillName: string): Promise<string> {
    const skillRoots = await this.findSkillRoots(rootDir);
    if (skillRoots.length === 0) {
      throw new Error('Downloaded archive does not contain a SKILL.md entry point');
    }

    if (skillRoots.length === 1) {
      return skillRoots[0];
    }

    const normalizedExpectedName = expectedSkillName.trim().toLowerCase();
    const matchingRoots: string[] = [];

    for (const skillRoot of skillRoots) {
      const info = await this.readSkillInfo(skillRoot);
      if (info.name.trim().toLowerCase() === normalizedExpectedName) {
        matchingRoots.push(skillRoot);
      }
    }

    if (matchingRoots.length === 1) {
      return matchingRoots[0];
    }

    throw new Error('Downloaded archive contains multiple skill roots');
  }

  private async findSkillRoots(rootDir: string): Promise<string[]> {
    const queue = [rootDir];
    const matches: string[] = [];

    while (queue.length > 0) {
      const currentDir = queue.shift();
      if (!currentDir) {
        continue;
      }

      try {
        await fs.access(path.join(currentDir, 'SKILL.md'));
        matches.push(currentDir);
        continue;
      } catch {
        // Continue traversing child directories.
      }

      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        queue.push(path.join(currentDir, entry.name));
      }
    }

    return matches.toSorted((left, right) => left.length - right.length);
  }

  private async readSkillInfo(skillDir: string): Promise<{ name: string; description: string }> {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const content = await fs.readFile(skillMdPath, 'utf-8');
    const frontMatter = parseSkillFrontMatter(content);
    const skillName = frontMatter.name || path.basename(skillDir);

    return {
      name: skillName,
      description: frontMatter.description,
    };
  }

  private async copyDirectory(sourceDir: string, targetDir: string): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true });
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
        continue;
      }

      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

export const skillMarketService = new SkillMarketService();
