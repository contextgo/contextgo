import { getDictionary } from '@/app/dictionaries';
import { getSiteContent } from '@/lib/site-content';
import HomeClient from './HomeClient';

export const runtime = 'edge';

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const [dict, siteContent] = await Promise.all([getDictionary(validLang), Promise.resolve(getSiteContent(validLang))]);

  return <HomeClient dict={dict} lang={validLang} resources={siteContent.resources} />;
}
