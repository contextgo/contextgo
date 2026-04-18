import type { Metadata } from 'next';
import SeoJsonLd from '@/components/SeoJsonLd';
import { IntentCardGrid } from '@/components/seo/SearchIntentSections';
import { getIntentIndexContent, getIntentPages } from '@/lib/intentContent';
import { buildBreadcrumbJsonLd, buildCollectionJsonLd, buildPageMetadata } from '@/lib/seo';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const index = getIntentIndexContent(locale);

  return buildPageMetadata({
    locale,
    pathname: '/solutions',
    title: index.title,
    description: index.description,
  });
}

export default async function SolutionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const index = getIntentIndexContent(locale);
  const pages = getIntentPages(locale);

  return (
    <>
      <SeoJsonLd
        data={[
          buildCollectionJsonLd({
            locale,
            pathname: '/solutions',
            name: index.title,
            description: index.description,
          }),
          buildBreadcrumbJsonLd(locale, [
            { name: 'ContextGo', pathname: '' },
            { name: index.title, pathname: '/solutions' },
          ]),
        ]}
      />
      <IntentCardGrid title={index.title} description={index.description} pages={pages} lang={locale} />
    </>
  );
}
