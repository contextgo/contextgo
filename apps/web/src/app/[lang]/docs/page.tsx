import { getDocGroups, getSiteContent } from '@/lib/site-content';
import DocsIndexPage from '@/components/content/DocsIndexPage';

export const runtime = 'edge';

export default async function DocsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const siteContent = getSiteContent(validLang);

  return (
    <DocsIndexPage
      badge={siteContent.docs.badge}
      title={siteContent.docs.title}
      description={siteContent.docs.description}
      featuredLabel={siteContent.docs.featuredLabel}
      featuredDescription={siteContent.docs.featuredDescription}
      groups={getDocGroups(validLang)}
      lang={validLang}
    />
  );
}
