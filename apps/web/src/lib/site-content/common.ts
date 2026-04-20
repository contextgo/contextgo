import type { ChangelogSection, ResourcesSection, SiteLabels, SiteLocale } from './types';

const changelogContent: Record<SiteLocale, ChangelogSection> = {
  en: {
    badge: 'Changelog',
    title: 'Release Notes and Operational History',
    description:
      'Track what ships, where the installable artifacts live, and why release history should stay attached to the release repository.',
    summaryTitle: 'Release flow',
    summaryBody:
      'ContextGo should ship from the product source repository into contextgo/contextgo-releases, then drive both the website download center and the desktop update flow from that same release record.',
    operationsTitle: 'Operational rules',
    operations: [
      'Tag from the product repository after the release branch is ready.',
      'Build signed artifacts in CI and publish them to contextgo/contextgo-releases.',
      'Generate the release manifest and checksums alongside the assets.',
      'Let contextgo.io/download and the desktop updater read from the same release source.',
    ],
    notesTitle: 'What belongs here',
    notes: [
      'Version-level release notes',
      'Artifact availability and checksum status',
      'Operational changes that affect installation or update behavior',
    ],
  },
  zh: {
    badge: '更新记录',
    title: '版本说明与发布历史',
    description: '这里记录发出了什么、安装产物在哪里，以及为什么版本历史应该挂在 release 仓库上。',
    summaryTitle: '发布链路',
    summaryBody:
      'ContextGo 应该从产品源码仓库出发，发布到 contextgo/contextgo-releases，再由同一份 release 记录驱动官网下载页和桌面端内更新。',
    operationsTitle: '运维规则',
    operations: [
      '在产品仓库完成发布准备后打 tag。',
      '在 CI 中构建并签名安装包，再上传到 contextgo/contextgo-releases。',
      '和二进制一起生成 release manifest 与 checksum。',
      '让 contextgo.io/download 与桌面端更新读取同一份版本来源。',
    ],
    notesTitle: '这里应该承载什么',
    notes: ['版本级 release notes', '安装产物与校验状态', '影响安装或更新行为的运维变更'],
  },
};

const resourcesContent: Record<SiteLocale, ResourcesSection> = {
  en: {
    badge: 'Get Started',
    title: 'Learn the product, install it, and keep up with releases',
    description:
      'The website brings together docs, blog posts, downloads, and release history so customers can evaluate ContextGo, install it, and follow what ships next.',
    cards: [
      {
        eyebrow: 'Docs',
        title: 'Start with installation, remote access, and runtime docs',
        summary:
          'Use the docs to understand setup, runtime readiness, remote access, and the most common support questions.',
        href: '/docs',
        cta: 'Open docs',
      },
      {
        eyebrow: 'Blog',
        title: 'Follow product thinking and major updates',
        summary:
          'Use the blog for product rationale, architecture decisions, and user-facing explanations of new capabilities.',
        href: '/blog',
        cta: 'Read the blog',
      },
      {
        eyebrow: 'Changelog',
        title: 'Track releases, downloads, and verification',
        summary:
          'Check release history, release notes, download links, and checksum status before you install or upgrade.',
        href: '/changelog',
        cta: 'View release history',
      },
    ],
  },
  zh: {
    badge: '开始使用',
    title: '先了解产品，再下载，再跟进版本',
    description:
      '官网集中提供产品文档、博客、下载入口和更新记录。先判断产品是否适合，再查看安装与版本信息。',
    cards: [
      {
        eyebrow: '文档',
        title: '快速了解安装、远程访问与运行时',
        summary: '从产品文档开始，先看安装方式、运行时准备、远程访问和常见问题。',
        href: '/docs',
        cta: '进入文档',
      },
      {
        eyebrow: '博客',
        title: '读懂产品思路与更新方向',
        summary: '通过博客了解产品判断、架构取舍和面向用户的功能解释。',
        href: '/blog',
        cta: '查看博客',
      },
      {
        eyebrow: '更新记录',
        title: '查看版本发布、下载与校验状态',
        summary: '在更新记录里确认版本历史、release notes、下载入口和校验信息。',
        href: '/changelog',
        cta: '查看更新记录',
      },
    ],
  },
};

const labelsContent: Record<SiteLocale, SiteLabels> = {
  en: {
    updated: 'Updated',
    published: 'Published',
    readingTime: 'Reading time',
    backToDocs: 'Back to docs',
    backToBlog: 'Back to blog',
    docsOverview: 'Overview',
    latestRelease: 'Latest release',
    releaseSource: 'Release source',
    openDownloadCenter: 'Open download center',
    openReleasePage: 'Open release page',
    articleSidebarTitle: 'ContextGo',
    articleSidebarHeadline: 'Open ContextGo',
    articleSidebarBody:
      'Keep customer-facing guidance on the website, and keep installable artifacts in the release repository.',
    docsSource: 'Docs source',
    docsSourceRelease: 'Release docs v{{version}}',
    docsSourceFallback: 'Draft docs fallback',
    openReleaseRepository: 'Open release repository',
    openVersionedDocs: 'Open versioned docs',
    releaseHistory: 'Release history',
    docsVersionLabel: 'Docs version',
    previousPage: 'Previous',
    nextPage: 'Next',
  },
  zh: {
    updated: '更新于',
    published: '发布于',
    readingTime: '阅读时长',
    backToDocs: '返回文档',
    backToBlog: '返回博客',
    docsOverview: '概览',
    latestRelease: '最新版本',
    releaseSource: '版本来源',
    openDownloadCenter: '打开下载中心',
    openReleasePage: '打开版本页',
    articleSidebarTitle: 'ContextGo',
    articleSidebarHeadline: '打开 ContextGo',
    articleSidebarBody: '把对客文档留在官网，把可安装产物留在 release 仓库里。',
    docsSource: '文档来源',
    docsSourceRelease: 'Release 文档 v{{version}}',
    docsSourceFallback: '站内草稿回退',
    openReleaseRepository: '打开 release 仓库',
    openVersionedDocs: '打开版本文档',
    releaseHistory: '版本历史',
    docsVersionLabel: '文档版本',
    previousPage: '上一篇',
    nextPage: '下一篇',
  },
};

export const getChangelogSection = (locale: SiteLocale) => changelogContent[locale];
export const getResourcesSection = (locale: SiteLocale) => resourcesContent[locale];
export const getSiteLabels = (locale: SiteLocale) => labelsContent[locale];
