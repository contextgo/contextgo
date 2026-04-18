export const locales = [
  {
    language: 'zh',
    isDefault: true,
    targetDir: '',
    urlPrefix: '',
  },
  {
    language: 'en',
    isDefault: false,
    targetDir: 'en',
    urlPrefix: '/en',
  },
];

export const staticConfig = {
  $schema: 'https://mintlify.com/docs.json',
  theme: 'mint',
  name: 'ContextGo Docs',
  appearance: {
    default: 'dark',
  },
  colors: {
    primary: '#FF6B3D',
    light: '#FF9A7D',
    dark: '#E2552A',
  },
  fonts: {
    heading: {
      family: 'DM Sans',
      weight: 700,
    },
    body: {
      family: 'Inter',
      weight: 400,
    },
  },
  styling: {
    eyebrows: 'breadcrumbs',
  },
  favicon: '/favicon.svg',
  logo: {
    light: '/logo/light.svg',
    dark: '/logo/dark.svg',
  },
  navbar: {
    links: [
      {
        label: 'Docs',
        href: '/',
      },
    ],
    primary: {
      type: 'button',
      label: 'Releases',
      href: 'https://github.com/contextgo/contextgo-releases/releases',
    },
  },
  footer: {
    socials: {
      github: 'https://github.com/contextgo/contextgo',
    },
  },
};

export function normalizeNewlines(value) {
  return value.replace(/\r\n?/g, '\n');
}

export function splitFrontmatter(raw) {
  const normalized = normalizeNewlines(raw);

  if (!normalized.startsWith('---\n')) {
    return { frontmatter: '', body: normalized };
  }

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontmatter: '', body: normalized };
  }

  return {
    frontmatter: normalized.slice(4, end),
    body: normalized.slice(end + 5),
  };
}

export function cleanFrontmatter(frontmatter) {
  if (!frontmatter) return '';

  const filtered = frontmatter
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !/^(id|slug|hide_table_of_contents):/.test(trimmed);
    })
    .join('\n')
    .trim();

  return filtered ? `---\n${filtered}\n---\n\n` : '';
}

export function dedupe(list) {
  return [...new Set(list)];
}

export function normalizePageId(pageId) {
  return pageId.replace(/\\/g, '/');
}

export function formatAdmonitionLabel(kind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function convertAdmonitionBlocks(body) {
  return body.replace(
    /:{3,4}(warning|info|tip|note|danger|caution)\s*([^\n]*)\n([\s\S]*?)\n:{3,4}/g,
    (_match, kind, title, content) => {
      const heading = title.trim()
        ? `${formatAdmonitionLabel(kind)}: ${title.trim()}`
        : formatAdmonitionLabel(kind);
      const lines = content
        .trim()
        .split('\n')
        .map((line) => (line.trim() ? `> ${line}` : '>'))
        .join('\n');

      return `> ${heading}\n>\n${lines}`;
    }
  );
}

export function rewriteLocaleAbsoluteLinks(body, locale) {
  if (!locale.urlPrefix) {
    return body;
  }

  return body
    .replace(/(\]\()\/(?!\/)/g, `$1${locale.urlPrefix}/`)
    .replace(/(href=["'])\/(?!\/)/g, `$1${locale.urlPrefix}/`);
}

export function transformMarkdown(raw, locale) {
  const { frontmatter, body } = splitFrontmatter(raw);
  const cleanedFrontmatter = cleanFrontmatter(frontmatter);
  const cleanedBody = rewriteLocaleAbsoluteLinks(convertAdmonitionBlocks(body.trim()), locale);

  return `${cleanedFrontmatter}${cleanedBody}\n`;
}

export function prefixPageId(pageId, locale) {
  const normalized = normalizePageId(pageId);
  return locale.targetDir ? `${locale.targetDir}/${normalized}` : normalized;
}

export function buildNavigation(sidebarItems, locale) {
  const groups = [];

  for (const item of sidebarItems) {
    if (typeof item === 'string' || item.type !== 'category') {
      continue;
    }

    const pages = [];

    if (item.link?.type === 'doc' && item.link.id) {
      pages.push(prefixPageId(item.link.id, locale));
    }

    for (const child of item.items ?? []) {
      if (typeof child === 'string') {
        pages.push(prefixPageId(child, locale));
      }
    }

    groups.push({
      group: item.label,
      pages: dedupe(pages),
    });
  }

  return groups;
}

export function buildShellHome(locale) {
  if (locale.language === 'en') {
    return `---
title: ContextGo Documentation
description: Product-first documentation for ContextGo, organized as a docs shell instead of a marketing landing page.
---

# ContextGo Documentation

This site opens directly into the product documentation shell.

Start here:

1. [Start Here](${locale.urlPrefix}/start-here)
2. [Use Cases](${locale.urlPrefix}/use-cases)
3. [Context](${locale.urlPrefix}/context)
4. [Agents & Capabilities](${locale.urlPrefix}/agents)
`;
  }

  return `---
title: ContextGo Documentation
description: ContextGo 产品文档入口，直接进入文档目录结构，而不是营销落地页。
---

# ContextGo Documentation

这里直接进入 ContextGo 的文档目录结构。

建议从这里开始：

1. [Start Here](${locale.urlPrefix}/start-here)
2. [Use Cases](${locale.urlPrefix}/use-cases)
3. [Context](${locale.urlPrefix}/context)
4. [Agents & Capabilities](${locale.urlPrefix}/agents)
`;
}

export function buildDocsConfig(sidebarItems) {
  return {
    ...staticConfig,
    navigation: {
      languages: locales.map((locale) => ({
        language: locale.language,
        ...(locale.isDefault ? { default: true } : {}),
        groups: buildNavigation(sidebarItems, locale),
      })),
      global: {
        anchors: [
          {
            anchor: 'Main Site',
            href: 'https://contextgo.io',
            icon: 'globe',
          },
          {
            anchor: 'GitHub',
            href: 'https://github.com/contextgo/contextgo',
            icon: 'github',
          },
        ],
      },
    },
  };
}
