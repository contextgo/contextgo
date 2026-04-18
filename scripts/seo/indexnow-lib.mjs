import fs from 'node:fs/promises';
import path from 'node:path';

const SITE_BASE_URL = 'https://contextgo.io';
const DOCS_BASE_URL = 'https://docs.contextgo.io';
const LOCALES = ['en', 'zh'];
const INTENT_PAGE_SLUGS = [
  'ai-workbench',
  'multi-agent-collaboration-workspace',
  'remote-ai-workspace',
  'context-engine-for-teams',
  'connector-based-knowledge-ops',
  'release-operations-workspace',
];

export const INDEXNOW_KEYS = {
  site: {
    key: '9d9d846db93d42368a98f5ab7f327c01',
    keyLocation: `${SITE_BASE_URL}/9d9d846db93d42368a98f5ab7f327c01.txt`,
  },
  docs: {
    key: '9d9d846db93d42368a98f5ab7f327c01',
    keyLocation: `${DOCS_BASE_URL}/9d9d846db93d42368a98f5ab7f327c01.txt`,
  },
};

const normalizePath = (value) => {
  if (!value || value === '/') {
    return '';
  }

  return `/${value}`.replace(/\/+/g, '/').replace(/\/$/g, '');
};

const localizePath = (locale, pathname = '') => `/${locale}${normalizePath(pathname)}`;

const unique = (items) => [...new Set(items)];

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

export function buildSiteCoreIndexNowUrls() {
  const staticPaths = ['', '/connect', '/download', '/solutions', '/blog', '/changelog', '/docs'];

  const localizedUrls = LOCALES.flatMap((locale) =>
    staticPaths.map((pathname) => `${SITE_BASE_URL}${localizePath(locale, pathname)}`)
  );

  const solutionUrls = LOCALES.flatMap((locale) =>
    INTENT_PAGE_SLUGS.map((slug) => `${SITE_BASE_URL}${localizePath(locale, `/solutions/${slug}`)}`)
  );

  return unique([...localizedUrls, ...solutionUrls]);
}

export async function buildBlogIndexNowUrls({ contentRoot }) {
  const urls = [];

  for (const locale of LOCALES) {
    const indexPath = path.join(contentRoot, 'blog', locale, 'index.json');
    const indexData = await readJson(indexPath);
    const order = Array.isArray(indexData.order)
      ? indexData.order
      : Array.isArray(indexData.entries)
        ? indexData.entries.map((entry) => entry.slug).filter(Boolean)
        : [];

    urls.push(`${SITE_BASE_URL}/${locale}/blog`);

    for (const slug of order) {
      urls.push(`${SITE_BASE_URL}/${locale}/blog/${slug}`);
    }
  }

  return unique(urls);
}

async function collectDocsContentFiles(siteRoot, currentDir = siteRoot, collector = []) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await collectDocsContentFiles(siteRoot, fullPath, collector);
      continue;
    }

    if (entry.isFile() && /\.(md|mdx)$/u.test(entry.name)) {
      collector.push(fullPath);
    }
  }

  return collector;
}

const docsFileToUrl = (siteRoot, filePath) => {
  const relativePath = path.relative(siteRoot, filePath).replace(/\.(md|mdx)$/u, '');
  const normalized = relativePath.split(path.sep).join('/');

  if (normalized === 'index') {
    return DOCS_BASE_URL;
  }

  if (normalized.endsWith('/index')) {
    return `${DOCS_BASE_URL}/${normalized.slice(0, -'/index'.length)}`;
  }

  return `${DOCS_BASE_URL}/${normalized}`;
};

export async function buildDocsIndexNowUrls({ siteRoot }) {
  const files = await collectDocsContentFiles(siteRoot);
  return unique(files.map((filePath) => docsFileToUrl(siteRoot, filePath)));
}

export const buildIndexNowPayload = ({ host, key, keyLocation, urls }) => ({
  host,
  key,
  keyLocation,
  urlList: unique(urls),
});

export async function submitIndexNow({ host, key, keyLocation, urls, endpoint = 'https://api.indexnow.org/indexnow' }) {
  const payload = buildIndexNowPayload({ host, key, keyLocation, urls });

  if (payload.urlList.length === 0) {
    return { submitted: 0 };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`IndexNow request failed: ${response.status} ${response.statusText} ${message}`.trim());
  }

  return { submitted: payload.urlList.length };
}
