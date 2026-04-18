import type { Metadata } from 'next';
import { getDictionary } from '@/app/dictionaries';
import SeoJsonLd from '@/components/SeoJsonLd';
import { AnswerStrip, FaqSection, IntentCardGrid } from '@/components/seo/SearchIntentSections';
import { getIntentPagesBySlugs, getIntentSurfaceContent, getPageFaqItems } from '@/lib/intentContent';
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildPageMetadata, buildWebPageJsonLd } from '@/lib/seo';
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
  const surfaceContent = getIntentSurfaceContent(validLang, 'connect');
  const featuredPages = getIntentPagesBySlugs(validLang, [...surfaceContent.intentSlugs]);
  const faqItems = getPageFaqItems(validLang, 'connect');

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
          buildFaqJsonLd(faqItems),
        ]}
      />
      <ConnectClient dict={dict} />
      <AnswerStrip content={surfaceContent} />
      <IntentCardGrid
        title={
          validLang === 'zh'
            ? '从 connector 继续看上下文与协作'
            : 'Continue from connectors into context and collaboration'
        }
        description={
          validLang === 'zh'
            ? '这些方案页进一步解释 connector 如何进入上下文层，以及多 Agent、团队协作和远程使用为什么都依赖同一套工作模型。'
            : 'These pages explain how connectors feed the context layer and why multi-agent collaboration, remote use, and team memory all depend on the same operating model.'
        }
        pages={featuredPages}
        lang={validLang}
      />
      <FaqSection title={surfaceContent.faqTitle} items={faqItems} />
    </>
  );
}
