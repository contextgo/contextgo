import { getDictionary } from '@/app/dictionaries';
import HomeClient from './HomeClient';

export const runtime = 'edge';

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);

  return <HomeClient dict={dict} lang={validLang} />;
}
