import type { Metadata } from 'next';
import { getDictionary } from '@/app/dictionaries';
import DownloadCenter from '@/components/DownloadCenter';
import SeoJsonLd from '@/components/SeoJsonLd';
import { getReleaseSnapshot } from '@/lib/releases';
import { buildBreadcrumbJsonLd, buildPageMetadata, buildSoftwareApplicationJsonLd } from '@/lib/seo';

export const runtime = 'edge';
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);

  return buildPageMetadata({
    locale: validLang,
    pathname: '/download',
    title: dict.download.title,
    description: dict.download.description,
  });
}

export default async function Download({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const [dict, snapshot] = await Promise.all([getDictionary(validLang), getReleaseSnapshot(validLang)]);

  return (
    <>
      <SeoJsonLd
        data={[
          buildSoftwareApplicationJsonLd({
            locale: validLang,
            pathname: '/download',
            name: 'ContextGo',
            description: dict.download.description,
          }),
          buildBreadcrumbJsonLd(validLang, [
            { name: 'ContextGo', pathname: '' },
            { name: dict.download.title, pathname: '/download' },
          ]),
        ]}
      />
      <DownloadCenter dict={dict} lang={validLang} snapshot={snapshot} />
    </>
  );
}
