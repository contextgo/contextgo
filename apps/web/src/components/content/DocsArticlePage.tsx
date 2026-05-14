import Link from 'next/link';
import type { DocGroup, PublicArticle, PublicArticleMeta } from '@/lib/public-content/types';
import DocsShell from './DocsShell';

type MetaItem = {
  label: string;
  value: string;
};

type ActionItem = {
  href: string;
  label: string;
};

const NavCard = ({
  entry,
  label,
  align,
  hrefPrefix,
}: {
  entry: PublicArticleMeta;
  label: string;
  align: 'left' | 'right';
  hrefPrefix: string;
}) => (
  <Link
    href={`${hrefPrefix}/${entry.slug}`}
    className='theme-surface-secondary theme-shadow-card theme-border block rounded-[24px] border px-5 py-5 transition-transform duration-200 hover:-translate-y-1'
  >
    <div
      className={`theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em] ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {label}
    </div>
    <div
      className={`theme-text-primary mt-3 text-xl font-semibold tracking-tight ${align === 'right' ? 'text-right' : ''}`}
    >
      {entry.title}
    </div>
    <p className={`theme-text-secondary mt-2 text-sm leading-7 ${align === 'right' ? 'text-right' : ''}`}>
      {entry.summary}
    </p>
  </Link>
);

export default function DocsArticlePage({
  article,
  meta,
  docsTitle,
  overviewHref,
  overviewLabel,
  groups,
  activeSlug,
  sourceLabel,
  sourceValue,
  versionLabel,
  version,
  repositoryUrl,
  openRepositoryLabel,
  backLabel,
  primaryAction,
  secondaryAction,
  openVersionedDocsLabel,
  previousEntry,
  nextEntry,
  previousPageLabel,
  nextPageLabel,
}: {
  article: PublicArticle;
  meta: MetaItem[];
  docsTitle: string;
  overviewHref: string;
  overviewLabel: string;
  groups: DocGroup[];
  activeSlug: string;
  sourceLabel: string;
  sourceValue: string;
  versionLabel: string;
  version: string;
  repositoryUrl: string;
  openRepositoryLabel: string;
  backLabel: string;
  primaryAction: ActionItem;
  secondaryAction: ActionItem;
  openVersionedDocsLabel: string;
  previousEntry: PublicArticleMeta | null;
  nextEntry: PublicArticleMeta | null;
  previousPageLabel: string;
  nextPageLabel: string;
}) {
  return (
    <DocsShell
      docsTitle={docsTitle}
      overviewHref={overviewHref}
      overviewLabel={overviewLabel}
      groups={groups}
      activeSlug={activeSlug}
      sourceLabel={sourceLabel}
      sourceValue={sourceValue}
      versionLabel={versionLabel}
      version={version}
      repositoryUrl={repositoryUrl}
      openRepositoryLabel={openRepositoryLabel}
    >
      <div className='space-y-6'>
        <div className='theme-panel-gradient theme-shadow-soft theme-border rounded-[32px] border px-7 py-8 md:px-9 md:py-10'>
          <Link href={overviewHref} className='theme-text-tertiary text-sm font-medium hover:theme-text-primary'>
            {backLabel}
          </Link>
          <div className='theme-text-tertiary mt-5 text-xs font-semibold uppercase tracking-[0.22em]'>
            {article.eyebrow}
          </div>
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

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center'>
          <div className='theme-surface-secondary theme-shadow-card theme-border rounded-[24px] border px-5 py-4'>
            <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em]'>{sourceLabel}</div>
            <div className='theme-text-primary mt-2 text-sm font-medium'>{sourceValue}</div>
            <div className='theme-text-secondary mt-1 text-sm'>
              {versionLabel}: v{version}
            </div>
          </div>
          <div className='flex flex-wrap gap-3'>
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
            <a
              href={repositoryUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='theme-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-colors'
            >
              {openVersionedDocsLabel}
            </a>
          </div>
        </div>

        <article className='theme-surface-secondary theme-shadow-card theme-border rounded-[30px] border px-7 py-7 md:px-9 md:py-9'>
          <div
            className='content-markdown theme-text-secondary text-base leading-8'
            dangerouslySetInnerHTML={{ __html: article.html }}
          />
        </article>

        {previousEntry || nextEntry ? (
          <div className='grid gap-4 md:grid-cols-2'>
            {previousEntry ? (
              <NavCard entry={previousEntry} label={previousPageLabel} align='left' hrefPrefix={overviewHref} />
            ) : (
              <div />
            )}
            {nextEntry ? (
              <NavCard entry={nextEntry} label={nextPageLabel} align='right' hrefPrefix={overviewHref} />
            ) : null}
          </div>
        ) : null}
      </div>
    </DocsShell>
  );
}
