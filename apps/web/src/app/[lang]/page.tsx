import type { Metadata } from 'next';
import { getDictionary } from '@/app/dictionaries';
import SeoJsonLd from '@/components/SeoJsonLd';
import { AnswerStrip, FaqSection, IntentCardGrid } from '@/components/seo/SearchIntentSections';
import { getIntentPagesBySlugs, getIntentSurfaceContent, getPageFaqItems } from '@/lib/intentContent';
import {
  buildFaqJsonLd,
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
  const surfaceContent = getIntentSurfaceContent(validLang, 'home');
  const featuredPages = getIntentPagesBySlugs(validLang, [...surfaceContent.intentSlugs]);
  const faqItems = getPageFaqItems(validLang, 'home');

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
          buildFaqJsonLd(faqItems),
        ]}
      />
      <HomeClient dict={dict} lang={validLang} resources={siteContent.resources} />
      <AnswerStrip content={surfaceContent} />
      <IntentCardGrid
        title={validLang === 'zh' ? '从产品入口继续看具体场景' : 'Continue into concrete product scenarios'}
        description={
          validLang === 'zh'
            ? '这些页面把 AI 工作台、远程使用和团队上下文模型拆开讲清楚，方便搜索收录，也方便外部用户快速建立正确认知。'
            : 'These pages explain the workbench, remote access, and shared-context model in answer-first language that works for both search and real buyer understanding.'
        }
        pages={featuredPages}
        lang={validLang}
      />
      <FaqSection title={surfaceContent.faqTitle} items={faqItems} />
    </>
  );
}
