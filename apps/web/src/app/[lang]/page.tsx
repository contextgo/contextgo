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
        title={validLang === 'zh' ? '继续了解 ContextGo 的核心使用场景' : 'Explore the main ways teams use ContextGo'}
        description={
          validLang === 'zh'
            ? '这些页面分别解释 AI 工作台、远程访问、团队上下文和版本管理，帮助你更快判断 ContextGo 是否适合你的团队。'
            : 'These pages explain the workbench, remote access, team context, and release model so visitors can judge quickly whether ContextGo fits their workflow.'
        }
        pages={featuredPages}
        lang={validLang}
      />
      <FaqSection title={surfaceContent.faqTitle} items={faqItems} />
    </>
  );
}
