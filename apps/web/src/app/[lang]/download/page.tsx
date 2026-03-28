import { getDictionary } from '@/app/dictionaries';
import DownloadClient from './DownloadClient';

export const runtime = 'edge';

export default async function Download({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);
  return <DownloadClient dict={dict} />;
}