import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getDictionary } from '@/app/dictionaries';

export const runtime = 'edge';

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const validLang = (lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
  const dict = await getDictionary(validLang);

  return (
    <>
      <Navbar dict={dict.navbar} lang={validLang} />

      <main className='flex-grow pt-16'>{children}</main>

      <Footer dict={dict.footer} lang={validLang} />
    </>
  );
}
