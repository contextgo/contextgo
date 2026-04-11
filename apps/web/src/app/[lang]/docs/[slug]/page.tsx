import { notFound } from 'next/navigation';
import DocsArticlePage from '@/components/content/DocsArticlePage';
import {
  getAdjacentReleaseDocEntries,
  getReleaseDocEntry,
  getReleaseDocGroups,
  getReleaseDocsRepositoryUrl,
  getResolvedReleaseDocs,
} from '@/lib/releaseDocs';
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

  const repositoryUrl = `${getReleaseDocsRepositoryUrl()}/tree/main/site/docs/${resolved.bundle.version}`;
  const sourceValue =
    resolved.source === 'release-repo'
      ? siteContent.labels.docsSourceRelease.replace('{{version}}', resolved.bundle.version)
      : siteContent.labels.docsSourceFallback;
  const adjacentEntries = getAdjacentReleaseDocEntries(resolved, slug);

  return (
    <DocsArticlePage
      article={article}
      docsTitle={resolved.bundle.docs.title}
      overviewHref={`/${validLang}/docs`}
      overviewLabel={siteContent.labels.docsOverview}
      groups={getReleaseDocGroups(resolved)}
      activeSlug={slug}
      sourceLabel={siteContent.labels.docsSource}
      sourceValue={sourceValue}
      versionLabel={siteContent.labels.docsVersionLabel}
      version={resolved.bundle.version}
      repositoryUrl={repositoryUrl}
      openRepositoryLabel={siteContent.labels.openReleaseRepository}
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
      openVersionedDocsLabel={siteContent.labels.openVersionedDocs}
      previousEntry={adjacentEntries.previous}
      nextEntry={adjacentEntries.next}
      previousPageLabel={siteContent.labels.previousPage}
      nextPageLabel={siteContent.labels.nextPage}
    />
  );
}
