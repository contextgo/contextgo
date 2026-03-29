import { getDictionary } from '@/app/dictionaries';
import DownloadCenter from '@/components/DownloadCenter';
import { getReleaseSnapshot } from '@/lib/releases';

export const runtime = 'edge';
export const revalidate = 300;

export default async function Download({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const [dict, snapshot] = await Promise.all([getDictionary(validLang), getReleaseSnapshot(validLang)]);

  return <DownloadCenter dict={dict} lang={validLang} snapshot={snapshot} />;
}
