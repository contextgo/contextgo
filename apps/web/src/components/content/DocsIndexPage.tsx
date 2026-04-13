import Link from 'next/link';
import type { DocGroup } from '@/lib/public-content/types';
import DocsShell from './DocsShell';

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
  versionLabel,
  openRepositoryLabel,
  overviewLabel,
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
  versionLabel: string;
  openRepositoryLabel: string;
  overviewLabel: string;
}) {
  const sourceValue =
    source === 'release-repo' ? sourceReleaseLabel.replace('{{version}}', version) : sourceFallbackLabel;

  return (
    <DocsShell
      docsTitle={title}
      overviewHref={`/${lang}/docs`}
      overviewLabel={overviewLabel}
      groups={groups}
      sourceLabel={sourceLabel}
      sourceValue={sourceValue}
      versionLabel={versionLabel}
      version={version}
      repositoryUrl={repositoryUrl}
      openRepositoryLabel={openRepositoryLabel}
    >
      <div className='space-y-6'>
        <div className='theme-panel-gradient theme-shadow-soft theme-border rounded-[32px] border px-7 py-8 md:px-9 md:py-10'>
          <div className='theme-surface-secondary theme-border theme-text-tertiary inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]'>
            {badge}
          </div>
          <h1 className='theme-text-primary mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] md:text-5xl'>
            {title}
          </h1>
          <p className='theme-text-secondary mt-4 max-w-3xl text-base leading-8 md:text-lg'>{description}</p>
          <div className='theme-border mt-6 h-px w-full theme-divider-gradient' />
          <div className='mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]'>
            <div>
              <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em]'>
                {featuredLabel}
              </div>
              <p className='theme-text-secondary mt-3 max-w-3xl text-sm leading-7 md:text-base'>
                {featuredDescription}
              </p>
            </div>
            <div className='theme-surface-secondary theme-border rounded-[22px] border p-4'>
              <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.18em]'>{sourceLabel}</div>
              <div className='theme-text-primary mt-2 text-sm font-semibold'>{sourceValue}</div>
              <div className='theme-text-secondary mt-1 text-sm'>
                {versionLabel}: v{version}
              </div>
            </div>
          </div>
          {versions.length > 0 ? (
            <div className='mt-6 flex flex-wrap gap-2'>
              {versions.map((entry) => (
                <a
                  key={entry.version}
                  href={`${repositoryUrl}/tree/main/site/docs/${entry.version}`}
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

        <div className='space-y-6'>
          {groups.map((group) => (
            <section
              key={group.id}
              className='theme-surface-secondary theme-shadow-card theme-border rounded-[30px] border px-6 py-6 md:px-7'
            >
              <div>
                <h2 className='theme-text-primary text-2xl font-semibold tracking-tight md:text-3xl'>{group.title}</h2>
                <p className='theme-text-secondary mt-3 max-w-3xl text-sm leading-7'>{group.description}</p>
              </div>

              <div className='mt-6 grid gap-4'>
                {group.entries.map((entry) => (
                  <Link
                    key={entry.slug}
                    href={`/${lang}/docs/${entry.slug}`}
                    className='theme-surface-tertiary theme-border block rounded-[24px] border px-5 py-5 transition-transform duration-200 hover:-translate-y-1'
                  >
                    <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start'>
                      <div>
                        <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em]'>
                          {entry.eyebrow}
                        </div>
                        <h3 className='theme-text-primary mt-3 text-xl font-semibold tracking-tight md:text-2xl'>
                          {entry.title}
                        </h3>
                        <p className='theme-text-secondary mt-3 text-sm leading-7'>{entry.summary}</p>
                      </div>
                      <div className='theme-text-tertiary flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] lg:max-w-[180px] lg:justify-end'>
                        {entry.updatedAt ? <span>{entry.updatedAt}</span> : null}
                        {entry.publishedAt ? <span>{entry.publishedAt}</span> : null}
                        <span>{entry.readingTime}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </DocsShell>
  );
}
