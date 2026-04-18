import type { Metadata } from 'next';
import { getDictionary } from '@/app/dictionaries';
import { buildPageMetadata } from '@/lib/seo';
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
  return <ConnectClient dict={dict} />;
}
