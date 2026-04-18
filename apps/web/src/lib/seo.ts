import type { Metadata } from 'next';
import type { PublicArticle, SiteLocale } from './public-content/types';

const SITE_NAME = 'ContextGo';
const SITE_URL = 'https://contextgo.io';
const DEFAULT_OG_IMAGE_PATH = '/logo.png';
const DEFAULT_DESCRIPTION =
  'ContextGo connects knowledge, tasks, conversations, and channels so agents can work inside real workflows.';
const DEFAULT_KEYWORDS = [
  'ContextGo',
  'AI workspace',
  'agent workflows',
  'context engineering',
  'remote workbench',
  'AI operations',
];

const OPEN_GRAPH_LOCALE: Record<SiteLocale, string> = {
  en: 'en_US',
  zh: 'zh_CN',
};

const normalizePathname = (pathname: string): string => {
  if (!pathname || pathname === '/') {
    return '';
  }

  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return normalized.replace(/\/+$/g, '');
};

export const resolveSiteLocale = (value: string): SiteLocale => (value === 'zh' ? 'zh' : 'en');

export const getLocalizedPath = (locale: SiteLocale, pathname = ''): string => {
  const normalizedPath = normalizePathname(pathname);
  return `/${locale}${normalizedPath}`;
};

export const getAlternateLocalePath = (locale: SiteLocale, pathname = ''): string => {
  return getLocalizedPath(locale === 'zh' ? 'en' : 'zh', pathname);
};

export const getAbsoluteSiteUrl = (pathname = ''): string => `${SITE_URL}${pathname || ''}`;

const buildLanguageAlternates = (pathname = '') => ({
  en: getAbsoluteSiteUrl(getLocalizedPath('en', pathname)),
  zh: getAbsoluteSiteUrl(getLocalizedPath('zh', pathname)),
  'x-default': getAbsoluteSiteUrl(getLocalizedPath('en', pathname)),
});

const buildRobots = (index = true): Metadata['robots'] => ({
  index,
  follow: index,
  googleBot: {
    index,
    follow: index,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
});

type PageMetadataOptions = {
  locale: SiteLocale;
  pathname: string;
  title: string;
  description: string;
  keywords?: string[];
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  noIndex?: boolean;
};

export const buildPageMetadata = ({
  locale,
  pathname,
  title,
  description,
  keywords = DEFAULT_KEYWORDS,
  type = 'website',
  publishedTime,
  modifiedTime,
  noIndex = false,
}: PageMetadataOptions): Metadata => {
  const canonicalPath = getLocalizedPath(locale, pathname);
  const canonicalUrl = getAbsoluteSiteUrl(canonicalPath);
  const imageUrl = getAbsoluteSiteUrl(DEFAULT_OG_IMAGE_PATH);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
      languages: buildLanguageAlternates(pathname),
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: OPEN_GRAPH_LOCALE[locale],
      type,
      images: [
        {
          url: imageUrl,
          alt: SITE_NAME,
        },
      ],
      ...(type === 'article'
        ? {
            publishedTime,
            modifiedTime,
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    robots: buildRobots(!noIndex),
  };
};

export const buildRootMetadata = (): Metadata => ({
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} | Context-First AI Workbench`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'technology',
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: `${SITE_NAME} | Context-First AI Workbench`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
    images: [
      {
        url: getAbsoluteSiteUrl(DEFAULT_OG_IMAGE_PATH),
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Context-First AI Workbench`,
    description: DEFAULT_DESCRIPTION,
    images: [getAbsoluteSiteUrl(DEFAULT_OG_IMAGE_PATH)],
  },
  robots: buildRobots(true),
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
});

type CollectionJsonLdOptions = {
  locale: SiteLocale;
  pathname: string;
  name: string;
  description: string;
};

export const buildOrganizationJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: getAbsoluteSiteUrl('/logo.png'),
});

export const buildWebsiteJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: ['en', 'zh'],
  description: DEFAULT_DESCRIPTION,
  publisher: {
    '@type': 'Organization',
    name: SITE_NAME,
  },
});

export const buildCollectionJsonLd = ({ locale, pathname, name, description }: CollectionJsonLdOptions) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name,
  description,
  url: getAbsoluteSiteUrl(getLocalizedPath(locale, pathname)),
  inLanguage: locale,
  isPartOf: getAbsoluteSiteUrl(),
});

type SoftwareApplicationJsonLdOptions = {
  locale: SiteLocale;
  pathname: string;
  name: string;
  description: string;
};

export const buildSoftwareApplicationJsonLd = ({
  locale,
  pathname,
  name,
  description,
}: SoftwareApplicationJsonLdOptions) => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name,
  description,
  url: getAbsoluteSiteUrl(getLocalizedPath(locale, pathname)),
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'macOS, Windows, Linux, Android, iOS, HarmonyOS',
  publisher: {
    '@type': 'Organization',
    name: SITE_NAME,
  },
});

type ArticleJsonLdOptions = {
  locale: SiteLocale;
  pathname: string;
  article: PublicArticle;
  type?: 'Article' | 'BlogPosting' | 'TechArticle';
};

export const buildArticleJsonLd = ({ locale, pathname, article, type = 'Article' }: ArticleJsonLdOptions) => {
  const canonicalUrl = getAbsoluteSiteUrl(getLocalizedPath(locale, pathname));

  return {
    '@context': 'https://schema.org',
    '@type': type,
    headline: article.title,
    description: article.summary,
    datePublished: article.publishedAt || article.updatedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: getAbsoluteSiteUrl('/logo.png'),
      },
    },
    inLanguage: locale,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
  };
};

type BreadcrumbItem = {
  name: string;
  pathname: string;
};

export const buildBreadcrumbJsonLd = (locale: SiteLocale, items: BreadcrumbItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: getAbsoluteSiteUrl(getLocalizedPath(locale, item.pathname)),
  })),
});
