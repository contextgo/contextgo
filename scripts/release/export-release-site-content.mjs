import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPublicContentCollections,
  publicContentLocales,
  publicContentSchemaVersion,
  writeFile,
  writeJson,
} from '../../apps/web/src/content-tools/build.mjs';

const DEFAULT_TARGET_DIR = path.resolve(process.cwd(), '../contextgo-releases');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const templatesRoot = path.join(repoRoot, 'scripts/release/templates');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};

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

const normalizeVersion = (value) => {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    throw new Error('A release version is required');
  }

  return trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
};

const compareVersionPart = (left, right) => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right);
};

const sortVersions = (left, right) => {
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

const loadExistingDocsIndex = async (docsRoot) => {
  try {
    const content = await fs.readFile(path.join(docsRoot, 'versions.json'), 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const buildSiteReadme = () => `# ContextGo Public Site Content

This directory is generated automatically from the private source repository.

## Structure

- \`site/docs/latest.json\` points the website to the latest released docs version
- \`site/docs/versions.json\` lists all released docs versions
- \`site/docs/<version>/<locale>/index.json\` contains the docs section metadata and article index
- \`site/docs/<version>/<locale>/<slug>/article.json\` contains the rendered article payload
- \`site/docs/<version>/<locale>/<slug>/source.mdx\` keeps the published source content visible in the repository
- \`site/blog/<locale>/index.json\` contains the blog section metadata and article index
- \`site/blog/<locale>/<slug>/article.json\` contains the rendered blog article payload
- \`site/blog/<locale>/<slug>/source.mdx\` keeps the published source content visible in the repository

The website consumes the JSON payloads and links back to the published source files when needed.
`;

const loadTemplate = async (fileName) => {
  return fs.readFile(path.join(templatesRoot, fileName), 'utf8');
};

const { target, version, sourceRef } = parseArgs();
const exportedAt = new Date().toISOString();
const siteRoot = path.join(target, 'site');
const docsRoot = path.join(siteRoot, 'docs');
const blogRoot = path.join(siteRoot, 'blog');
const releaseRepoDocsRoot = path.join(target, 'docs');
const built = await buildPublicContentCollections({
  contentRoot: path.join(repoRoot, 'apps/web/src/content'),
  docsVersion: version,
  exportedAt,
  sourceRef,
});
const [releaseReadme, contentSubmissionGuide] = await Promise.all([
  loadTemplate('contextgo-releases-README.md'),
  loadTemplate('content-submission.md'),
]);

const existingIndex = await loadExistingDocsIndex(docsRoot);
const versions = new Map();

for (const entry of existingIndex?.versions || []) {
  versions.set(entry.version, entry);
}

versions.set(version, {
  version,
  exportedAt,
  sourceRef,
});

const latest = {
  schemaVersion: publicContentSchemaVersion,
  version,
  exportedAt,
  sourceRef,
};

const index = {
  schemaVersion: publicContentSchemaVersion,
  latestVersion: version,
  exportedAt,
  versions: Array.from(versions.values()).sort(sortVersions),
};

await Promise.all([
  writeFile(path.join(target, 'README.md'), releaseReadme),
  writeFile(path.join(releaseRepoDocsRoot, 'content-submission.md'), contentSubmissionGuide),
  writeJson(path.join(docsRoot, 'latest.json'), latest),
  writeJson(path.join(docsRoot, 'versions.json'), index),
  writeFile(path.join(siteRoot, 'README.md'), buildSiteReadme()),
]);

for (const locale of publicContentLocales) {
  const docsLocaleDir = path.join(docsRoot, version, locale);
  const blogLocaleDir = path.join(blogRoot, locale);
  const docsBuilt = built.docs[locale];
  const blogBuilt = built.blog[locale];
  const docsIndexPayload = { ...docsBuilt.collection };
  const blogIndexPayload = { ...blogBuilt.collection };

  delete docsIndexPayload.articles;
  delete blogIndexPayload.articles;

  await Promise.all([
    fs.rm(docsLocaleDir, { recursive: true, force: true }),
    fs.rm(blogLocaleDir, { recursive: true, force: true }),
  ]);

  await Promise.all([
    writeJson(path.join(docsLocaleDir, 'index.json'), docsIndexPayload),
    writeJson(path.join(blogLocaleDir, 'index.json'), blogIndexPayload),
  ]);

  for (const entry of docsBuilt.collection.docs.entries) {
    const articleDir = path.join(docsLocaleDir, entry.slug);
    await Promise.all([
      writeJson(path.join(articleDir, 'article.json'), {
        schemaVersion: publicContentSchemaVersion,
        version,
        locale,
        exportedAt,
        sourceRef,
        article: docsBuilt.collection.articles[entry.slug],
      }),
      writeFile(path.join(articleDir, 'source.mdx'), docsBuilt.sources[entry.slug]),
    ]);
  }

  for (const entry of blogBuilt.collection.blog.entries) {
    const articleDir = path.join(blogLocaleDir, entry.slug);
    await Promise.all([
      writeJson(path.join(articleDir, 'article.json'), {
        schemaVersion: publicContentSchemaVersion,
        locale,
        exportedAt,
        sourceRef,
        article: blogBuilt.collection.articles[entry.slug],
      }),
      writeFile(path.join(articleDir, 'source.mdx'), blogBuilt.sources[entry.slug]),
    ]);
  }
}

console.log(`[public-content] Exported docs version ${version} and blog payloads to ${siteRoot}`);
