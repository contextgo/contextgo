import { notFound } from 'next/navigation';
import ContentArticlePage from '@/components/content/ContentArticlePage';
import { getReleaseDocEntry, getReleaseDocsRepositoryUrl, getResolvedReleaseDocs } from '@/lib/releaseDocs';
import { getSiteContent } from '@/lib/site-content';

export const runtime = 'edge';

export default async function DocArticlePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const [resolved, siteContent] = await Promise.all([
    getResolvedReleaseDocs(validLang),
    Promise.resolve(getSiteContent(validLang)),
  ]);
  const article = await getReleaseDocEntry(resolved, slug);

  if (!article) {
    notFound();
  }

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
        label: siteContent.labels.releaseHistory,
      }}
      sidebarTitle={siteContent.labels.articleSidebarTitle}
      sidebarBody={siteContent.labels.articleSidebarBody}
      version={resolved.bundle.version}
      versionLabel={siteContent.labels.docsVersionLabel}
      repositoryUrl={`${getReleaseDocsRepositoryUrl()}/tree/main/site/docs/${resolved.bundle.version}`}
      openVersionedDocsLabel={siteContent.labels.openVersionedDocs}
    />
  );
}
