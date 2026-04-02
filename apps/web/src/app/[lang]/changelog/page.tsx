import Link from 'next/link';
import PageHero from '@/components/content/PageHero';
import { getReleaseSnapshot } from '@/lib/releases';
import { getSiteContent } from '@/lib/site-content';

export const runtime = 'edge';
export const revalidate = 300;

export default async function ChangelogPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const [siteContent, snapshot] = await Promise.all([
    Promise.resolve(getSiteContent(validLang)),
    getReleaseSnapshot(validLang),
  ]);

  return (
    <>
      <PageHero
        badge={siteContent.changelog.badge}
        title={siteContent.changelog.title}
        description={siteContent.changelog.description}
        actions={
          <>
            <Link
              href={`/${validLang}/download`}
              className='theme-button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-colors'
            >
              {siteContent.labels.openDownloadCenter}
            </Link>
            <a
              href={snapshot.releaseUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='theme-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-colors'
            >
              {siteContent.labels.openReleasePage}
            </a>
          </>
        }
      />

      <section className='theme-page-muted px-4 py-18'>
        <div className='container-custom grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]'>
          <div className='theme-surface-secondary theme-shadow-card theme-border rounded-[28px] border p-7'>
            <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em]'>
              {siteContent.changelog.summaryTitle}
            </div>
            <p className='theme-text-secondary mt-4 text-base leading-8'>{siteContent.changelog.summaryBody}</p>

            <div className='theme-surface-tertiary theme-border mt-6 grid gap-4 rounded-[22px] border p-5 md:grid-cols-2'>
              <Metric
                label={siteContent.labels.latestRelease}
                value={snapshot.version ?? (validLang === 'zh' ? '尚未发布' : 'Awaiting first release')}
              />
              <Metric label={siteContent.labels.releaseSource} value={snapshot.repository} />
            </div>
          </div>

          <div className='theme-card-gradient theme-shadow-card theme-border rounded-[28px] border p-7'>
            <div className='theme-text-primary text-xl font-semibold'>{siteContent.changelog.operationsTitle}</div>
            <ul className='theme-text-secondary mt-4 list-disc space-y-3 pl-5 text-sm leading-7'>
              {siteContent.changelog.operations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className='container-custom mt-6 grid gap-6 lg:grid-cols-3'>
          {siteContent.changelog.notes.map((item) => (
            <div key={item} className='theme-panel-gradient theme-shadow-card theme-border rounded-[24px] border p-6'>
              <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em]'>
                {siteContent.changelog.notesTitle}
              </div>
              <div className='theme-text-primary mt-3 text-lg font-semibold'>{item}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.18em]'>{label}</div>
      <div className='theme-text-primary mt-2 text-base font-semibold'>{value}</div>
    </div>
  );
}
