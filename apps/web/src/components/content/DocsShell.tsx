import type { ReactNode } from 'react';
import type { DocGroup } from '@/lib/public-content/types';
import DocsSidebar from './DocsSidebar';

export default function DocsShell({
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
  children,
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
  children: ReactNode;
}) {
  return (
    <section className='theme-page-muted min-h-[calc(100vh-4rem)] px-4 pb-20 pt-24'>
      <div className='container-custom grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]'>
        <DocsSidebar
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
        />
        <div className='min-w-0'>{children}</div>
      </div>
    </section>
  );
}
