import type { Metadata } from 'next';
import { getDictionary } from '@/app/dictionaries';
import { buildPageMetadata } from '@/lib/seo';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);

  return buildPageMetadata({
    locale: validLang,
    pathname: '/terms',
    title: dict.legal.terms.title,
    description: dict.legal.terms.sections[0]?.content[0] || dict.legal.terms.title,
  });
}

export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);
  const terms = dict.legal.terms;

  return (
    <section className='theme-page py-20'>
      <div className='container-custom'>
        <div className='mx-auto max-w-3xl'>
          <h1 className='theme-text-primary text-3xl font-bold tracking-tight md:text-4xl'>{terms.title}</h1>
          <p className='theme-text-tertiary mt-3 text-sm'>{terms.lastUpdated}</p>

          <div className='mt-10 space-y-8'>
            {terms.sections.map((section) => (
              <section key={section.heading}>
                <h2 className='theme-text-primary text-xl font-semibold'>{section.heading}</h2>
                <div className='theme-text-secondary mt-3 space-y-3 leading-7'>
                  {section.content.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
