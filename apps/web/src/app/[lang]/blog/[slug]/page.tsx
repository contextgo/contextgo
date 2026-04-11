import { notFound } from 'next/navigation';
import ContentArticlePage from '@/components/content/ContentArticlePage';
import { getReleaseBlogEntry, getResolvedReleaseBlog } from '@/lib/releaseBlog';
import { getResolvedReleaseDocs } from '@/lib/releaseDocs';
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

  return (
    <ContentArticlePage
      article={article}
      backHref={`/${validLang}/blog`}
      backLabel={siteContent.labels.backToBlog}
      meta={[
        { label: siteContent.labels.published, value: article.publishedAt || '-' },
        { label: siteContent.labels.readingTime, value: article.readingTime },
      ]}
      primaryAction={{
        href: `/${validLang}/docs`,
        label: resolvedDocs.bundle.docs.title,
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
