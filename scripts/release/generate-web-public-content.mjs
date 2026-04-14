import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPublicContentCollections,
  serializeTsExport,
  writeFile,
} from '../../apps/web/src/content-tools/build.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const webRoot = path.join(repoRoot, 'apps/web');
const generatedRoot = path.join(webRoot, 'src/lib/public-content/generated');

const built = await buildPublicContentCollections({
  contentRoot: path.join(webRoot, 'src/content'),
  docsVersion: 'draft',
  exportedAt: new Date(0).toISOString(),
});

await Promise.all([
  writeFile(
    path.join(generatedRoot, 'docs.ts'),
    serializeTsExport(
      'draftDocsCollections',
      Object.fromEntries(Object.entries(built.docs).map(([locale, value]) => [locale, value.collection])),
      '../types',
      'DocsCollectionMap'
    )
  ),
  writeFile(
    path.join(generatedRoot, 'blog.ts'),
    serializeTsExport(
      'draftBlogCollections',
      Object.fromEntries(Object.entries(built.blog).map(([locale, value]) => [locale, value.collection])),
      '../types',
      'BlogCollectionMap'
    )
  ),
]);

console.log(`[public-content] Generated fallback modules in ${generatedRoot}`);
