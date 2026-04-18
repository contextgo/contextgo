import Link from 'next/link';
import type { PublicArticle, PublicArticleMeta } from '@/lib/public-content/types';

type MetaItem = {
  label: string;
  value: string;
};

export default function ContentArticlePage({
  article,
  backHref,
  backLabel,
  meta,
  roleLabel,
  role,
  audienceLabel,
  audience,
  coverageTitle,
  coveragePoints,
  whyTitle,
  whyBody,
  continueTitle,
  relatedEntries,
  lang,
  basePath,
  primaryAction,
  secondaryAction,
  sidebarTitle,
  sidebarHeadline,
  sidebarBody,
  version,
  versionLabel,
  repositoryUrl,
  openVersionedDocsLabel,
}: {
  article: PublicArticle;
  backHref: string;
  backLabel: string;
  meta: MetaItem[];
  roleLabel: string;
  role: string;
  audienceLabel: string;
  audience: string;
  coverageTitle: string;
  coveragePoints: string[];
  whyTitle: string;
  whyBody: string;
  continueTitle: string;
  relatedEntries: PublicArticleMeta[];
  lang: string;
  basePath: '/docs' | '/blog';
  primaryAction: { href: string; label: string };
  secondaryAction: { href: string; label: string };
  sidebarTitle: string;
  sidebarHeadline: string;
  sidebarBody: string;
  version?: string;
  versionLabel?: string;
  repositoryUrl?: string;
  openVersionedDocsLabel?: string;
}) {
  return (
    <section className='theme-page px-4 pb-24 pt-12 md:pb-28 md:pt-14'>
      <div className='container-custom max-w-[1060px]'>
        <Link href={backHref} className='theme-text-tertiary text-sm font-medium hover:theme-text-primary'>
          {backLabel}
        </Link>

        <div className='theme-border mt-6 border-y py-6 md:mt-8 md:py-7'>
          <div className='editorial-kicker'>{article.eyebrow}</div>
          <h1 className='theme-text-primary mt-5 max-w-4xl text-[2.35rem] font-semibold tracking-[-0.05em] md:text-[4rem] md:leading-[0.98]'>
            {article.title}
          </h1>
          <p className='theme-text-secondary mt-5 max-w-2xl text-base leading-8 md:text-[1.05rem] md:leading-8'>
            {article.summary}
          </p>
          <dl className='theme-text-tertiary mt-6 flex flex-wrap gap-x-5 gap-y-3 text-[10px] font-semibold uppercase tracking-[0.24em]'>
            {meta.map((item) => (
              <div key={`${item.label}-${item.value}`} className='flex items-center gap-2'>
                <dt>{item.label}</dt>
                <dd className='theme-text-primary'>{item.value}</dd>
              </div>
            ))}
            <div className='flex items-center gap-2'>
              <dt>{roleLabel}</dt>
              <dd className='theme-text-primary'>{role}</dd>
            </div>
            <div className='flex items-center gap-2'>
              <dt>{audienceLabel}</dt>
              <dd className='theme-text-primary'>{audience}</dd>
            </div>
          </dl>
        </div>

        <div className='mt-10 grid gap-7 lg:grid-cols-[minmax(0,42rem)_216px] lg:justify-between lg:items-start'>
          <article className='space-y-6'>
            <div className='theme-border border-l pl-5'>
              <div className='editorial-kicker'>{whyTitle}</div>
              <p className='theme-text-primary mt-3 text-[1.02rem] font-medium leading-8'>{whyBody}</p>
            </div>

            <div className='theme-surface-secondary'>
              <div
                className='editorial-markdown theme-text-secondary'
                dangerouslySetInnerHTML={{ __html: article.html }}
              />
            </div>
          </article>

          <aside className='lg:pt-1'>
            <div className='space-y-6 lg:sticky lg:top-20'>
              <div className='theme-border border-t pt-4'>
                <div className='editorial-kicker'>{coverageTitle}</div>
                <div className='mt-4 space-y-3'>
                  {coveragePoints.map((point) => (
                    <p key={point} className='theme-text-secondary text-sm leading-7'>
                      {point}
                    </p>
                  ))}
                </div>
              </div>

              <div className='theme-border border-t pt-4'>
                <div className='editorial-kicker'>{sidebarTitle}</div>
                <p className='theme-text-primary mt-3 text-base font-semibold leading-7 tracking-[-0.02em]'>
                  {sidebarHeadline}
                </p>
                <p className='theme-text-secondary mt-3 text-sm leading-7'>{sidebarBody}</p>
                {version ? (
                  <div className='theme-border theme-text-secondary mt-4 rounded-[14px] border px-4 py-3 text-sm'>
                    {versionLabel}: v{version}
                  </div>
                ) : null}
                <div className='mt-5 space-y-3'>
                  <Link
                    href={primaryAction.href}
                    className='theme-border theme-text-primary flex items-center justify-between border-b pb-3 text-sm font-medium transition-opacity hover:opacity-75'
                  >
                    <span>{primaryAction.label}</span>
                    <span aria-hidden='true'>→</span>
                  </Link>
                  <Link
                    href={secondaryAction.href}
                    className='theme-border theme-text-primary flex items-center justify-between border-b pb-3 text-sm font-medium transition-opacity hover:opacity-75'
                  >
                    <span>{secondaryAction.label}</span>
                    <span aria-hidden='true'>→</span>
                  </Link>
                  {repositoryUrl && openVersionedDocsLabel ? (
                    <a
                      href={repositoryUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='theme-border theme-text-primary flex items-center justify-between border-b pb-3 text-sm font-medium transition-opacity hover:opacity-75'
                    >
                      <span>{openVersionedDocsLabel}</span>
                      <span aria-hidden='true'>→</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {relatedEntries.length > 0 ? (
                <div className='theme-border border-t pt-4'>
                  <div className='editorial-kicker'>{continueTitle}</div>
                  <div className='mt-4 space-y-4'>
                    {relatedEntries.map((entry) => (
                      <Link
                        key={entry.slug}
                        href={`/${lang}${basePath}/${entry.slug}`}
                        className='block transition-opacity hover:opacity-80'
                      >
                        <div className='theme-text-tertiary text-[10px] font-semibold uppercase tracking-[0.24em]'>
                          {entry.eyebrow}
                        </div>
                        <div className='theme-text-primary mt-2 text-base font-semibold leading-6'>{entry.title}</div>
                        <p className='theme-text-secondary mt-2 text-sm leading-7'>{entry.summary}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
