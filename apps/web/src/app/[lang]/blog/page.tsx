import type { Metadata } from 'next';
import SeoJsonLd from '@/components/SeoJsonLd';
import { getResolvedReleaseBlog } from '@/lib/releaseBlog';
import { buildBreadcrumbJsonLd, buildCollectionJsonLd, buildPageMetadata } from '@/lib/seo';
import ContentIndexPage from '@/components/content/ContentIndexPage';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const resolved = await getResolvedReleaseBlog(validLang);

  return buildPageMetadata({
    locale: validLang,
    pathname: '/blog',
    title: resolved.bundle.blog.title,
    description: resolved.bundle.blog.description,
  });
}

export default async function BlogPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const resolved = await getResolvedReleaseBlog(validLang);

  return (
    <>
      <SeoJsonLd
        data={[
          buildCollectionJsonLd({
            locale: validLang,
            pathname: '/blog',
            name: resolved.bundle.blog.title,
            description: resolved.bundle.blog.description,
          }),
          buildBreadcrumbJsonLd(validLang, [
            { name: 'ContextGo', pathname: '' },
            { name: resolved.bundle.blog.title, pathname: '/blog' },
          ]),
        ]}
      />
      <ContentIndexPage
        badge={resolved.bundle.blog.badge}
        title={resolved.bundle.blog.title}
        description={resolved.bundle.blog.description}
        featuredLabel={resolved.bundle.blog.featuredLabel}
        featuredDescription={resolved.bundle.blog.featuredDescription}
        entries={resolved.bundle.blog.entries}
        lang={validLang}
        basePath='/blog'
      />
    </>
  );
}
