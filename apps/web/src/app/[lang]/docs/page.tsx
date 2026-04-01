import { getReleaseDocGroups, getReleaseDocsRepositoryUrl, getResolvedReleaseDocs } from '@/lib/releaseDocs';
import DocsIndexPage from '@/components/content/DocsIndexPage';

export const runtime = 'edge';

export default async function DocsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const resolved = await getResolvedReleaseDocs(validLang);

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
      sourceLabel={resolved.bundle.labels.docsSource}
      sourceReleaseLabel={resolved.bundle.labels.docsSourceRelease}
      sourceFallbackLabel={resolved.bundle.labels.docsSourceFallback}
      openRepositoryLabel={resolved.bundle.labels.openReleaseRepository}
    />
  );
}
