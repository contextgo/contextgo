import type { ReactNode } from 'react';

export default function PageHero({
  badge,
  title,
  description,
  actions,
}: {
  badge: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className='theme-page px-4 py-20'>
      <div className='container-custom'>
        <div className='theme-panel-gradient theme-shadow-soft theme-border rounded-[32px] border px-8 py-10 md:px-10 md:py-12'>
          <div className='theme-surface-secondary theme-border theme-text-tertiary inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]'>
            {badge}
          </div>
          <h1 className='theme-text-primary mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] md:text-6xl'>
            {title}
          </h1>
          <p className='theme-text-secondary mt-4 max-w-3xl text-base leading-8 md:text-lg'>{description}</p>
          {actions ? <div className='mt-8 flex flex-wrap gap-3'>{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}
