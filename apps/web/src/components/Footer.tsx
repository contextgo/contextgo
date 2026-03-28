import Link from 'next/link';
import { Dictionary } from '@/app/types';

export default function Footer({ dict, lang }: { dict: Dictionary['footer'], lang: string }) {
  return (
    <footer className="bg-brand-light py-12 border-t border-brand-gray">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <span className="font-bold text-lg">ContextGo</span>
            <p className="text-sm text-gray-500 mt-1">{dict.tagline}</p>
          </div>
          <div className="flex gap-6 flex-wrap justify-center">
            <Link href={`/${lang}`} className="text-sm text-gray-600 hover:text-black">{dict.product}</Link>
            <Link href={`/${lang}/connect`} className="text-sm text-gray-600 hover:text-black">{dict.connect}</Link>
            <Link href={`/${lang}/download`} className="text-sm text-gray-600 hover:text-black">{dict.download}</Link>
            <Link href={`/${lang}/privacy`} className="text-sm text-gray-600 hover:text-black">{dict.privacy}</Link>
            <Link href={`/${lang}/terms`} className="text-sm text-gray-600 hover:text-black">{dict.terms}</Link>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} {dict.rights}
        </div>
      </div>
    </footer>
  );
}
