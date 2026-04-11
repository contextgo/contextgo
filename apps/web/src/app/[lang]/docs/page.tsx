import { getReleaseDocGroups, getReleaseDocsRepositoryUrl, getResolvedReleaseDocs } from '@/lib/releaseDocs';
import { getSiteContent } from '@/lib/site-content';
import DocsIndexPage from '@/components/content/DocsIndexPage';

export const runtime = 'edge';

export default async function DocsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const [resolved, siteContent] = await Promise.all([getResolvedReleaseDocs(validLang), Promise.resolve(getSiteContent(validLang))]);

  return (
    <DocsIndexPage
      badge={resolved.bundle.docs.badge}
      title={resolved.bundle.docs.title}
      description={resolved.bundle.docs.description}
      featuredLabel={resolved.bundle.docs.featuredLabel}
      featuredDescription={resolved.bundle.docs.featuredDescription}
      groups={getReleaseDocGroups(resolved)}
      lang={validLang}
      version={resolved.bundle.version}
      source={resolved.source}
      versions={resolved.index.versions}
      repositoryUrl={getReleaseDocsRepositoryUrl()}
      sourceLabel={siteContent.labels.docsSource}
      sourceReleaseLabel={siteContent.labels.docsSourceRelease}
      sourceFallbackLabel={siteContent.labels.docsSourceFallback}
      versionLabel={siteContent.labels.docsVersionLabel}
      openRepositoryLabel={siteContent.labels.openReleaseRepository}
      overviewLabel={siteContent.labels.docsOverview}
    />
  );
}
