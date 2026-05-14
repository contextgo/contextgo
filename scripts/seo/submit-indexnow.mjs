#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBlogIndexNowUrls,
  buildDocsIndexNowUrls,
  buildSiteCoreIndexNowUrls,
  INDEXNOW_KEYS,
  submitIndexNow,
} from './indexnow-lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const parseArgs = (argv) => {
  const values = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const [rawKey, rawValue] = token.slice(2).split('=');
    const key = rawKey;
    const value = rawValue ?? argv[index + 1];

    if (rawValue === undefined && argv[index + 1] && !argv[index + 1].startsWith('--')) {
      index += 1;
    }

    values.set(key, value ?? 'true');
  }

  return values;
};

const args = parseArgs(process.argv.slice(2));
const target = args.get('target') ?? 'site';

const buildTargetUrls = async () => {
  if (target === 'site') {
    const contentRoot = path.resolve(repoRoot, args.get('content-root') ?? 'apps/web/src/content');
    const [coreUrls, blogUrls] = await Promise.all([
      Promise.resolve(buildSiteCoreIndexNowUrls()),
      buildBlogIndexNowUrls({ contentRoot }),
    ]);

    return {
      host: 'contextgo.io',
      key: INDEXNOW_KEYS.site.key,
      keyLocation: INDEXNOW_KEYS.site.keyLocation,
      urls: [...coreUrls, ...blogUrls],
    };
  }

  if (target === 'docs') {
    const siteRoot = path.resolve(repoRoot, args.get('site-root') ?? 'apps/docs/site');
    const urls = await buildDocsIndexNowUrls({ siteRoot });

    return {
      host: 'docs.contextgo.io',
      key: INDEXNOW_KEYS.docs.key,
      keyLocation: INDEXNOW_KEYS.docs.keyLocation,
      urls,
    };
  }

  if (target === 'blog') {
    const contentRoot = path.resolve(repoRoot, args.get('content-root') ?? 'apps/web/src/content');
    const urls = await buildBlogIndexNowUrls({ contentRoot });

    return {
      host: 'contextgo.io',
      key: INDEXNOW_KEYS.site.key,
      keyLocation: INDEXNOW_KEYS.site.keyLocation,
      urls,
    };
  }

  throw new Error(`Unsupported target: ${target}`);
};

async function main() {
  const payload = await buildTargetUrls();
  const result = await submitIndexNow(payload);

  process.stdout.write(
    `Submitted ${result.submitted} URL(s) to IndexNow for ${payload.host} using target "${target}".\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
