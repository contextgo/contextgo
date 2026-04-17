import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { renderToStaticMarkup } from 'react-dom/server';
import remarkGfm from 'remark-gfm';

export const publicContentSchemaVersion = 1;
export const publicContentLocales = ['en', 'zh'];
export const docCategoryIds = ['guides', 'features', 'operations'];

const createPathError = (filePath, message) => new Error(`[public-content] ${message}: ${filePath}`);

const readJsonFile = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
};

const normalizeScalar = (value) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return value;
};

const ensureString = (value, filePath, field) => {
  const normalized = normalizeScalar(value);

  if (typeof normalized !== 'string' || !normalized.trim()) {
    throw createPathError(filePath, `Expected a non-empty string for "${field}"`);
  }

  return normalized.trim();
};

const ensureOptionalString = (value, filePath, field) => {
  if (value == null || value === '') {
    return undefined;
  }

  return ensureString(value, filePath, field);
};

const ensureDocCategory = (value, filePath) => {
  const category = ensureString(value, filePath, 'category');
  if (!docCategoryIds.includes(category)) {
    throw createPathError(filePath, `Unsupported doc category "${category}"`);
  }

  return category;
};

const parseFrontmatterValue = (value) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length < 2) {
    return trimmedValue;
  }

  const quote = trimmedValue[0];
  if ((quote === '"' || quote === "'") && trimmedValue.at(-1) === quote) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
};

const parseFrontmatterDocument = (source) => {
  const normalizedSource = source.replace(/\r\n/g, '\n');
  if (!normalizedSource.startsWith('---\n')) {
    return {
      content: normalizedSource,
      data: {},
    };
  }

  const frontmatterEnd = normalizedSource.indexOf('\n---\n', 4);
  if (frontmatterEnd === -1) {
    return {
      content: normalizedSource,
      data: {},
    };
  }

  const frontmatterBlock = normalizedSource.slice(4, frontmatterEnd);
  const data = {};

  for (const line of frontmatterBlock.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    data[key] = parseFrontmatterValue(line.slice(separatorIndex + 1));
  }

  return {
    content: normalizedSource.slice(frontmatterEnd + '\n---\n'.length),
    data,
  };
};

const toPlainText = (value) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(toPlainText).join('');
  }

  if (React.isValidElement(value)) {
    return toPlainText(value.props.children);
  }

  return '';
};

const slugifyHeadingText = (value) => {
  const normalized = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return normalized || 'section';
};

const createHeadingRenderer = (level) => {
  return ({ children, node: _node, ...props }) => {
    const tagName = `h${level}`;
    const id = slugifyHeadingText(toPlainText(children));
    return React.createElement(tagName, { ...props, id }, children);
  };
};

const markdownComponents = {
  h1: createHeadingRenderer(1),
  h2: createHeadingRenderer(2),
  h3: createHeadingRenderer(3),
  h4: createHeadingRenderer(4),
  h5: createHeadingRenderer(5),
  h6: createHeadingRenderer(6),
};

const buildMarkdownHtml = (source) => {
  return renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        components: markdownComponents,
      },
      source
    )
  );
};

const isMissingOptionalDependencyError = (error) => {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND');
};

let mdxRendererPromise;

const loadMdxRenderer = async () => {
  if (mdxRendererPromise) {
    return mdxRendererPromise;
  }

  mdxRendererPromise = (async () => {
    try {
      const [{ compile, run }, jsxRuntime, rehypeSlugModule] = await Promise.all([
        import('@mdx-js/mdx'),
        import('react/jsx-runtime'),
        import('rehype-slug'),
      ]);

      const rehypeSlug = rehypeSlugModule.default;
      return async (source) => {
        const compiled = await compile(source, {
          outputFormat: 'function-body',
          development: false,
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeSlug],
        });

        const executed = await run(String(compiled), {
          ...jsxRuntime,
          baseUrl: import.meta.url,
        });

        const Content = executed.default;
        return renderToStaticMarkup(React.createElement(Content));
      };
    } catch (error) {
      if (!isMissingOptionalDependencyError(error)) {
        throw error;
      }

      return null;
    }
  })();

  return mdxRendererPromise;
};

const buildArticleHtml = async (source) => {
  const renderMdx = await loadMdxRenderer();
  if (renderMdx) {
    return renderMdx(source);
  }

  return buildMarkdownHtml(source);
};

const buildArticle = async (filePath, slug, requireCategory) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = parseFrontmatterDocument(raw);
  const frontmatter = parsed.data;
  const html = await buildArticleHtml(parsed.content);

  const meta = {
    slug,
    eyebrow: ensureString(frontmatter.eyebrow, filePath, 'eyebrow'),
    title: ensureString(frontmatter.title, filePath, 'title'),
    summary: ensureString(frontmatter.summary, filePath, 'summary'),
    readingTime: ensureString(frontmatter.readingTime, filePath, 'readingTime'),
    updatedAt: ensureOptionalString(frontmatter.updatedAt, filePath, 'updatedAt'),
    publishedAt: ensureOptionalString(frontmatter.publishedAt, filePath, 'publishedAt'),
    category: requireCategory ? ensureDocCategory(frontmatter.category, filePath) : undefined,
  };

  if (requireCategory && !meta.updatedAt) {
    throw createPathError(filePath, 'Docs articles require "updatedAt"');
  }

  if (!requireCategory && !meta.publishedAt) {
    throw createPathError(filePath, 'Blog articles require "publishedAt"');
  }

  return {
    meta,
    article: {
      ...meta,
      html,
    },
    source: raw,
  };
};

const buildDocsLocaleCollection = async (options, locale) => {
  const localeDir = path.join(options.contentRoot, 'docs', locale);
  const section = await readJsonFile(path.join(localeDir, 'index.json'));
  const entries = [];
  const articles = {};
  const sources = {};

  for (const slug of section.order) {
    const filePath = path.join(localeDir, `${slug}.mdx`);
    const { meta, article, source } = await buildArticle(filePath, slug, true);
    entries.push(meta);
    articles[slug] = article;
    sources[slug] = source;
  }

  return {
    collection: {
      schemaVersion: publicContentSchemaVersion,
      version: options.docsVersion,
      locale,
      exportedAt: options.exportedAt,
      sourceRef: options.sourceRef,
      docs: {
        badge: section.badge,
        title: section.title,
        description: section.description,
        featuredLabel: section.featuredLabel,
        featuredDescription: section.featuredDescription,
        categories: section.categories,
        entries,
      },
      articles,
    },
    sources,
  };
};

const buildBlogLocaleCollection = async (options, locale) => {
  const localeDir = path.join(options.contentRoot, 'blog', locale);
  const section = await readJsonFile(path.join(localeDir, 'index.json'));
  const entries = [];
  const articles = {};
  const sources = {};

  for (const slug of section.order) {
    const filePath = path.join(localeDir, `${slug}.mdx`);
    const { meta, article, source } = await buildArticle(filePath, slug, false);
    entries.push(meta);
    articles[slug] = article;
    sources[slug] = source;
  }

  return {
    collection: {
      schemaVersion: publicContentSchemaVersion,
      locale,
      exportedAt: options.exportedAt,
      sourceRef: options.sourceRef,
      blog: {
        badge: section.badge,
        title: section.title,
        description: section.description,
        featuredLabel: section.featuredLabel,
        featuredDescription: section.featuredDescription,
        entries,
      },
      articles,
    },
    sources,
  };
};

export const buildPublicContentCollections = async (options) => {
  const docsEntries = await Promise.all(
    publicContentLocales.map(async (locale) => [locale, await buildDocsLocaleCollection(options, locale)])
  );
  const blogEntries = await Promise.all(
    publicContentLocales.map(async (locale) => [locale, await buildBlogLocaleCollection(options, locale)])
  );

  return {
    docs: Object.fromEntries(docsEntries),
    blog: Object.fromEntries(blogEntries),
  };
};

export const writeFile = async (filePath, value) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, 'utf8');
};

export const writeJson = async (filePath, value) => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

export const serializeTsExport = (exportName, data, typeImportPath, typeName) => {
  return `import type { ${typeName} } from '${typeImportPath}';\n\nexport const ${exportName}: ${typeName} = ${JSON.stringify(data, null, 2)};\n`;
};
