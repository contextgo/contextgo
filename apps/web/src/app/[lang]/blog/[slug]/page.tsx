import { notFound } from 'next/navigation';
import ContentArticlePage from '@/components/content/ContentArticlePage';
import { getReleaseBlogEntry, getResolvedReleaseBlog } from '@/lib/releaseBlog';
import { getResolvedReleaseDocs } from '@/lib/releaseDocs';
import { getBlogArticleSupplement, getBlogJournalCopy } from '@/lib/site-content/blogEditorial';
import { getSiteContent } from '@/lib/site-content';

export const runtime = 'edge';

export default async function BlogArticlePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const [resolvedBlog, resolvedDocs, siteContent] = await Promise.all([
    getResolvedReleaseBlog(validLang),
    getResolvedReleaseDocs(validLang),
    Promise.resolve(getSiteContent(validLang)),
  ]);
  const article = await getReleaseBlogEntry(resolvedBlog, slug);

  if (!article) {
    notFound();
  }

  const journalCopy = getBlogJournalCopy(validLang);
  const supplement = getBlogArticleSupplement(validLang, slug);
  const relatedEntries = supplement.relatedSlugs
    .map((relatedSlug) => resolvedBlog.bundle.blog.entries.find((entry) => entry.slug === relatedSlug))
    .filter((entry): entry is (typeof resolvedBlog.bundle.blog.entries)[number] => Boolean(entry));

  return (
    <ContentArticlePage
      article={article}
      backHref={`/${validLang}/blog`}
      backLabel={siteContent.labels.backToBlog}
      meta={[
        { label: siteContent.labels.published, value: article.publishedAt || '-' },
        { label: siteContent.labels.readingTime, value: article.readingTime },
      ]}
      roleLabel={journalCopy.articleRoleLabel}
      role={supplement.role}
      audienceLabel={journalCopy.articleAudienceLabel}
      audience={supplement.audience}
      coverageTitle={journalCopy.articleCoverageTitle}
      coveragePoints={supplement.coverage}
      whyTitle={journalCopy.articleWhyTitle}
      whyBody={supplement.why}
      continueTitle={journalCopy.articleContinueTitle}
      relatedEntries={relatedEntries}
      lang={validLang}
      basePath='/blog'
      primaryAction={{
        href: `/${validLang}/docs`,
        label: resolvedDocs.bundle.docs.title,
      }}
      secondaryAction={{
        href: `/${validLang}/changelog`,
        label: siteContent.changelog.title,
      }}
      sidebarTitle={journalCopy.articleActionsTitle}
      sidebarHeadline={journalCopy.articleActionsHeadline}
      sidebarBody={journalCopy.articleActionsBody}
    />
  );
}
