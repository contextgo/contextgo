import { notFound } from 'next/navigation';
import ContentArticlePage from '@/components/content/ContentArticlePage';
import { getDocEntry, getSiteContent } from '@/lib/site-content';

export const runtime = 'edge';

export default async function DocArticlePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const article = getDocEntry(validLang, slug);

  if (!article) {
    notFound();
  }

  const siteContent = getSiteContent(validLang);

  return (
    <ContentArticlePage
      article={article}
      backHref={`/${validLang}/docs`}
      backLabel={siteContent.labels.backToDocs}
      meta={[
        { label: siteContent.labels.updated, value: article.updatedAt || '-' },
        { label: siteContent.labels.readingTime, value: article.readingTime },
      ]}
      primaryAction={{
        href: `/${validLang}/download`,
        label: siteContent.labels.openDownloadCenter,
      }}
      secondaryAction={{
        href: `/${validLang}/changelog`,
        label: siteContent.changelog.title,
      }}
      sidebarTitle={siteContent.labels.articleSidebarTitle}
      sidebarBody={siteContent.labels.articleSidebarBody}
    />
  );
}
