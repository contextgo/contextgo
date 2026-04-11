import Link from 'next/link';
import type { DocGroup } from '@/lib/public-content/types';

const getNavItemClass = (active: boolean): string =>
  active
    ? 'theme-surface-tertiary theme-text-primary theme-border block rounded-2xl border px-3 py-2.5 text-sm font-medium'
    : 'theme-text-secondary block rounded-2xl border border-transparent px-3 py-2.5 text-sm transition-colors hover:theme-surface-tertiary hover:theme-text-primary';

export default function DocsSidebar({
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
}: {
  docsTitle: string;
  overviewHref: string;
  overviewLabel: string;
  groups: DocGroup[];
  activeSlug?: string;
  sourceLabel: string;
  sourceValue: string;
  versionLabel: string;
  version: string;
  repositoryUrl: string;
  openRepositoryLabel: string;
}) {
  return (
    <aside className='self-start lg:sticky lg:top-24'>
      <div className='theme-surface-secondary theme-shadow-card theme-border rounded-[28px] border p-4 md:p-5'>
        <div className='px-2'>
          <div className='theme-text-primary text-xl font-semibold tracking-tight'>{docsTitle}</div>
        </div>

        <nav className='mt-5 space-y-5'>
          <div>
            <Link href={overviewHref} className={getNavItemClass(activeSlug === undefined)}>
              {overviewLabel}
            </Link>
          </div>

          {groups.map((group) =>
            group.entries.length > 0 ? (
              <div key={group.id}>
                <div className='theme-text-tertiary px-2 text-[11px] font-semibold uppercase tracking-[0.22em]'>
                  {group.title}
                </div>
                <div className='mt-2 space-y-1'>
                  {group.entries.map((entry) => (
                    <Link
                      key={entry.slug}
                      href={`${overviewHref}/${entry.slug}`}
                      className={getNavItemClass(activeSlug === entry.slug)}
                    >
                      {entry.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </nav>

        <div className='theme-border mt-6 border-t pt-4'>
          <div className='theme-text-tertiary text-[11px] font-semibold uppercase tracking-[0.22em]'>
            {sourceLabel}
          </div>
          <div className='theme-text-primary mt-2 text-sm font-medium'>{sourceValue}</div>
          <div className='theme-text-secondary mt-1 text-sm'>
            {versionLabel}: v{version}
          </div>
          <a
            href={repositoryUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='theme-text-primary mt-4 inline-flex text-sm font-medium underline-offset-4 hover:underline'
          >
            {openRepositoryLabel}
          </a>
        </div>
      </div>
    </aside>
  );
}
