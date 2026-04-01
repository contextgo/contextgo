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
    badge: 'Resource Hub',
    title: 'Documentation, blog, and release history belong on the site',
    description:
      'Use contextgo.io as the public-facing home for product guidance, editorial updates, and release history. Keep binaries and manifests in the release repository, not mixed into docs.',
    cards: [
      {
        eyebrow: 'Docs',
        title: 'Docs for setup, remote access, and runtime operations',
        summary:
          'Give customers one place to understand installation, cloud account linking, device status, and remote behavior.',
        href: '/docs',
        cta: 'Open docs',
      },
      {
        eyebrow: 'Blog',
        title: 'Blog for product updates and architecture notes',
        summary:
          'Publish product rationale, roadmap notes, and user-facing explanations without overloading release notes.',
        href: '/blog',
        cta: 'Read the blog',
      },
      {
        eyebrow: 'Changelog',
        title: 'Changelog tied to the release repository',
        summary:
          'Keep official version history, manifests, checksums, and download operations aligned around contextgo-releases.',
        href: '/changelog',
        cta: 'View release history',
      },
    ],
  },
  zh: {
    badge: '资源中心',
    title: '文档、博客和发布历史，都应该挂在官网上',
    description:
      '让 contextgo.io 成为对客入口，承载产品文档、编辑内容和版本历史；而二进制与 manifest 保持在 release 仓库里。',
    cards: [
      {
        eyebrow: '文档',
        title: '安装、远程访问与运行时运维文档',
        summary: '给客户一个统一入口，理解安装、云账号绑定、设备状态和远程访问行为。',
        href: '/docs',
        cta: '进入文档',
      },
      {
        eyebrow: '博客',
        title: '产品更新与架构说明博客',
        summary: '把产品思路、路线说明和对客解释发布出来，不要全部挤进 release notes。',
        href: '/blog',
        cta: '查看博客',
      },
      {
        eyebrow: '更新记录',
        title: '与 release 仓库绑定的版本历史',
        summary: '让官方版本历史、manifest、checksum 和下载运维，都围绕 contextgo-releases 收口。',
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
    latestRelease: 'Latest release',
    releaseSource: 'Release source',
    openDownloadCenter: 'Open download center',
    openReleasePage: 'Open release page',
    articleSidebarTitle: 'ContextGo',
    articleSidebarBody:
      'Keep customer-facing guidance on the website, and keep installable artifacts in the release repository.',
    docsSource: 'Docs source',
    docsSourceRelease: 'Release docs v{{version}}',
    docsSourceFallback: 'Draft docs fallback',
    openReleaseRepository: 'Open release repository',
    openVersionedDocs: 'Open versioned docs',
    releaseHistory: 'Release history',
    docsVersionLabel: 'Docs version',
  },
  zh: {
    updated: '更新于',
    published: '发布于',
    readingTime: '阅读时长',
    backToDocs: '返回文档',
    backToBlog: '返回博客',
    latestRelease: '最新版本',
    releaseSource: '版本来源',
    openDownloadCenter: '打开下载中心',
    openReleasePage: '打开版本页',
    articleSidebarTitle: 'ContextGo',
    articleSidebarBody: '把对客文档留在官网，把可安装产物留在 release 仓库里。',
    docsSource: '文档来源',
    docsSourceRelease: 'Release 文档 v{{version}}',
    docsSourceFallback: '站内草稿回退',
    openReleaseRepository: '打开 release 仓库',
    openVersionedDocs: '打开版本文档',
    releaseHistory: '版本历史',
    docsVersionLabel: '文档版本',
  },
};

export const getChangelogSection = (locale: SiteLocale) => changelogContent[locale];
export const getResourcesSection = (locale: SiteLocale) => resourcesContent[locale];
export const getSiteLabels = (locale: SiteLocale) => labelsContent[locale];
