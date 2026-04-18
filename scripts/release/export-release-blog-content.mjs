import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBlogContentCollections,
  publicContentLocales,
  publicContentSchemaVersion,
  writeFile,
  writeJson,
} from '../../apps/web/src/content-tools/build.mjs';

const DEFAULT_TARGET_DIR = path.resolve(process.cwd(), '../contextgo-releases');
const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, '../..');

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
    sourceRef: parsed.sourceRef,
  };
};

export const exportReleaseBlogContent = async (options = {}) => {
  const exportedAt = options.exportedAt || new Date().toISOString();
  const target = options.target || DEFAULT_TARGET_DIR;
  const contentRoot = options.contentRoot || path.join(repoRoot, 'apps/web/src/content');
  const siteRoot = path.join(target, 'site');
  const blogRoot = path.join(siteRoot, 'blog');
  const built = await buildBlogContentCollections({
    contentRoot,
    exportedAt,
    sourceRef: options.sourceRef,
  });

  for (const locale of publicContentLocales) {
    const blogLocaleDir = path.join(blogRoot, locale);
    const blogBuilt = built[locale];
    const blogIndexPayload = { ...blogBuilt.collection };

    delete blogIndexPayload.articles;

    await fs.rm(blogLocaleDir, { recursive: true, force: true });
    await writeJson(path.join(blogLocaleDir, 'index.json'), blogIndexPayload);

    for (const entry of blogBuilt.collection.blog.entries) {
      const articleDir = path.join(blogLocaleDir, entry.slug);
      await Promise.all([
        writeJson(path.join(articleDir, 'article.json'), {
          schemaVersion: publicContentSchemaVersion,
          locale,
          exportedAt,
          sourceRef: options.sourceRef,
          article: blogBuilt.collection.articles[entry.slug],
        }),
        writeFile(path.join(articleDir, 'source.mdx'), blogBuilt.sources[entry.slug]),
      ]);
    }
  }

  return { siteRoot, blogRoot, exportedAt };
};

const runCli = async () => {
  const { target, sourceRef } = parseArgs();
  const exported = await exportReleaseBlogContent({
    target,
    sourceRef,
  });

  console.log(`[public-content] Exported blog payloads to ${exported.blogRoot}`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await runCli();
}
