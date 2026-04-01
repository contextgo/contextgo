import Link from 'next/link';
import PageHero from './PageHero';
import type { DocGroup } from '@/lib/site-content';

export default function DocsIndexPage({
  badge,
  title,
  description,
  featuredLabel,
  featuredDescription,
  groups,
  lang,
  version,
  source,
  versions,
  repositoryUrl,
  sourceLabel,
  sourceReleaseLabel,
  sourceFallbackLabel,
  openRepositoryLabel,
}: {
  badge: string;
  title: string;
  description: string;
  featuredLabel: string;
  featuredDescription: string;
  groups: DocGroup[];
  lang: string;
  version: string;
  source: 'release-repo' | 'site-fallback';
  versions: Array<{ version: string; exportedAt: string }>;
  repositoryUrl: string;
  sourceLabel: string;
  sourceReleaseLabel: string;
  sourceFallbackLabel: string;
  openRepositoryLabel: string;
}) {
  return (
    <>
      <PageHero badge={badge} title={title} description={description} />

      <section className='theme-page-muted px-4 py-18'>
        <div className='container-custom'>
          <div className='theme-card-gradient theme-shadow-soft theme-border rounded-[30px] border p-7 md:p-8'>
            <div className='flex flex-col gap-5 md:flex-row md:items-start md:justify-between'>
              <div>
                <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em]'>
                  {featuredLabel}
                </div>
                <h2 className='theme-text-primary mt-4 text-3xl font-semibold tracking-tight md:text-4xl'>{title}</h2>
                <p className='theme-text-secondary mt-4 max-w-3xl text-sm leading-7 md:text-base'>
                  {featuredDescription}
                </p>
              </div>
              <div className='theme-surface-secondary theme-border flex min-w-[240px] flex-col gap-3 rounded-[22px] border p-4'>
                <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.18em]'>
                  {sourceLabel}
                </div>
                <div className='theme-text-primary text-sm font-semibold'>
                  {source === 'release-repo' ? sourceReleaseLabel.replace('{{version}}', version) : sourceFallbackLabel}
                </div>
                <a
                  href={repositoryUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='theme-text-primary text-sm font-medium underline-offset-4 hover:underline'
                >
                  {openRepositoryLabel}
                </a>
              </div>
            </div>

            {versions.length > 0 ? (
              <div className='mt-6 flex flex-wrap gap-2'>
                {versions.map((entry) => (
                  <a
                    key={entry.version}
                    href={`${repositoryUrl}/tree/main/docs/${entry.version}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='theme-surface-secondary theme-border theme-text-secondary rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:theme-text-primary'
                  >
                    v{entry.version}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className='theme-page px-4 pb-24'>
        <div className='container-custom space-y-10'>
          {groups.map((group) => (
            <section key={group.id}>
              <div className='mb-5'>
                <div>
                  <h3 className='theme-text-primary text-3xl font-semibold tracking-tight'>{group.title}</h3>
                  <p className='theme-text-secondary mt-2 max-w-3xl text-sm leading-7'>{group.description}</p>
                </div>
              </div>

              <div className='grid gap-5 lg:grid-cols-2'>
                {group.entries.map((entry) => (
                  <Link
                    key={entry.slug}
                    href={`/${lang}/docs/${entry.slug}`}
                    className='theme-surface-secondary theme-shadow-card theme-border block rounded-[28px] border px-6 py-6 transition-transform duration-200 hover:-translate-y-1'
                  >
                    <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em]'>
                      {entry.eyebrow}
                    </div>
                    <h4 className='theme-text-primary mt-3 text-2xl font-semibold tracking-tight'>{entry.title}</h4>
                    <p className='theme-text-secondary mt-3 text-sm leading-7'>{entry.summary}</p>
                    <div className='theme-text-tertiary mt-5 flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em]'>
                      {entry.updatedAt ? <span>{entry.updatedAt}</span> : null}
                      {entry.publishedAt ? <span>{entry.publishedAt}</span> : null}
                      <span>{entry.readingTime}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
