import { getBlogEntries, getSiteContent } from '@/lib/site-content';
import ContentIndexPage from '@/components/content/ContentIndexPage';

export const runtime = 'edge';

export default async function BlogPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const siteContent = getSiteContent(validLang);

  return (
    <ContentIndexPage
      badge={siteContent.blog.badge}
      title={siteContent.blog.title}
      description={siteContent.blog.description}
      featuredLabel={siteContent.blog.featuredLabel}
      featuredDescription={siteContent.blog.featuredDescription}
      entries={getBlogEntries(validLang)}
      lang={validLang}
      basePath='/blog'
    />
  );
}
