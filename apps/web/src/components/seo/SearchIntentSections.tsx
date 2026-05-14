import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { IntentFaqItem, IntentPage, IntentSurfaceContent } from '@/lib/intentContent';

export function AnswerStrip({ content }: { content: IntentSurfaceContent }) {
  return (
    <section className='theme-page px-4 py-20'>
      <div className='container-custom max-w-[1180px]'>
        <div className='theme-panel-gradient theme-shadow-soft theme-border rounded-[30px] border px-8 py-8 md:px-10 md:py-10'>
          <div className='editorial-kicker'>{content.eyebrow}</div>
          <h2 className='theme-text-primary mt-4 max-w-4xl text-[1.8rem] font-semibold tracking-[-0.04em] md:text-[2.65rem] md:leading-[1.02]'>
            {content.title}
          </h2>
          <p className='theme-text-secondary mt-4 max-w-3xl text-[0.98rem] leading-8'>{content.description}</p>

          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            {content.points.map((point) => (
              <div
                key={point}
                className='theme-surface-secondary theme-shadow-card theme-border rounded-[22px] border px-5 py-5'
              >
                <div className='theme-text-primary flex items-start gap-3 text-sm font-medium leading-7'>
                  <CheckCircle2 size={18} className='mt-1 shrink-0' />
                  <span>{point}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function IntentCardGrid({
  title,
  description,
  pages,
  lang,
}: {
  title: string;
  description: string;
  pages: IntentPage[];
  lang: string;
}) {
  return (
    <section className='theme-page px-4 pb-20'>
      <div className='container-custom max-w-[1180px]'>
        <div className='theme-border border-t pt-7'>
          <div className='editorial-kicker'>{lang === 'zh' ? '继续阅读' : 'Keep exploring'}</div>
          <h2 className='theme-text-primary mt-4 max-w-4xl text-[1.7rem] font-semibold tracking-[-0.04em] md:text-[2.3rem]'>
            {title}
          </h2>
          <p className='theme-text-secondary mt-4 max-w-3xl text-[0.97rem] leading-8'>{description}</p>
        </div>

        <div className='mt-8 grid gap-5 lg:grid-cols-3'>
          {pages.map((page) => (
            <Link
              key={page.slug}
              href={`/${lang}/solutions/${page.slug}`}
              className='theme-surface-secondary theme-shadow-card theme-border group rounded-[26px] border px-6 py-6 transition-transform duration-200 hover:-translate-y-1'
            >
              <div className='theme-text-tertiary text-[10px] font-semibold uppercase tracking-[0.24em]'>
                {page.eyebrow}
              </div>
              <h3 className='theme-text-primary mt-3 text-[1.4rem] font-semibold tracking-[-0.035em]'>{page.title}</h3>
              <p className='theme-text-secondary mt-3 text-sm leading-7'>{page.summary}</p>
              <div className='theme-text-primary mt-5 inline-flex items-center gap-2 text-sm font-medium'>
                <span>{lang === 'zh' ? '查看方案' : 'View solution'}</span>
                <ArrowRight size={16} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ title, items }: { title: string; items: IntentFaqItem[] }) {
  return (
    <section className='theme-page px-4 pb-24'>
      <div className='container-custom max-w-[1180px]'>
        <div className='theme-border border-t pt-7'>
          <div className='editorial-kicker'>FAQ</div>
          <h2 className='theme-text-primary mt-4 text-[1.7rem] font-semibold tracking-[-0.04em] md:text-[2.25rem]'>
            {title}
          </h2>
        </div>

        <div className='mt-8 grid gap-4'>
          {items.map((item) => (
            <div
              key={item.question}
              className='theme-surface-secondary theme-shadow-card theme-border rounded-[24px] border px-6 py-6'
            >
              <h3 className='theme-text-primary text-lg font-semibold tracking-[-0.02em]'>{item.question}</h3>
              <p className='theme-text-secondary mt-3 text-sm leading-7'>{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
