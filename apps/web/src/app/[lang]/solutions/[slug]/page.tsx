import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SeoJsonLd from '@/components/SeoJsonLd';
import { FaqSection, IntentCardGrid } from '@/components/seo/SearchIntentSections';
import { getIntentPage, getIntentPages, INTENT_PAGE_SLUGS } from '@/lib/intentContent';
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildPageMetadata, buildWebPageJsonLd } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return ['en', 'zh'].flatMap((lang) => INTENT_PAGE_SLUGS.map((slug) => ({ lang, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const locale = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const page = getIntentPage(locale, slug);

  return buildPageMetadata({
    locale,
    pathname: `/solutions/${slug}`,
    title: page?.title || (locale === 'zh' ? 'ContextGo 方案页面' : 'ContextGo Solutions'),
    description:
      page?.summary ||
      (locale === 'zh'
        ? 'ContextGo 的公开方案页，解释真实工作流、远程产品模型和发布运维边界。'
        : 'Public ContextGo solution pages for real workflows, remote product boundaries, and release operations.'),
    noIndex: !page,
  });
}

export default async function SolutionDetailPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const locale = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const page = getIntentPage(locale, slug);

  if (!page) {
    notFound();
  }

  const relatedPages = page.relatedSlugs
    .map((relatedSlug) => getIntentPage(locale, relatedSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const allPages = getIntentPages(locale);
  const indexTitle = locale === 'zh' ? 'ContextGo 方案页面' : 'ContextGo Solutions';
  const faqTitle = locale === 'zh' ? '本页常见问题' : 'Frequently asked questions';

  return (
    <>
      <SeoJsonLd
        data={[
          buildWebPageJsonLd({
            locale,
            pathname: `/solutions/${page.slug}`,
            name: page.title,
            description: page.summary,
          }),
          buildFaqJsonLd(page.faq),
          buildBreadcrumbJsonLd(locale, [
            { name: 'ContextGo', pathname: '' },
            { name: indexTitle, pathname: '/solutions' },
            { name: page.title, pathname: `/solutions/${page.slug}` },
          ]),
        ]}
      />

      <section className='theme-page px-4 pb-20 pt-12 md:pt-14'>
        <div className='container-custom max-w-[1100px]'>
          <Link
            href={`/${locale}/solutions`}
            className='theme-text-tertiary text-sm font-medium hover:theme-text-primary'
          >
            {locale === 'zh' ? '返回方案页' : 'Back to solutions'}
          </Link>

          <div className='theme-border mt-6 border-y py-6 md:mt-8 md:py-7'>
            <div className='editorial-kicker'>{page.eyebrow}</div>
            <h1 className='theme-text-primary mt-5 max-w-4xl text-[2.15rem] font-semibold tracking-[-0.05em] md:text-[3.7rem] md:leading-[0.98]'>
              {page.title}
            </h1>
            <p className='theme-text-secondary mt-5 max-w-3xl text-base leading-8 md:text-[1.02rem]'>{page.summary}</p>
            <div className='theme-border mt-6 border-l pl-5'>
              <div className='editorial-kicker'>{locale === 'zh' ? '核心判断' : 'Core answer'}</div>
              <p className='theme-text-primary mt-3 text-[1.02rem] font-medium leading-8'>{page.problem}</p>
            </div>
            <div className='mt-6 flex flex-wrap gap-3'>
              <Link
                href={`/${locale}${page.primaryCtaHref}`}
                className='theme-button-primary inline-flex rounded-full px-5 py-3 text-sm font-medium transition-colors'
              >
                {page.primaryCtaLabel}
              </Link>
              <Link
                href={`/${locale}${page.secondaryCtaHref}`}
                className='theme-button-secondary inline-flex rounded-full px-5 py-3 text-sm font-medium transition-colors'
              >
                {page.secondaryCtaLabel}
              </Link>
            </div>
          </div>

          <div className='mt-10 grid gap-7 lg:grid-cols-[minmax(0,42rem)_216px] lg:justify-between lg:items-start'>
            <article className='space-y-6'>
              {page.sections.map((section) => (
                <section
                  key={section.title}
                  className='theme-surface-secondary theme-shadow-card theme-border rounded-[26px] border px-6 py-6'
                >
                  <div className='editorial-kicker'>{page.eyebrow}</div>
                  <h2 className='theme-text-primary mt-3 text-[1.45rem] font-semibold tracking-[-0.03em]'>
                    {section.title}
                  </h2>
                  <p className='theme-text-secondary mt-4 text-sm leading-8'>{section.body}</p>
                  <div className='mt-5 space-y-3'>
                    {section.points.map((point) => (
                      <p key={point} className='theme-text-secondary text-sm leading-7'>
                        {point}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </article>

            <aside className='lg:pt-1'>
              <div className='space-y-6 lg:sticky lg:top-20'>
                <div className='theme-border border-t pt-4'>
                  <div className='editorial-kicker'>{locale === 'zh' ? '适用场景' : 'Best fit'}</div>
                  <div className='mt-4 space-y-3'>
                    <p className='theme-text-secondary text-sm leading-7'>{page.problem}</p>
                    <p className='theme-text-secondary text-sm leading-7'>{page.summary}</p>
                  </div>
                </div>

                <div className='theme-border border-t pt-4'>
                  <div className='editorial-kicker'>{locale === 'zh' ? '相关方案' : 'Related solutions'}</div>
                  <div className='mt-4 space-y-4'>
                    {relatedPages.map((relatedPage) => (
                      <Link
                        key={relatedPage.slug}
                        href={`/${locale}/solutions/${relatedPage.slug}`}
                        className='block transition-opacity hover:opacity-80'
                      >
                        <div className='theme-text-tertiary text-[10px] font-semibold uppercase tracking-[0.24em]'>
                          {relatedPage.eyebrow}
                        </div>
                        <div className='theme-text-primary mt-2 text-base font-semibold leading-6'>
                          {relatedPage.title}
                        </div>
                        <p className='theme-text-secondary mt-2 text-sm leading-7'>{relatedPage.summary}</p>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className='theme-border border-t pt-4'>
                  <div className='editorial-kicker'>{locale === 'zh' ? '全部入口' : 'All entry pages'}</div>
                  <div className='mt-4 space-y-3'>
                    {allPages.map((entry) => (
                      <Link
                        key={entry.slug}
                        href={`/${locale}/solutions/${entry.slug}`}
                        className='theme-text-secondary block text-sm leading-7 transition-opacity hover:opacity-80'
                      >
                        {entry.title}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <FaqSection title={faqTitle} items={page.faq} />
      <IntentCardGrid
        title={locale === 'zh' ? '从同一套产品模型继续展开' : 'Continue from the same product model'}
        description={
          locale === 'zh'
            ? '这些页面共同解释 ContextGo 的工作台、上下文、远程访问、连接器和发布运维边界。'
            : 'These pages extend the same ContextGo model across workbench, context, remote access, connectors, and release operations.'
        }
        pages={relatedPages}
        lang={locale}
      />
    </>
  );
}
