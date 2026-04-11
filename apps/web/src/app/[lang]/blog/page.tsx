import { getResolvedReleaseBlog } from '@/lib/releaseBlog';
import ContentIndexPage from '@/components/content/ContentIndexPage';

export const runtime = 'edge';

export default async function BlogPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const resolved = await getResolvedReleaseBlog(validLang);

  return (
    <ContentIndexPage
      badge={resolved.bundle.blog.badge}
      title={resolved.bundle.blog.title}
      description={resolved.bundle.blog.description}
      featuredLabel={resolved.bundle.blog.featuredLabel}
      featuredDescription={resolved.bundle.blog.featuredDescription}
      entries={resolved.bundle.blog.entries}
      lang={validLang}
      basePath='/blog'
    />
  );
}
