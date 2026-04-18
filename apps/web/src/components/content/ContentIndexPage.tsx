import Link from 'next/link';
import type { PublicArticleMeta } from '@/lib/public-content/types';
import { getBlogArticleSupplement, getBlogJournalCopy } from '@/lib/site-content/blogEditorial';

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
  entries: PublicArticleMeta[];
  lang: string;
  basePath: '/docs' | '/blog';
}) {
  const validLang = lang === 'zh' ? 'zh' : 'en';
  const [featuredEntry, ...supportingEntries] = entries;
  const copy = getBlogJournalCopy(validLang);
  const railLabel = validLang === 'zh' ? '刊物导读' : 'Journal note';

  return (
    <section className='theme-page px-4 pb-24 pt-14 md:pb-28 md:pt-16'>
      <div className='container-custom max-w-[1180px]'>
        <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-start'>
          <div>
            <section className='theme-border border-y py-6 md:py-7'>
              <div className='editorial-kicker'>{badge}</div>
              <h1 className='theme-text-primary mt-4 max-w-4xl text-[1.9rem] font-semibold tracking-[-0.045em] md:text-[2.75rem] md:leading-[1]'>
                {title}
              </h1>
              <p className='theme-text-secondary mt-4 max-w-3xl text-[0.96rem] leading-8 md:max-w-2xl md:text-[0.98rem] md:leading-8'>
                {description}
              </p>
              <div className='theme-text-tertiary mt-5 flex flex-wrap gap-x-5 gap-y-3 text-[10px] font-semibold uppercase tracking-[0.24em]'>
                <span>3 {validLang === 'zh' ? '篇核心长文' : 'core essays'}</span>
                <span>{validLang === 'zh' ? '产品模型' : 'Product model'}</span>
                <span>{validLang === 'zh' ? '远程产品' : 'Remote product'}</span>
                <span>{validLang === 'zh' ? '发布运维' : 'Release operations'}</span>
              </div>
            </section>

            <section className='pt-7 md:pt-8'>
              <div className='mb-6'>
                <div className='editorial-kicker'>{featuredLabel}</div>
                <h2 className='theme-text-primary mt-3 max-w-4xl text-[1.38rem] font-semibold tracking-[-0.035em] md:text-[1.7rem] md:leading-[1.15]'>
                  {featuredDescription}
                </h2>
              </div>

              {featuredEntry ? (
                <FeatureArticleCard
                  entry={featuredEntry}
                  href={`/${lang}${basePath}/${featuredEntry.slug}`}
                  cardLabel={copy.featuredCardLabel}
                  pointsLabel={copy.featurePointsLabel}
                  audienceLabel={copy.audienceLabel}
                  points={getBlogArticleSupplement(validLang, featuredEntry.slug).cardPoints}
                  audience={getBlogArticleSupplement(validLang, featuredEntry.slug).audience}
                />
              ) : null}

              <div className='mt-8 space-y-7'>
                {supportingEntries.map((entry) => {
                  const supplement = getBlogArticleSupplement(validLang, entry.slug);
                  return (
                    <CompactArticleCard
                      key={entry.slug}
                      entry={entry}
                      href={`/${lang}${basePath}/${entry.slug}`}
                      pointsLabel={copy.featurePointsLabel}
                      audienceLabel={copy.audienceLabel}
                      points={supplement.cardPoints.slice(0, 1)}
                      audience={supplement.audience}
                    />
                  );
                })}
              </div>
            </section>
          </div>

          <aside className='xl:pt-1'>
            <div className='space-y-8 xl:sticky xl:top-20'>
              <div className='theme-border border-t pt-5'>
                <div className='editorial-kicker'>{railLabel}</div>
                <h2 className='theme-text-primary mt-4 text-[1.05rem] font-semibold tracking-[-0.025em]'>
                  {copy.identityTitle}
                </h2>
                <p className='theme-text-secondary mt-3 text-sm leading-7'>{copy.identityBody}</p>

                <div className='theme-border mt-5 border-t pt-5'>
                  <div className='editorial-kicker'>{copy.principlesTitle}</div>
                  <div className='mt-4 space-y-3'>
                    {copy.principles.map((item) => (
                      <p key={item} className='theme-text-secondary text-sm leading-7'>
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className='theme-border border-t pt-5'>
                <div className='editorial-kicker'>{copy.themesTitle}</div>
                <div className='mt-4 space-y-4'>
                  {copy.themes.map((theme) => (
                    <div key={theme.title}>
                      <div className='theme-text-primary text-base font-semibold'>{theme.title}</div>
                      <p className='theme-text-secondary mt-2 text-sm leading-7'>{theme.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className='theme-border border-t pt-5'>
                <div className='editorial-kicker'>{copy.pathLabel}</div>
                <h3 className='theme-text-primary mt-4 text-lg font-semibold tracking-[-0.03em]'>{copy.pathTitle}</h3>
                <p className='theme-text-secondary mt-3 text-sm leading-7'>{copy.pathBody}</p>

                <div className='mt-6 space-y-5'>
                  {copy.pathItems.map((item) => {
                    const entry = entries.find((candidate) => candidate.slug === item.slug);
                    if (!entry) {
                      return null;
                    }

                    return (
                      <Link
                        key={item.slug}
                        href={`/${lang}${basePath}/${item.slug}`}
                        className='block transition-opacity hover:opacity-80'
                      >
                        <div className='theme-text-tertiary text-[10px] font-semibold uppercase tracking-[0.24em]'>
                          {item.step}
                        </div>
                        <div className='theme-text-primary mt-2 text-base font-semibold leading-6'>{entry.title}</div>
                        <p className='theme-text-secondary mt-2 text-sm leading-7'>{item.body}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function FeatureArticleCard({
  entry,
  href,
  cardLabel,
  pointsLabel,
  audienceLabel,
  points,
  audience,
}: {
  entry: PublicArticleMeta;
  href: string;
  cardLabel: string;
  pointsLabel: string;
  audienceLabel: string;
  points: string[];
  audience: string;
}) {
  return (
    <Link href={href} className='theme-border block border-y py-7 transition-opacity duration-200 hover:opacity-85'>
      <div className='theme-text-tertiary flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.24em]'>
        <span>{cardLabel}</span>
        <span>{entry.eyebrow}</span>
        {entry.publishedAt ? <span>{entry.publishedAt}</span> : null}
        <span>{entry.readingTime}</span>
      </div>
      <h3 className='theme-text-primary mt-4 max-w-3xl text-[1.7rem] font-semibold tracking-[-0.045em] md:text-[2.45rem] md:leading-[1.02]'>
        {entry.title}
      </h3>
      <p className='theme-text-secondary mt-4 max-w-2xl text-[0.98rem] leading-8'>{entry.summary}</p>

      <div className='mt-7 grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]'>
        <div>
          <div className='editorial-kicker'>{pointsLabel}</div>
          <div className='mt-4 space-y-2.5'>
            {points.map((point) => (
              <p key={point} className='theme-text-secondary text-sm leading-7'>
                {point}
              </p>
            ))}
          </div>
        </div>
        <div className='theme-border border-l pl-5'>
          <div className='editorial-kicker'>{audienceLabel}</div>
          <p className='theme-text-primary mt-3 text-sm font-medium leading-7'>{audience}</p>
        </div>
      </div>
    </Link>
  );
}

function CompactArticleCard({
  entry,
  href,
  pointsLabel,
  audienceLabel,
  points,
  audience,
}: {
  entry: PublicArticleMeta;
  href: string;
  pointsLabel: string;
  audienceLabel: string;
  points: string[];
  audience: string;
}) {
  return (
    <Link href={href} className='theme-border block border-t pt-7 transition-opacity duration-200 hover:opacity-85'>
      <div className='theme-text-tertiary flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.24em]'>
        <span>{entry.eyebrow}</span>
        {entry.publishedAt ? <span>{entry.publishedAt}</span> : null}
        <span>{entry.readingTime}</span>
      </div>
      <h3 className='theme-text-primary mt-4 max-w-3xl text-[1.38rem] font-semibold tracking-[-0.035em] md:text-[1.7rem] md:leading-[1.15]'>
        {entry.title}
      </h3>
      <p className='theme-text-secondary mt-3 max-w-2xl text-sm leading-7'>{entry.summary}</p>

      <div className='mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]'>
        <div>
          <div className='editorial-kicker'>{pointsLabel}</div>
          <div className='mt-3 space-y-2'>
            {points.map((point) => (
              <p key={point} className='theme-text-secondary text-sm leading-7'>
                {point}
              </p>
            ))}
          </div>
        </div>
        <div className='theme-border border-l pl-5'>
          <div className='editorial-kicker'>{audienceLabel}</div>
          <p className='theme-text-primary mt-3 text-sm font-medium leading-7'>{audience}</p>
        </div>
      </div>
    </Link>
  );
}
