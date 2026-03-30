import Link from 'next/link';
import type { ContentArticle } from '@/lib/site-content';
import PageHero from './PageHero';

export default function ContentIndexPage({
  badge,
  title,
  description,
  featuredLabel,
  featuredDescription,
  entries,
  lang,
  basePath,
}: {
  badge: string;
  title: string;
  description: string;
  featuredLabel: string;
  featuredDescription: string;
  entries: ContentArticle[];
  lang: string;
  basePath: '/docs' | '/blog';
}) {
  return (
    <>
      <PageHero badge={badge} title={title} description={description} />
      <section className='theme-page-muted px-4 py-18'>
        <div className='container-custom grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
          <div className='theme-card-gradient theme-shadow-card theme-border rounded-[28px] border p-7'>
            <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em]'>{featuredLabel}</div>
            <h2 className='theme-text-primary mt-4 text-3xl font-semibold tracking-tight'>{title}</h2>
            <p className='theme-text-secondary mt-4 text-sm leading-7'>{featuredDescription}</p>
          </div>
          <div className='grid gap-5'>
            {entries.map((entry) => (
              <Link
                key={entry.slug}
                href={`/${lang}${basePath}/${entry.slug}`}
                className='theme-surface-secondary theme-shadow-card theme-border block rounded-[28px] border px-6 py-6 transition-transform duration-200 hover:-translate-y-1'
              >
                <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em]'>{entry.eyebrow}</div>
                <h3 className='theme-text-primary mt-3 text-2xl font-semibold tracking-tight'>{entry.title}</h3>
                <p className='theme-text-secondary mt-3 text-sm leading-7'>{entry.summary}</p>
                <div className='theme-text-tertiary mt-5 flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em]'>
                  {entry.updatedAt ? <span>{entry.updatedAt}</span> : null}
                  {entry.publishedAt ? <span>{entry.publishedAt}</span> : null}
                  <span>{entry.readingTime}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
