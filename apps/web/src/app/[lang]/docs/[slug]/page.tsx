import { notFound } from 'next/navigation';
import ContentArticlePage from '@/components/content/ContentArticlePage';
import { getReleaseDocEntry, getReleaseDocsRepositoryUrl, getResolvedReleaseDocs } from '@/lib/releaseDocs';

export const runtime = 'edge';

export default async function DocArticlePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const resolved = await getResolvedReleaseDocs(validLang);
  const article = getReleaseDocEntry(resolved, slug);

  if (!article) {
    notFound();
  }

  return (
    <ContentArticlePage
      article={article}
      backHref={`/${validLang}/docs`}
      backLabel={resolved.bundle.labels.backToDocs}
      meta={[
        { label: resolved.bundle.labels.updated, value: article.updatedAt || '-' },
        { label: resolved.bundle.labels.readingTime, value: article.readingTime },
      ]}
      primaryAction={{
        href: `/${validLang}/download`,
        label: resolved.bundle.labels.openDownloadCenter,
      }}
      secondaryAction={{
        href: `/${validLang}/changelog`,
        label: resolved.bundle.labels.releaseHistory,
      }}
      sidebarTitle={resolved.bundle.labels.articleSidebarTitle}
      sidebarBody={resolved.bundle.labels.articleSidebarBody}
      version={resolved.bundle.version}
      versionLabel={resolved.bundle.labels.docsVersionLabel}
      repositoryUrl={`${getReleaseDocsRepositoryUrl()}/tree/main/docs/${resolved.bundle.version}`}
      openVersionedDocsLabel={resolved.bundle.labels.openVersionedDocs}
    />
  );
}
