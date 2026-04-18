import type { Metadata } from 'next';
import { getDictionary } from '@/app/dictionaries';
import DownloadCenter from '@/components/DownloadCenter';
import SeoJsonLd from '@/components/SeoJsonLd';
import { AnswerStrip, FaqSection, IntentCardGrid } from '@/components/seo/SearchIntentSections';
import { getIntentPagesBySlugs, getIntentSurfaceContent, getPageFaqItems } from '@/lib/intentContent';
import { getReleaseSnapshot } from '@/lib/releases';
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildPageMetadata, buildSoftwareApplicationJsonLd } from '@/lib/seo';

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
  const surfaceContent = getIntentSurfaceContent(validLang, 'download');
  const featuredPages = getIntentPagesBySlugs(validLang, [...surfaceContent.intentSlugs]);
  const faqItems = getPageFaqItems(validLang, 'download');

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
          buildFaqJsonLd(faqItems),
        ]}
      />
      <DownloadCenter dict={dict} lang={validLang} snapshot={snapshot} />
      <AnswerStrip content={surfaceContent} />
      <IntentCardGrid
        title={validLang === 'zh' ? '围绕安装和发布继续展开' : 'Continue into install and release decision pages'}
        description={
          validLang === 'zh'
            ? '这些页面把下载、远程使用和 release 事实来源拆开讲清楚，方便用户在安装前先完成正确判断。'
            : 'These pages help users make the right install decision by clarifying remote use, release truth, and the broader product model before they download.'
        }
        pages={featuredPages}
        lang={validLang}
      />
      <FaqSection title={surfaceContent.faqTitle} items={faqItems} />
    </>
  );
}
