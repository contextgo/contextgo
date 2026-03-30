import { getDictionary } from '@/app/dictionaries';
import ConnectClient from './ConnectClient';

export const runtime = 'edge';

export default async function Connect({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);
  return <ConnectClient dict={dict} />;
}
