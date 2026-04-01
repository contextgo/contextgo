import fs from 'node:fs/promises';
import path from 'node:path';
import { getSiteLabels } from '../../apps/web/src/lib/site-content/common';
import { getDocsSection } from '../../apps/web/src/lib/site-content/docs';
import type {
  ReleaseDocsBundle,
  ReleaseDocsIndex,
  ReleaseDocsLatest,
  ReleaseDocsVersion,
  SiteLocale,
} from '../../apps/web/src/lib/site-content/types';

const DOCS_SCHEMA_VERSION = 1;
const DEFAULT_TARGET_DIR = path.resolve(process.cwd(), '../contextgo-releases');

type Args = {
  target: string;
  version: string;
  sourceRef?: string;
};

const parseArgs = (): Args => {
  const args = process.argv.slice(2);
  const parsed: Partial<Args> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const value = args[index + 1];

    if (!value) {
      throw new Error(`Missing value for ${token}`);
    }

    switch (token) {
      case '--target':
        parsed.target = path.resolve(value);
        break;
      case '--version':
        parsed.version = value;
        break;
      case '--source-ref':
        parsed.sourceRef = value;
        break;
      default:
        throw new Error(`Unsupported argument: ${token}`);
    }

    index += 1;
  }

  return {
    target: parsed.target || DEFAULT_TARGET_DIR,
    version: normalizeVersion(parsed.version),
    sourceRef: parsed.sourceRef,
  };
};

const normalizeVersion = (value?: string): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    throw new Error('A release version is required');
  }

  return trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
};

const compareVersionPart = (left: string, right: string): number => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right);
};

const sortVersions = (left: ReleaseDocsVersion, right: ReleaseDocsVersion): number => {
  const leftParts = left.version.split(/[.-]/);
  const rightParts = right.version.split(/[.-]/);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const result = compareVersionPart(rightParts[index] || '0', leftParts[index] || '0');
    if (result !== 0) {
      return result;
    }
  }

  return right.version.localeCompare(left.version);
};

const writeJson = async (targetPath: string, data: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
};

const writeText = async (targetPath: string, value: string): Promise<void> => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, value, 'utf8');
};

const loadExistingIndex = async (docsRoot: string): Promise<ReleaseDocsIndex | null> => {
  try {
    const content = await fs.readFile(path.join(docsRoot, 'versions.json'), 'utf8');
    return JSON.parse(content) as ReleaseDocsIndex;
  } catch {
    return null;
  }
};

const buildBundle = (
  locale: SiteLocale,
  version: string,
  exportedAt: string,
  sourceRef?: string
): ReleaseDocsBundle => ({
  schemaVersion: DOCS_SCHEMA_VERSION,
  version,
  locale,
  exportedAt,
  sourceRef,
  docs: getDocsSection(locale),
  labels: getSiteLabels(locale),
});

const buildDocsReadme = (): string => `# ContextGo Versioned Docs

This directory is generated automatically by the ContextGo release pipeline.

## Structure

- \`latest.json\` — points the website to the latest published docs version
- \`versions.json\` — lists all published docs versions
- \`<version>/en.json\` — English docs bundle for that release
- \`<version>/zh.json\` — Simplified Chinese docs bundle for that release

The website reads \`/docs\` from these exported bundles and falls back to in-repo draft docs only when this directory is unavailable.
`;

async function main(): Promise<void> {
  const { target, version, sourceRef } = parseArgs();
  const exportedAt = new Date().toISOString();
  const docsRoot = path.join(target, 'docs');
  const versionDir = path.join(docsRoot, version);

  await fs.mkdir(versionDir, { recursive: true });

  const existingIndex = await loadExistingIndex(docsRoot);
  const versions = new Map<string, ReleaseDocsVersion>();

  for (const entry of existingIndex?.versions || []) {
    versions.set(entry.version, entry);
  }

  versions.set(version, {
    version,
    exportedAt,
    sourceRef,
  });

  const sortedVersions = Array.from(versions.values()).sort(sortVersions);

  const latest: ReleaseDocsLatest = {
    schemaVersion: DOCS_SCHEMA_VERSION,
    version,
    exportedAt,
    sourceRef,
  };

  const index: ReleaseDocsIndex = {
    schemaVersion: DOCS_SCHEMA_VERSION,
    latestVersion: version,
    exportedAt,
    versions: sortedVersions,
  };

  await Promise.all([
    writeJson(path.join(versionDir, 'en.json'), buildBundle('en', version, exportedAt, sourceRef)),
    writeJson(path.join(versionDir, 'zh.json'), buildBundle('zh', version, exportedAt, sourceRef)),
    writeJson(path.join(docsRoot, 'latest.json'), latest),
    writeJson(path.join(docsRoot, 'versions.json'), index),
    writeText(path.join(docsRoot, 'README.md'), buildDocsReadme()),
  ]);

  console.log(`[release-docs] Exported versioned docs to ${path.join('docs', version)}`);
}

void main().catch((error) => {
  console.error('[release-docs] Failed to export versioned docs:', error);
  process.exit(1);
});
