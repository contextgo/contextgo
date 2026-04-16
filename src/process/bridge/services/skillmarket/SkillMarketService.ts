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
const INDUSTRY_CACHE_TTL_MS = 10 * 60 * 1000;
const BUNDLE_CACHE_TTL_MS = 10 * 60 * 1000;

const SKILL_MARKET_VIEWS = ['curated', 'full'] as const;

export type SkillMarketView = (typeof SKILL_MARKET_VIEWS)[number];

export type SkillMarketArchive = {
  source: string;
  relativePath: string;
  label?: string;
};

export type SkillMarketTopIndustry = {
  id: string;
  label: string;
  count: number;
};

export type SkillMarketTopCapability = {
  label: string;
  count: number;
};

type SkillMarketConfigPayload = {
  brandName?: string;
  siteUrl?: string;
  manifestUrl?: string;
  statsUrl?: string;
  fullManifestUrl?: string;
  fullStatsUrl?: string;
  industryUrl?: string;
  bundleUrl?: string;
  packageBaseUrls?: Record<string, string>;
  featuredCount?: number;
  pageSize?: number;
  defaultView?: string;
};

type SkillMarketConfig = {
  brandName: string;
  siteUrl: string;
  manifestUrls: Record<SkillMarketView, string>;
  statsUrls: Record<SkillMarketView, string>;
  industryUrl?: string;
  bundleUrl?: string;
  packageBaseUrls: Record<string, string>;
  featuredCount: number;
  pageSize: number;
  defaultView: SkillMarketView;
};

export type SkillMarketStats = {
  total: number;
  categories: string[];
  sources: Record<string, number>;
  sourceTotal: number;
  reducedCount: number;
  reductionRatio: number;
  clusterCount: number;
  topIndustries: SkillMarketTopIndustry[];
  topCapabilities: SkillMarketTopCapability[];
  generatedAt?: string;
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
  themes?: string[];
  industries?: string[];
  primaryCapability?: string;
  selectionReason?: string;
  sources?: string[];
  homepage?: string;
  readmeUrl?: string;
  installCommand?: string;
  archives?: SkillMarketArchive[];
  metrics?: Record<string, number>;
  popularity?: number;
  qualityScore?: number;
};

type SkillMarketManifest = {
  items: SkillMarketManifestItem[];
};

type SkillMarketIndustryPayload = {
  id?: string;
  label?: string;
  summary?: string;
  problems?: string[];
  useCases?: string[];
  outcomes?: string[];
  workflow?: string[];
  count?: number;
  topThemes?: string[];
  bundleIds?: string[];
  recommendedSkillIds?: string[];
};

type SkillMarketBundleStepPayload = {
  label?: string;
  themes?: string[];
  skillIds?: string[];
};

type SkillMarketBundlePayload = {
  id?: string;
  title?: string;
  summary?: string;
  industries?: string[];
  forTeams?: string;
  deliverables?: string[];
  valuePoints?: string[];
  steps?: SkillMarketBundleStepPayload[];
  skillIds?: string[];
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
  themes: string[];
  industries: string[];
  primaryCapability?: string;
  selectionReason?: string;
  homepage?: string;
  readmeUrl?: string;
  archives: SkillMarketArchive[];
  popularity: number;
  qualityScore: number;
  installs: number;
  stars: number;
};

export type SkillMarketIndustry = {
  id: string;
  label: string;
  summary: string;
  problems: string[];
  useCases: string[];
  outcomes: string[];
  workflow: string[];
  count: number;
  topThemes: string[];
  bundleIds: string[];
  recommendedSkills: SkillMarketSearchItem[];
};

export type SkillMarketBundleStep = {
  label: string;
  themes: string[];
  skillIds: string[];
  skills: SkillMarketSearchItem[];
};

export type SkillMarketBundle = {
  id: string;
  title: string;
  summary: string;
  industries: string[];
  forTeams: string;
  deliverables: string[];
  valuePoints: string[];
  steps: SkillMarketBundleStep[];
  skills: SkillMarketSearchItem[];
};

type RankedSkillMarketBundle = {
  bundle: SkillMarketBundle;
  score: number;
};

export type SkillMarketSearchParams = {
  query?: string;
  limit?: number;
  offset?: number;
  forceRefresh?: boolean;
  view?: SkillMarketView;
  industryId?: string;
};

export type SkillMarketSearchResult = {
  brandName: string;
  view: SkillMarketView;
  defaultView: SkillMarketView;
  items: SkillMarketSearchItem[];
  total: number;
  totalAvailable: number;
  siteUrl: string;
  pageSize: number;
  featuredCount: number;
  categories: string[];
  sources: Record<string, number>;
  stats: SkillMarketStats;
  industryIndex: SkillMarketIndustry[];
  bundles: SkillMarketBundle[];
};

export type SkillMarketInstallParams = {
  skillId: string;
  archive?: SkillMarketArchive;
  skillsDir?: string;
};

export type SkillMarketInstallResult = {
  skillName: string;
  installedPath: string;
  archiveUrl: string;
};

type SkillMarketIdentity = {
  id: string;
  name: string;
  version: string;
  author: string;
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

const normalizeView = (value: unknown, fallback: SkillMarketView = 'curated'): SkillMarketView =>
  value === 'full' ? 'full' : value === 'curated' ? 'curated' : fallback;

const tokenizeQuery = (query: string): string[] => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

const resolveUrl = (value: string | undefined, base: string): string => new URL(value || '.', base).toString();

const resolveOptionalUrl = (value: string | undefined, base: string): string | undefined => {
  const normalized = normalizeString(value);
  return normalized ? resolveUrl(normalized, base) : undefined;
};

const getInstallCount = (metrics: Record<string, number>): number =>
  (metrics.skillhub_installs || 0) + (metrics.openclawmp_installs || 0);

const getStarCount = (metrics: Record<string, number>): number =>
  (metrics.skillhub_stars || 0) + (metrics.openclawmp_total_stars || 0) + (metrics.openclawmp_github_stars || 0);

const parseSkillIdentity = (skillId: string): SkillMarketIdentity => {
  const normalizedId = normalizeString(skillId);
  const [rawName = '', rawVersion = '', rawAuthor = ''] = normalizedId.split('::');

  return {
    id: normalizedId,
    name: normalizeString(rawName),
    version: normalizeString(rawVersion),
    author: normalizeString(rawAuthor),
  };
};

const getManifestItemIdentity = (item: SkillMarketManifestItem): SkillMarketIdentity => {
  const name = normalizeString(item.name);
  const version = normalizeString(item.version);
  const author = normalizeString(item.author);
  const normalizedId = normalizeString(item.id);

  return {
    id: normalizedId || [name, version, author].join('::'),
    name,
    version,
    author,
  };
};

const archiveMatches = (left: SkillMarketArchive | undefined, right: SkillMarketArchive | undefined): boolean =>
  normalizeString(left?.source) === normalizeString(right?.source) &&
  normalizeString(left?.relativePath) === normalizeString(right?.relativePath);

const sameIdentity = (left: SkillMarketIdentity, right: SkillMarketIdentity): boolean =>
  left.name === right.name &&
  (!left.version || left.version === right.version) &&
  (!left.author || left.author === right.author);

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
    themes: normalizeStringArray(item.themes),
    industries: normalizeStringArray(item.industries),
    primaryCapability: normalizeString(item.primaryCapability) || undefined,
    selectionReason: normalizeString(item.selectionReason) || undefined,
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
    qualityScore: Math.max(0, normalizeNumber(item.qualityScore)),
    installs: getInstallCount(metrics),
    stars: getStarCount(metrics),
  };
};

const scoreItem = (item: SkillMarketSearchItem, tokens: string[]): number => {
  if (tokens.length === 0) {
    return item.qualityScore * 1000 + item.popularity * 10 + item.installs * 50 + item.stars * 100;
  }

  const haystacks = {
    name: item.name.toLowerCase(),
    displayName: item.displayName.toLowerCase(),
    author: item.author.toLowerCase(),
    description: item.description.toLowerCase(),
    capability: (item.primaryCapability || '').toLowerCase(),
    categories: item.categories.map((category) => category.toLowerCase()),
    tags: item.tags.map((tag) => tag.toLowerCase()),
    themes: item.themes.map((theme) => theme.toLowerCase()),
    industries: item.industries.map((industry) => industry.toLowerCase()),
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

    if (haystacks.capability.includes(token)) {
      score += 800;
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

    if (haystacks.themes.some((theme) => theme.includes(token))) {
      score += 600;
      tokenMatched = true;
    }

    if (haystacks.industries.some((industry) => industry.includes(token))) {
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

  return score + item.qualityScore * 20 + item.popularity / 1000 + item.installs / 10 + item.stars * 5;
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

const normalizeTopIndustries = (value: unknown): SkillMarketTopIndustry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => ({
      id: normalizeString((entry as SkillMarketTopIndustry).id),
      label: normalizeString((entry as SkillMarketTopIndustry).label),
      count: Math.max(0, normalizeNumber((entry as SkillMarketTopIndustry).count)),
    }))
    .filter((entry) => entry.id && entry.label);
};

const normalizeTopCapabilities = (value: unknown): SkillMarketTopCapability[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => ({
      label: normalizeString((entry as SkillMarketTopCapability).label),
      count: Math.max(0, normalizeNumber((entry as SkillMarketTopCapability).count)),
    }))
    .filter((entry) => entry.label);
};

const getCategoriesFromItems = (items: SkillMarketSearchItem[]): string[] =>
  Array.from(new Set(items.flatMap((item) => item.categories).filter(Boolean))).toSorted((left, right) =>
    left.localeCompare(right)
  );

const scoreBundle = (bundle: SkillMarketBundle, tokens: string[]): number => {
  const skillThemes = bundle.steps.flatMap((step) => step.themes);
  const skillIndustries = bundle.skills.flatMap((skill) => skill.industries);
  const haystacks = {
    id: bundle.id.toLowerCase(),
    title: bundle.title.toLowerCase(),
    summary: bundle.summary.toLowerCase(),
    teams: bundle.forTeams.toLowerCase(),
    deliverables: bundle.deliverables.map((item) => item.toLowerCase()),
    valuePoints: bundle.valuePoints.map((item) => item.toLowerCase()),
    steps: bundle.steps.map((step) => step.label.toLowerCase()),
    stepThemes: skillThemes.map((theme) => theme.toLowerCase()),
    industries: bundle.industries.map((industry) => industry.toLowerCase()),
    skillNames: bundle.skills.map((skill) => skill.name.toLowerCase()),
    skillDisplayNames: bundle.skills.map((skill) => skill.displayName.toLowerCase()),
    skillIndustries: skillIndustries.map((industry) => industry.toLowerCase()),
  };

  if (tokens.length === 0) {
    return (
      bundle.skills.reduce(
        (total, skill) => total + skill.qualityScore * 100 + skill.installs * 10 + skill.stars * 20,
        0
      ) +
      bundle.steps.length * 100 +
      bundle.deliverables.length * 20
    );
  }

  let score = 0;

  for (const token of tokens) {
    let tokenMatched = false;

    if (haystacks.id === token || haystacks.title === token) {
      score += 5000;
      tokenMatched = true;
    } else if (haystacks.id.startsWith(token) || haystacks.title.startsWith(token)) {
      score += 3200;
      tokenMatched = true;
    } else if (haystacks.id.includes(token) || haystacks.title.includes(token)) {
      score += 2200;
      tokenMatched = true;
    }

    if (haystacks.summary.includes(token)) {
      score += 1000;
      tokenMatched = true;
    }

    if (haystacks.teams.includes(token)) {
      score += 900;
      tokenMatched = true;
    }

    if (haystacks.industries.some((industry) => industry.includes(token))) {
      score += 800;
      tokenMatched = true;
    }

    if (haystacks.stepThemes.some((theme) => theme.includes(token))) {
      score += 700;
      tokenMatched = true;
    }

    if (haystacks.steps.some((step) => step.includes(token))) {
      score += 600;
      tokenMatched = true;
    }

    if (
      haystacks.deliverables.some((item) => item.includes(token)) ||
      haystacks.valuePoints.some((item) => item.includes(token))
    ) {
      score += 500;
      tokenMatched = true;
    }

    if (
      haystacks.skillNames.some((name) => name.includes(token)) ||
      haystacks.skillDisplayNames.some((name) => name.includes(token)) ||
      haystacks.skillIndustries.some((industry) => industry.includes(token))
    ) {
      score += 400;
      tokenMatched = true;
    }

    if (!tokenMatched) {
      return -1;
    }
  }

  return (
    score +
    bundle.skills.reduce((total, skill) => total + skill.qualityScore * 10 + skill.installs + skill.stars * 2, 0)
  );
};

const resolveReferencedSkills = (
  skillIds: string[] | undefined,
  itemMap: Map<string, SkillMarketSearchItem>
): SkillMarketSearchItem[] => {
  if (!skillIds) {
    return [];
  }

  const resolvedItems: SkillMarketSearchItem[] = [];
  const seen = new Set<string>();

  for (const skillId of skillIds) {
    const normalizedId = normalizeString(skillId);
    if (!normalizedId || seen.has(normalizedId)) {
      continue;
    }

    const item = itemMap.get(normalizedId);
    if (!item) {
      continue;
    }

    seen.add(normalizedId);
    resolvedItems.push(item);
  }

  return resolvedItems;
};

export class SkillMarketService {
  private readonly fetchImpl: typeof fetch;
  private readonly configUrl: string;
  private readonly skillsDir: string;

  private configCache: CacheEntry<SkillMarketConfig> | null = null;
  private statsCache: Partial<Record<SkillMarketView, CacheEntry<SkillMarketStats>>> = {};
  private manifestCache: Partial<Record<SkillMarketView, CacheEntry<SkillMarketManifest>>> = {};
  private industryCache: CacheEntry<SkillMarketIndustryPayload[]> | null = null;
  private bundleCache: CacheEntry<SkillMarketBundlePayload[]> | null = null;

  constructor(options: SkillMarketServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.configUrl = options.configUrl || DEFAULT_CONFIG_URL;
    this.skillsDir = options.skillsDir || getSkillsDir();
  }

  async searchSkills(params: SkillMarketSearchParams = {}): Promise<SkillMarketSearchResult> {
    const limit = Math.max(1, Math.min(params.limit || DEFAULT_PAGE_SIZE, 50));
    const offset = Math.max(0, params.offset || 0);
    const config = await this.getConfig(Boolean(params.forceRefresh));
    const view = normalizeView(params.view, config.defaultView);
    const forceRefresh = Boolean(params.forceRefresh);

    const [stats, manifest, rawIndustries, rawBundles] = await Promise.all([
      this.getStats(view, forceRefresh),
      this.getManifest(view, forceRefresh),
      this.getIndustryIndex(forceRefresh),
      this.getBundles(forceRefresh),
    ]);
    const curatedManifest = view === 'curated' ? manifest : await this.getManifest('curated', forceRefresh);

    const normalizedItems = manifest.items.map(normalizeSearchItem);
    const curatedItemMap = new Map(
      curatedManifest.items.map(normalizeSearchItem).map((item) => [item.id, item] as const)
    );
    const tokens = tokenizeQuery(params.query || '');
    const normalizedIndustryId = normalizeString(params.industryId);
    const rankedItems = normalizedItems
      .filter((item) => !normalizedIndustryId || item.industries.includes(normalizedIndustryId))
      .map((item) => ({ item, score: scoreItem(item, tokens) }))
      .filter((entry) => entry.score >= 0)
      .toSorted((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.item.qualityScore !== left.item.qualityScore) {
          return right.item.qualityScore - left.item.qualityScore;
        }

        if (right.item.popularity !== left.item.popularity) {
          return right.item.popularity - left.item.popularity;
        }

        if (right.item.installs !== left.item.installs) {
          return right.item.installs - left.item.installs;
        }

        return left.item.name.localeCompare(right.item.name);
      });

    const industryIndex: SkillMarketIndustry[] = rawIndustries
      .map((industry) => ({
        id: normalizeString(industry.id),
        label: normalizeString(industry.label),
        summary: normalizeString(industry.summary),
        problems: normalizeStringArray(industry.problems),
        useCases: normalizeStringArray(industry.useCases),
        outcomes: normalizeStringArray(industry.outcomes),
        workflow: normalizeStringArray(industry.workflow),
        count: Math.max(0, normalizeNumber(industry.count)),
        topThemes: normalizeStringArray(industry.topThemes),
        bundleIds: normalizeStringArray(industry.bundleIds),
        recommendedSkills: resolveReferencedSkills(industry.recommendedSkillIds, curatedItemMap),
      }))
      .filter((industry) => industry.id && industry.label);

    const bundles: SkillMarketBundle[] = rawBundles
      .map((bundle) => ({
        id: normalizeString(bundle.id),
        title: normalizeString(bundle.title),
        summary: normalizeString(bundle.summary),
        industries: normalizeStringArray(bundle.industries),
        forTeams: normalizeString(bundle.forTeams),
        deliverables: normalizeStringArray(bundle.deliverables),
        valuePoints: normalizeStringArray(bundle.valuePoints),
        steps: Array.isArray(bundle.steps)
          ? bundle.steps
              .map((step) => {
                const skillIds = normalizeStringArray(step.skillIds);
                return {
                  label: normalizeString(step.label),
                  themes: normalizeStringArray(step.themes),
                  skillIds,
                  skills: resolveReferencedSkills(skillIds, curatedItemMap),
                };
              })
              .filter((step) => step.label)
          : [],
        skills: resolveReferencedSkills(bundle.skillIds, curatedItemMap),
      }))
      .filter((bundle) => bundle.id && bundle.title);

    const selectedIndustry = normalizedIndustryId
      ? industryIndex.find((industry) => industry.id === normalizedIndustryId) || null
      : null;
    const selectedIndustryBundleIds = new Set(selectedIndustry?.bundleIds || []);
    const rankedBundles: RankedSkillMarketBundle[] = bundles
      .filter((bundle) => {
        if (!selectedIndustry) {
          return true;
        }

        return bundle.industries.includes(selectedIndustry.id) || selectedIndustryBundleIds.has(bundle.id);
      })
      .map((bundle) => ({
        bundle,
        score: scoreBundle(bundle, tokens),
      }))
      .toSorted((left, right) => {
        const leftRecommended = selectedIndustryBundleIds.has(left.bundle.id);
        const rightRecommended = selectedIndustryBundleIds.has(right.bundle.id);
        if (leftRecommended !== rightRecommended) {
          return rightRecommended ? 1 : -1;
        }

        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.bundle.skills.length !== left.bundle.skills.length) {
          return right.bundle.skills.length - left.bundle.skills.length;
        }

        return left.bundle.title.localeCompare(right.bundle.title);
      });

    return {
      brandName: config.brandName,
      view,
      defaultView: config.defaultView,
      items: rankedItems.slice(offset, offset + limit).map((entry) => entry.item),
      total: rankedItems.length,
      totalAvailable: Math.max(stats.total, manifest.items.length),
      siteUrl: config.siteUrl,
      pageSize: config.pageSize,
      featuredCount: config.featuredCount,
      categories: stats.categories.length > 0 ? stats.categories : getCategoriesFromItems(normalizedItems),
      sources: stats.sources,
      stats,
      industryIndex,
      bundles: rankedBundles.map((entry) => entry.bundle),
    };
  }

  async installSkill(params: SkillMarketInstallParams): Promise<SkillMarketInstallResult> {
    const skillId = normalizeString(params.skillId);
    if (!skillId) {
      throw new Error('Skill id is required');
    }

    const [config, manifest] = await Promise.all([this.getConfig(false), this.getManifest('full', false)]);
    const requestedIdentity = parseSkillIdentity(skillId);
    const exactMatch = manifest.items.find((candidate) => normalizeString(candidate.id) === skillId);
    const identityMatches = manifest.items.filter((candidate) =>
      sameIdentity(requestedIdentity, getManifestItemIdentity(candidate))
    );

    const item =
      exactMatch ||
      identityMatches.find((candidate) =>
        params.archive
          ? normalizeSearchItem(candidate).archives.some((archive) => archiveMatches(archive, params.archive))
          : false
      ) ||
      identityMatches[0];

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
        return await this.extractAndInstallArchive(
          normalizedItem.name,
          buffer,
          archive.archiveUrl,
          normalizeString(params.skillsDir) || this.skillsDir
        );
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
    const manifestUrl = resolveUrl(rawConfig.manifestUrl, siteBaseUrl);
    const statsUrl = resolveUrl(rawConfig.statsUrl, siteBaseUrl);
    const config: SkillMarketConfig = {
      brandName: normalizeString(rawConfig.brandName) || 'ContextGo',
      siteUrl,
      manifestUrls: {
        curated: manifestUrl,
        full: resolveUrl(rawConfig.fullManifestUrl || rawConfig.manifestUrl, siteBaseUrl),
      },
      statsUrls: {
        curated: statsUrl,
        full: resolveUrl(rawConfig.fullStatsUrl || rawConfig.statsUrl, siteBaseUrl),
      },
      industryUrl: resolveOptionalUrl(rawConfig.industryUrl, siteBaseUrl),
      bundleUrl: resolveOptionalUrl(rawConfig.bundleUrl, siteBaseUrl),
      packageBaseUrls: Object.fromEntries(
        Object.entries(rawConfig.packageBaseUrls || {}).map(([source, baseUrl]) => [
          source,
          resolveUrl(baseUrl, siteBaseUrl),
        ])
      ),
      featuredCount: Math.max(1, normalizeNumber(rawConfig.featuredCount) || 8),
      pageSize: Math.max(1, normalizeNumber(rawConfig.pageSize) || DEFAULT_PAGE_SIZE),
      defaultView: normalizeView(rawConfig.defaultView, 'curated'),
    };

    this.configCache = {
      value: config,
      expiresAt: now + CONFIG_CACHE_TTL_MS,
    };

    return config;
  }

  private async getStats(view: SkillMarketView, forceRefresh: boolean): Promise<SkillMarketStats> {
    const now = Date.now();
    const cacheEntry = this.statsCache[view];
    if (!forceRefresh && cacheEntry && cacheEntry.expiresAt > now) {
      return cacheEntry.value;
    }

    const config = await this.getConfig(forceRefresh);
    const response = await this.fetchImpl(config.statsUrls[view]);
    if (!response.ok) {
      throw new Error(`Failed to fetch Skill Market stats (${response.status})`);
    }

    const rawStats = (await response.json()) as {
      total?: number;
      categories?: string[];
      sources?: Record<string, number>;
      sourceTotal?: number;
      reducedCount?: number;
      reductionRatio?: number;
      clusterCount?: number;
      topIndustries?: SkillMarketTopIndustry[];
      topCapabilities?: SkillMarketTopCapability[];
      generatedAt?: string;
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
      sourceTotal: Math.max(0, normalizeNumber(rawStats.sourceTotal)),
      reducedCount: Math.max(0, normalizeNumber(rawStats.reducedCount)),
      reductionRatio: Math.max(0, normalizeNumber(rawStats.reductionRatio)),
      clusterCount: Math.max(0, normalizeNumber(rawStats.clusterCount)),
      topIndustries: normalizeTopIndustries(rawStats.topIndustries),
      topCapabilities: normalizeTopCapabilities(rawStats.topCapabilities),
      generatedAt: normalizeString(rawStats.generatedAt) || undefined,
    };

    this.statsCache[view] = {
      value: stats,
      expiresAt: now + STATS_CACHE_TTL_MS,
    };

    return stats;
  }

  private async getManifest(view: SkillMarketView, forceRefresh: boolean): Promise<SkillMarketManifest> {
    const now = Date.now();
    const cacheEntry = this.manifestCache[view];
    if (!forceRefresh && cacheEntry && cacheEntry.expiresAt > now) {
      return cacheEntry.value;
    }

    const config = await this.getConfig(forceRefresh);
    const response = await this.fetchImpl(config.manifestUrls[view]);
    if (!response.ok) {
      throw new Error(`Failed to fetch Skill Market catalog (${response.status})`);
    }

    const rawManifest = (await response.json()) as { items?: SkillMarketManifestItem[] };
    const manifest: SkillMarketManifest = {
      items: Array.isArray(rawManifest.items) ? rawManifest.items : [],
    };

    this.manifestCache[view] = {
      value: manifest,
      expiresAt: now + MANIFEST_CACHE_TTL_MS,
    };

    return manifest;
  }

  private async getIndustryIndex(forceRefresh: boolean): Promise<SkillMarketIndustryPayload[]> {
    const now = Date.now();
    if (!forceRefresh && this.industryCache && this.industryCache.expiresAt > now) {
      return this.industryCache.value;
    }

    const config = await this.getConfig(forceRefresh);
    if (!config.industryUrl) {
      return [];
    }

    const response = await this.fetchImpl(config.industryUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Skill Market industry index (${response.status})`);
    }

    const rawPayload = (await response.json()) as { industries?: SkillMarketIndustryPayload[] };
    const industries = Array.isArray(rawPayload.industries) ? rawPayload.industries : [];

    this.industryCache = {
      value: industries,
      expiresAt: now + INDUSTRY_CACHE_TTL_MS,
    };

    return industries;
  }

  private async getBundles(forceRefresh: boolean): Promise<SkillMarketBundlePayload[]> {
    const now = Date.now();
    if (!forceRefresh && this.bundleCache && this.bundleCache.expiresAt > now) {
      return this.bundleCache.value;
    }

    const config = await this.getConfig(forceRefresh);
    if (!config.bundleUrl) {
      return [];
    }

    const response = await this.fetchImpl(config.bundleUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Skill Market bundles (${response.status})`);
    }

    const rawPayload = (await response.json()) as { bundles?: SkillMarketBundlePayload[] };
    const bundles = Array.isArray(rawPayload.bundles) ? rawPayload.bundles : [];

    this.bundleCache = {
      value: bundles,
      expiresAt: now + BUNDLE_CACHE_TTL_MS,
    };

    return bundles;
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
    archiveUrl: string,
    skillsDir: string
  ): Promise<SkillMarketInstallResult> {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-skill-market-'));

    try {
      const extractDir = path.join(tempRoot, 'package');
      await fs.mkdir(extractDir, { recursive: true });
      await this.extractZipArchive(archiveBuffer, extractDir);

      const skillRoot = await this.selectSkillRoot(extractDir, expectedSkillName);
      const skillInfo = await this.readSkillInfo(skillRoot);
      const targetDir = path.join(skillsDir, skillInfo.name);

      await fs.mkdir(skillsDir, { recursive: true });

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
