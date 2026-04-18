import type { Metadata } from 'next';
import { getDictionary } from '@/app/dictionaries';
import SeoJsonLd from '@/components/SeoJsonLd';
import {
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildSoftwareApplicationJsonLd,
  buildWebsiteJsonLd,
} from '@/lib/seo';
import { getSiteContent } from '@/lib/site-content';
import HomeClient from './HomeClient';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);
  const title = `${dict.hero.title_start} ${dict.hero.title_end}`.replace(/\s+/g, ' ').trim();

  return buildPageMetadata({
    locale: validLang,
    pathname: '',
    title,
    description: dict.hero.description,
  });
}

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const [dict, siteContent] = await Promise.all([getDictionary(validLang), Promise.resolve(getSiteContent(validLang))]);

  return (
    <>
      <SeoJsonLd
        data={[
          buildOrganizationJsonLd(),
          buildWebsiteJsonLd(),
          buildSoftwareApplicationJsonLd({
            locale: validLang,
            pathname: '',
            name: 'ContextGo',
            description: dict.hero.description,
          }),
        ]}
      />
      <HomeClient dict={dict} lang={validLang} resources={siteContent.resources} />
    </>
  );
}
