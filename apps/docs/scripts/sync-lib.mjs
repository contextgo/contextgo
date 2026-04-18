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

export const DOCS_SITE_NAME = 'ContextGo Docs';
export const DOCS_SITE_URL = 'https://docs.contextgo.io';
export const DOCS_OG_IMAGE_URL = `${DOCS_SITE_URL}/demo.png`;

const localizedGroupLabels = {
  zh: {
    'Start Here': '开始',
    Foundations: '产品基础',
    'Get Started': '起步路径',
    'Use Cases': '使用场景',
    'Core Workflows': '核心工作流',
    'Team And Delivery': '团队与交付',
    Workbench: '工作台',
    Context: '上下文',
    'Modeling And Governance': '建模与治理',
    'Agents & Capabilities': 'Agents 与能力',
    'System And Packages': '系统与包',
    'Runtime And Tooling': '运行时与工具',
    Automation: '自动化',
    Publish: '发布',
    'Channel Model': '渠道模型',
    Operations: '发布运营',
    Collaboration: '协作',
    'Collaboration Patterns': '协作模式',
    'Remote & Devices': '远程与设备',
    'Host Model': '主机模型',
    'Client Surfaces': '客户端界面',
    'Data Flow': '数据流',
    Manage: '管理',
    'Account And Setup': '账号与设置',
    'Security And Support': '安全与支持',
  },
};

const localizedPageTitles = {
  zh: {
    'agents/agent-packages': 'Agent 包',
    'agents/agent-system-overview': 'Agent 系统总览',
    'agents/browser-tools-and-runtime-actions': '浏览器、工具与运行时动作',
    'agents/built-in-assistants': '内置助手',
    'agents/hooks-commands-schedules': 'Hooks、Commands 与 Schedules',
    'agents/index': 'Agents 与能力',
    'agents/installed-signed-in-ready': '已安装、已登录、已就绪',
    'agents/runtime-center': '运行时中心',
    'agents/skill-market': '技能市场',
    'collaboration/agent-teams': 'Agent 团队',
    'collaboration/collaboration-overview': '协作总览',
    'collaboration/group-workflows': '群组工作流',
    'collaboration/harness-style-workflows': 'Harness 风格工作流',
    'collaboration/index': '协作',
    'collaboration/multi-agent-collaboration': '多 Agent 协作',
    'context/context-connector': '上下文连接器',
    'context/context-engine': '上下文引擎',
    'context/context-governance': '上下文治理',
    'context/context-system-overview': '上下文系统总览',
    'context/index': '上下文',
    'context/memory-profile-context-pack': '记忆、画像与 Context Pack',
    'context/session-project-space': 'Session、Project 与 Space',
    'manage/account-and-devices': '账号与设备',
    'manage/faq': '常见问题',
    'manage/index': '管理',
    'manage/security-and-permissions': '安全与权限',
    'manage/settings-guide': '设置指南',
    'manage/troubleshooting': '故障排查',
    'manage/updates': '更新',
    'publish/audiences-threads-groups': 'Audiences、Threads 与 Groups',
    'publish/channel-accounts-and-instances': '渠道账号与实例',
    'publish/channels': '渠道',
    'publish/index': '发布',
    'publish/managing-published-agents': '管理已发布 Agent',
    'publish/publish-one-agent-to-many-places': '把一个 Agent 发布到多个入口',
    'publish/publish-overview': '发布总览',
    'remote/desktop-host': '桌面主机',
    'remote/index': '远程与设备',
    'remote/linux-host-and-cli': 'Linux 主机与 CLI',
    'remote/mobile-shells': '移动端壳层',
    'remote/remote-access-overview': '远程访问总览',
    'remote/same-experience-across-devices': '跨设备一致体验',
    'remote/uploads-files-and-host-processing': '上传、文件与主机处理',
    'remote/web-client': '网页客户端',
    'start-here/choose-your-setup': '选择你的起步方式',
    'start-here/index': '开始',
    'start-here/product-map': '产品地图',
    'start-here/quick-start': '快速开始',
    'start-here/what-is-contextgo': '什么是 ContextGo',
    'use-cases/bring-your-workflow-into-contextgo': '把你的工作流带进 ContextGo',
    'use-cases/coding-and-builder-workflow': '编码与构建者工作流',
    'use-cases/content-and-writing-studio': '内容与写作工作台',
    'use-cases/index': '使用场景',
    'use-cases/operations-and-automation-workflow': '运营与自动化工作流',
    'use-cases/personal-remote-workbench': '个人远程工作台',
    'use-cases/publish-to-channel-workflow': '发布到渠道工作流',
    'use-cases/recommended-starter-modes': '推荐起步模式',
    'use-cases/research-and-browser-workflow': '研究与浏览器工作流',
    'use-cases/team-and-collaboration-workflow': '团队与协作工作流',
    'workbench/ai-native-workbench-overview': 'AI Native 工作台总览',
    'workbench/conversation-cowork-workbench': '对话协作工作台',
    'workbench/index': '工作台',
  },
};

export const staticConfig = {
  $schema: 'https://mintlify.com/docs.json',
  theme: 'mint',
  name: DOCS_SITE_NAME,
  description:
    'ContextGo product docs for setup, remote access, context systems, runtimes, connectors, publishing, and release operations.',
  appearance: {
    default: 'light',
  },
  seo: {
    indexing: 'all',
    metatags: {
      robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
      googlebot: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
      'og:site_name': DOCS_SITE_NAME,
      'og:type': 'website',
      'og:image': DOCS_OG_IMAGE_URL,
      'og:image:alt': `${DOCS_SITE_NAME} preview`,
      'twitter:card': 'summary_large_image',
      'twitter:image': DOCS_OG_IMAGE_URL,
    },
  },
  colors: {
    primary: '#111111',
    light: '#111111',
    dark: '#F5F7FB',
  },
  fonts: {
    heading: {
      family: 'Inter',
      weight: 600,
    },
    body: {
      family: 'Inter',
      weight: 400,
    },
  },
  styling: {
    eyebrows: 'breadcrumbs',
  },
  favicon: '/contextgo-favicon.ico',
  logo: {
    light: '/logo/light.png',
    dark: '/logo/dark.png',
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
      label: 'Open ContextGo',
      href: 'https://contextgo.io',
    },
  },
  footer: {
    socials: {
      github: 'https://github.com/contextgo/contextgo-releases',
    },
  },
};

export function normalizeNewlines(value) {
  return value.replace(/\r\n?/g, '\n');
}

export function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(value);
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

export function cleanFrontmatter(frontmatter, locale, pageId) {
  if (!frontmatter) return '';

  const filtered = frontmatter
    .split('\n')
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [line];
      if (/^(id|slug|hide_table_of_contents):/.test(trimmed)) return [];

      if (trimmed.startsWith('title:')) {
        const title = getLocalizedPageTitle(pageId, locale) ?? trimmed.slice(6).trim();
        return [`title: ${title}`];
      }

      if (trimmed.startsWith('description:')) {
        const description = trimmed.slice(12).trim();

        if (locale.language === 'zh' && !hasCjk(description)) {
          return [];
        }
      }

      return [line];
    })
    .join('\n')
    .trim();

  return filtered ? `---\n${filtered}\n---\n\n` : '';
}

export function extractTitle(frontmatter) {
  const match = frontmatter.match(/(?:^|\n)title:\s*(.+)\s*(?:\n|$)/);
  return match ? match[1].trim() : '';
}

export function getLocalizedPageTitle(pageId, locale) {
  return localizedPageTitles[locale.language]?.[pageId];
}

export function getLocalizedGroupLabel(label, locale) {
  return localizedGroupLabels[locale.language]?.[label] ?? label;
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
      const heading = title.trim() ? `${formatAdmonitionLabel(kind)}: ${title.trim()}` : formatAdmonitionLabel(kind);
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

export function stripLeadingTitleHeading(body, title) {
  if (!title) {
    return body;
  }

  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return body.replace(new RegExp(`^#\\s+${escapedTitle}\\s*\\n+`, 'i'), '');
}

export function transformMarkdown(raw, locale, pageId) {
  const { frontmatter, body } = splitFrontmatter(raw);
  const title = extractTitle(frontmatter);
  const cleanedFrontmatter = cleanFrontmatter(frontmatter, locale, pageId);
  const cleanedBody = rewriteLocaleAbsoluteLinks(
    stripLeadingTitleHeading(convertAdmonitionBlocks(body.trim()), title),
    locale
  );

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

    groups.push(buildNavigationGroup(item, locale));
  }

  return groups;
}

export function buildNavigationGroup(item, locale) {
  const pages = [];

  if (item.link?.type === 'doc' && item.link.id) {
    pages.push(prefixPageId(item.link.id, locale));
  }

  for (const child of item.items ?? []) {
    if (typeof child === 'string') {
      pages.push(prefixPageId(child, locale));
      continue;
    }

    if (child?.type === 'category') {
      pages.push(buildNavigationGroup(child, locale));
    }
  }

  return {
    group: getLocalizedGroupLabel(item.label, locale),
    pages,
  };
}

export function buildShellHome(locale) {
  if (locale.language === 'en') {
    return `---
title: ContextGo Documentation
description: The ContextGo product documentation system, focused on setup, remote use, context, and publication.
hide_table_of_contents: true
---

<div className="docs-home-shell">
  <div className="docs-home-hero">
    <div className="docs-home-copy">
      <p className="docs-home-kicker">Product Docs</p>
      <p className="docs-home-lead">
        This documentation explains how ContextGo fits together before you scale it into a bigger system.
      </p>
    </div>
    <img src="/demo.png" alt="ContextGo Workbench" />
  </div>

  <a className="docs-brand-callout" href="https://contextgo.io">
    <img src="/brand/main-site-banner.png" alt="ContextGo main site brand banner" />
  </a>

  <div className="docs-home-grid">
    <a className="docs-home-card" href="${locale.urlPrefix}/start-here">
      <span className="docs-home-card-label">Start Here</span>
      <strong>Build the right product model first</strong>
      <p>Understand desktop host, context, remote access, and publication boundaries.</p>
    </a>
    <a className="docs-home-card" href="${locale.urlPrefix}/start-here/quick-start">
      <span className="docs-home-card-label">Quick Start</span>
      <strong>Run one real workflow end to end</strong>
      <p>Prepare one host, one runtime, one context, and complete one useful task loop.</p>
    </a>
    <a className="docs-home-card" href="${locale.urlPrefix}/use-cases">
      <span className="docs-home-card-label">Use Cases</span>
      <strong>Choose an entry that matches real work</strong>
      <p>Open the product through coding, research, writing, operations, or publishing workflows.</p>
    </a>
    <a className="docs-home-card" href="${locale.urlPrefix}/remote">
      <span className="docs-home-card-label">Remote & Devices</span>
      <strong>See how web and mobile fit around the host</strong>
      <p>Keep the desktop as execution authority while web and mobile stay remote control surfaces.</p>
    </a>
  </div>

  <div className="docs-home-notes">
    <div>
      <span>Use this docs site to:</span>
      <ul>
        <li>understand the real product model before scaling usage</li>
        <li>get one desktop host and one real workflow running first</li>
        <li>understand how context, remote access, and publication fit together</li>
      </ul>
    </div>
  </div>
</div>
`;
  }

  return `---
title: ContextGo Documentation
description: ContextGo 产品文档系统，聚焦安装、远程访问、上下文、能力装配和发布链路。
hide_table_of_contents: true
---

<div className="docs-home-shell">
  <div className="docs-home-hero">
    <div className="docs-home-copy">
      <p className="docs-home-kicker">Product Docs</p>
      <p className="docs-home-lead">
        这套文档先帮你把 ContextGo 的产品模型理解对，再去扩展桌面、远程、多端和发布链路。
      </p>
    </div>
    <img src="/demo.png" alt="ContextGo Workbench" />
  </div>

  <a className="docs-brand-callout" href="https://contextgo.io">
    <img src="/brand/main-site-banner.png" alt="ContextGo 主站品牌横幅" />
  </a>

  <div className="docs-home-grid">
    <a className="docs-home-card" href="${locale.urlPrefix}/start-here">
      <span className="docs-home-card-label">Start Here</span>
      <strong>先建立正确的产品心智</strong>
      <p>先理解桌面主机、上下文、远程访问和发布渠道之间的边界。</p>
    </a>
    <a className="docs-home-card" href="${locale.urlPrefix}/start-here/quick-start">
      <span className="docs-home-card-label">Quick Start</span>
      <strong>先跑通一条真实任务闭环</strong>
      <p>准备一台主机、一个 runtime、一份上下文，然后完成一条真正有用的任务。</p>
    </a>
    <a className="docs-home-card" href="${locale.urlPrefix}/use-cases">
      <span className="docs-home-card-label">Use Cases</span>
      <strong>按真实工作场景选择入口</strong>
      <p>从编码、研究、写作、运营或发布链路里，选一个最贴近你当前工作的入口。</p>
    </a>
    <a className="docs-home-card" href="${locale.urlPrefix}/remote">
      <span className="docs-home-card-label">Remote & Devices</span>
      <strong>理解网页和手机如何围绕主机工作</strong>
      <p>保持桌面端作为执行权威，让网页和手机承担远程查看、继续和控制的角色。</p>
    </a>
  </div>

  <div className="docs-home-notes">
    <div>
      <span>这套文档重点解决三件事：</span>
      <ul>
        <li>先把产品模型理解对，而不是把它当成普通聊天工具</li>
        <li>先跑通一台桌面主机和一条真实任务，再逐步扩展</li>
        <li>搞清楚上下文、远程访问、发布渠道和多端之间的边界</li>
      </ul>
    </div>
  </div>
</div>
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
            href: 'https://github.com/contextgo/contextgo-releases',
            icon: 'github',
          },
        ],
      },
    },
  };
}

function pageIdToLocalizedDocsPath(pageId, locale) {
  if (pageId === 'index') {
    return locale.urlPrefix ? `${locale.urlPrefix}/` : '/';
  }

  const normalizedPageId = normalizePageId(pageId).replace(/\/index$/u, '');
  const localized = `${locale.urlPrefix}/${normalizedPageId}/`.replace(/\/+/gu, '/');

  return localized.startsWith('/') ? localized : `/${localized}`;
}

function toDocsAbsoluteUrl(pathname) {
  if (pathname === '/') {
    return `${DOCS_SITE_URL}/`;
  }

  return `${DOCS_SITE_URL}${pathname}`;
}

function escapeXml(value) {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/'/gu, '&apos;');
}

export function buildDocsRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${DOCS_SITE_URL}/sitemap.xml
Host: ${DOCS_SITE_URL}
`;
}

export function buildDocsSitemapXml(pageIds) {
  const normalizedPageIds = dedupe(pageIds.map((pageId) => normalizePageId(pageId)));
  const urlEntries = normalizedPageIds.flatMap((pageId) =>
    locales.map((locale) => {
      const pathname = pageIdToLocalizedDocsPath(pageId, locale);
      const alternateLinks = [
        ...locales.map((alternateLocale) => ({
          hreflang: alternateLocale.language,
          href: toDocsAbsoluteUrl(pageIdToLocalizedDocsPath(pageId, alternateLocale)),
        })),
        {
          hreflang: 'x-default',
          href: toDocsAbsoluteUrl(
            pageIdToLocalizedDocsPath(pageId, locales.find((item) => item.isDefault) ?? locales[0])
          ),
        },
      ];

      return {
        loc: toDocsAbsoluteUrl(pathname),
        alternateLinks,
      };
    })
  );

  const xmlBody = urlEntries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
${entry.alternateLinks
  .map(
    (link) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(link.hreflang)}" href="${escapeXml(link.href)}" />`
  )
  .join('\n')}
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${xmlBody}
</urlset>
`;
}
