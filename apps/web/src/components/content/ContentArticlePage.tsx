import Link from 'next/link';
import type { ContentArticle } from '@/lib/site-content';

type MetaItem = {
  label: string;
  value: string;
};

export default function ContentArticlePage({
  article,
  backHref,
  backLabel,
  meta,
  primaryAction,
  secondaryAction,
  sidebarTitle,
  sidebarBody,
}: {
  article: ContentArticle;
  backHref: string;
  backLabel: string;
  meta: MetaItem[];
  primaryAction: { href: string; label: string };
  secondaryAction: { href: string; label: string };
  sidebarTitle: string;
  sidebarBody: string;
}) {
  return (
    <section className='theme-page px-4 py-20'>
      <div className='container-custom'>
        <div className='theme-panel-gradient theme-shadow-soft theme-border rounded-[32px] border px-8 py-10 md:px-10 md:py-12'>
          <Link href={backHref} className='theme-text-tertiary text-sm font-medium hover:theme-text-primary'>
            {backLabel}
          </Link>
          <div className='theme-text-tertiary mt-6 text-xs font-semibold uppercase tracking-[0.22em]'>{article.eyebrow}</div>
          <h1 className='theme-text-primary mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.04em] md:text-5xl'>
            {article.title}
          </h1>
          <p className='theme-text-secondary mt-4 max-w-3xl text-base leading-8 md:text-lg'>{article.summary}</p>
          <div className='theme-text-tertiary mt-6 flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em]'>
            {meta.map((item) => (
              <span key={`${item.label}-${item.value}`}>
                {item.label}: {item.value}
              </span>
            ))}
          </div>
        </div>

        <div className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
          <article className='theme-surface-secondary theme-shadow-card theme-border rounded-[28px] border px-7 py-7 md:px-9 md:py-9'>
            <div className='space-y-10'>
              {article.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className='theme-text-primary text-2xl font-semibold tracking-tight'>{section.heading}</h2>
                  <div className='theme-text-secondary mt-4 space-y-4 text-base leading-8'>
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  {section.bullets?.length ? (
                    <ul className='theme-text-secondary mt-5 list-disc space-y-2 pl-5 text-sm leading-7'>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </article>

          <aside className='space-y-5'>
            <div className='theme-card-gradient theme-shadow-card theme-border rounded-[28px] border p-6'>
              <div className='theme-text-primary text-lg font-semibold'>{sidebarTitle}</div>
              <p className='theme-text-secondary mt-3 text-sm leading-7'>{sidebarBody}</p>
              <div className='mt-5 flex flex-col gap-3'>
                <Link
                  href={primaryAction.href}
                  className='theme-button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-colors'
                >
                  {primaryAction.label}
                </Link>
                <Link
                  href={secondaryAction.href}
                  className='theme-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-colors'
                >
                  {secondaryAction.label}
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
