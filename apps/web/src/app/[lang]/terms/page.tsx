import type { Metadata } from 'next';
import { getDictionary } from '@/app/dictionaries';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);

  return {
    title: `${dict.legal.terms.title} | ContextGo`,
    description: dict.legal.terms.title,
  };
}

export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);
  const terms = dict.legal.terms;

  return (
    <section className="bg-white py-20">
      <div className="container-custom">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{terms.title}</h1>
          <p className="mt-3 text-sm text-gray-500">{terms.lastUpdated}</p>

          <div className="mt-10 space-y-8">
            {terms.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-semibold text-gray-900">{section.heading}</h2>
                <div className="mt-3 space-y-3 text-gray-700 leading-7">
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
