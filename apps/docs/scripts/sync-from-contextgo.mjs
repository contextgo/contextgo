import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDocsConfig, buildNavigation, buildShellHome, dedupe, locales, transformMarkdown } from './sync-lib.mjs';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsRoot = path.resolve(__dirname, '..');
const targetRoot = path.join(docsRoot, 'site');
const sourceDocsRoot = path.join(docsRoot, 'docs');
const sourceEnglishDocsRoot = path.join(docsRoot, 'i18n/en/docs');
const navigationConfigPath = path.join(docsRoot, 'navigation.js');

const preservedRootEntries = new Set(['favicon.svg', 'logo', 'style.css']);

const localeConfigs = locales.map((locale) => ({
  ...locale,
  sourceRoot: locale.language === 'en' ? sourceEnglishDocsRoot : sourceDocsRoot,
  fallbackRoot: sourceDocsRoot,
}));

function resolveSourcePath(pageId, locale) {
  const roots = dedupe([locale.sourceRoot, locale.fallbackRoot]);

  for (const root of roots) {
    const mdPath = path.join(root, `${pageId}.md`);
    const mdxPath = path.join(root, `${pageId}.mdx`);

    if (existsSync(mdPath)) return mdPath;
    if (existsSync(mdxPath)) return mdxPath;
  }

  throw new Error(`Unable to find source doc for "${pageId}" in locale "${locale.language}"`);
}

function pageIdToTargetPath(pageId, locale) {
  const localeRoot = locale.targetDir ? path.join(targetRoot, locale.targetDir) : targetRoot;

  if (pageId === 'index') {
    return path.join(localeRoot, 'index.mdx');
  }

  return path.join(localeRoot, `${pageId}.mdx`);
}

async function ensureParentDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function clearGeneratedContent() {
  const entries = await readdir(targetRoot);

  await Promise.all(
    entries.map(async (entry) => {
      if (preservedRootEntries.has(entry)) return;

      const entryPath = path.join(targetRoot, entry);
      await rm(entryPath, { recursive: true, force: true });
    })
  );
}

async function writeMappedPage(pageId, locale) {
  const targetPath = pageIdToTargetPath(pageId, locale);
  await ensureParentDir(targetPath);

  if (pageId === 'index') {
    await writeFile(targetPath, buildShellHome(locale), 'utf8');
    return;
  }

  const sourcePath = resolveSourcePath(pageId, locale);
  const raw = await readFile(sourcePath, 'utf8');
  const transformed = transformMarkdown(raw, locale);
  await writeFile(targetPath, transformed, 'utf8');
}

async function main() {
  await mkdir(targetRoot, { recursive: true });

  const navigation = require(navigationConfigPath);
  const defaultLocale = localeConfigs.find((locale) => locale.isDefault) ?? localeConfigs[0];
  const pageIds = dedupe([
    'index',
    ...buildNavigation(navigation.docs ?? [], defaultLocale).flatMap((group) =>
      group.pages.map((pageId) =>
        defaultLocale.targetDir ? pageId.slice(defaultLocale.targetDir.length + 1) : pageId
      )
    ),
  ]);

  await clearGeneratedContent();

  for (const locale of localeConfigs) {
    for (const pageId of pageIds) {
      await writeMappedPage(pageId, locale);
    }
  }

  const docsJson = buildDocsConfig(navigation.docs ?? []);
  await writeFile(path.join(targetRoot, 'docs.json'), `${JSON.stringify(docsJson, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `Synced ${pageIds.length * localeConfigs.length} pages from ContextGo docs across ${localeConfigs.length} locales.\n`
  );
}

await main();
