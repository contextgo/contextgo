import type { Metadata } from 'next';
import { getDictionary } from '@/app/dictionaries';
import SeoJsonLd from '@/components/SeoJsonLd';
import { buildBreadcrumbJsonLd, buildPageMetadata, buildWebPageJsonLd } from '@/lib/seo';
import ConnectClient from './ConnectClient';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);

  return buildPageMetadata({
    locale: validLang,
    pathname: '/connect',
    title: dict.connect.title,
    description: dict.connect.description,
  });
}

export default async function Connect({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);

  return (
    <>
      <SeoJsonLd
        data={[
          buildWebPageJsonLd({
            locale: validLang,
            pathname: '/connect',
            name: dict.connect.title,
            description: dict.connect.description,
          }),
          buildBreadcrumbJsonLd(validLang, [
            { name: 'ContextGo', pathname: '' },
            { name: dict.connect.title, pathname: '/connect' },
          ]),
        ]}
      />
      <ConnectClient dict={dict} />
    </>
  );
}
