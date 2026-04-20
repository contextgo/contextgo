import { describe, expect, it } from 'vitest';
import { getBlogArticleSupplement, getBlogJournalCopy } from '../../../apps/web/src/lib/site-content/blogEditorial';
import type { PublicArticle } from '../../../apps/web/src/lib/public-content/types';
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildWebPageJsonLd,
  getAlternateLocalePath,
  resolveSiteLocale,
} from '../../../apps/web/src/lib/seo';

describe('seo helpers', () => {
  it('normalizes locale and alternate locale paths', () => {
    expect(resolveSiteLocale('zh')).toBe('zh');
    expect(resolveSiteLocale('fr')).toBe('en');
    expect(getAlternateLocalePath('en', '/blog/context-before-agents')).toBe('/zh/blog/context-before-agents');
    expect(getAlternateLocalePath('zh', '/download')).toBe('/en/download');
  });

  it('builds localized metadata with canonical and language alternates', () => {
    const metadata = buildPageMetadata({
      locale: 'en',
      pathname: '/blog',
      title: 'ContextGo Blog',
      description: 'Product essays, release operations, and remote-work model notes.',
    });

    expect(metadata.alternates?.canonical?.toString()).toBe('https://contextgo.io/en/blog');
    expect(metadata.alternates?.languages?.en?.toString()).toBe('https://contextgo.io/en/blog');
    expect(metadata.alternates?.languages?.zh?.toString()).toBe('https://contextgo.io/zh/blog');
    expect(metadata.alternates?.languages?.['x-default']?.toString()).toBe('https://contextgo.io/en/blog');
    expect(metadata.openGraph?.locale).toBe('en_US');
    expect(metadata.openGraph?.images?.[0]).toMatchObject({
      url: 'https://contextgo.io/site/homepage-preview.png',
    });
    expect(metadata.twitter?.images).toEqual(['https://contextgo.io/site/homepage-preview.png']);
  });

  it('builds article json-ld with stable canonical url and dates', () => {
    const article: PublicArticle = {
      slug: 'context-before-agents',
      eyebrow: 'Product model',
      title: 'Context before agents',
      summary: 'Why a blank chat box is not enough for real work.',
      readingTime: '8 min',
      publishedAt: '2026-04-18',
      html: '<h2>Why</h2><p>Test</p>',
    };

    const jsonLd = buildArticleJsonLd({
      locale: 'en',
      pathname: '/blog/context-before-agents',
      article,
      type: 'BlogPosting',
    });

    expect(jsonLd['@type']).toBe('BlogPosting');
    expect(jsonLd.headline).toBe(article.title);
    expect(jsonLd.datePublished).toBe('2026-04-18');
    expect(jsonLd.mainEntityOfPage).toBe('https://contextgo.io/en/blog/context-before-agents');
    expect(jsonLd.inLanguage).toBe('en');
    expect(jsonLd.author).toEqual({
      '@type': 'Organization',
      name: 'ContextGo',
    });
  });

  it('builds organization json-ld with public brand entity links', () => {
    const jsonLd = buildOrganizationJsonLd();

    expect(jsonLd.url).toBe('https://contextgo.io');
    expect(jsonLd.logo).toBe('https://contextgo.io/logo.png');
    expect(jsonLd.sameAs).toEqual(['https://docs.contextgo.io', 'https://github.com/contextgo/contextgo-releases']);
  });

  it('builds webpage json-ld for product landing pages', () => {
    const pageJsonLd = buildWebPageJsonLd({
      locale: 'en',
      pathname: '/connect',
      name: 'Connect',
      description: 'Bring connectors, runtimes, and external systems into one workbench.',
    });
    const breadcrumbJsonLd = buildBreadcrumbJsonLd('en', [
      { name: 'ContextGo', pathname: '' },
      { name: 'Connect', pathname: '/connect' },
    ]);

    expect(pageJsonLd['@type']).toBe('WebPage');
    expect(pageJsonLd.url).toBe('https://contextgo.io/en/connect');
    expect(pageJsonLd.isPartOf).toBe('https://contextgo.io');
    expect(pageJsonLd.inLanguage).toBe('en');
    expect(breadcrumbJsonLd.itemListElement).toHaveLength(2);
  });

  it('keeps the founding manifesto in the public reading path and supplement metadata', () => {
    const journal = getBlogJournalCopy('en');
    const supplement = getBlogArticleSupplement('en', 'why-we-built-contextgo');

    expect(journal.pathItems[0]?.slug).toBe('why-we-built-contextgo');
    expect(supplement.role).toBe('Founding manifesto');
    expect(supplement.relatedSlugs).toEqual(['context-before-agents', 'desktop-host-mobile-client']);
  });
});
