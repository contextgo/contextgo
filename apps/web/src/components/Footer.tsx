import Link from 'next/link';
import { Dictionary } from '@/app/types';

export default function Footer({ dict, lang }: { dict: Dictionary['footer']; lang: string }) {
  return (
    <footer className='theme-page-muted theme-border border-t py-12'>
      <div className='container-custom'>
        <div className='flex flex-col items-center justify-between md:flex-row'>
          <div className='mb-4 md:mb-0'>
            <span className='text-lg font-bold'>ContextGo</span>
            <p className='theme-text-secondary mt-1 text-sm'>{dict.tagline}</p>
          </div>
          <div className='flex flex-wrap justify-center gap-6'>
            <Link href={`/${lang}`} className='theme-text-secondary hover:theme-text-primary text-sm transition-colors'>
              {dict.product}
            </Link>
            <Link
              href={`/${lang}/connect`}
              className='theme-text-secondary hover:theme-text-primary text-sm transition-colors'
            >
              {dict.connect}
            </Link>
            <Link
              href={`/${lang}/download`}
              className='theme-text-secondary hover:theme-text-primary text-sm transition-colors'
            >
              {dict.download}
            </Link>
            <Link
              href={`/${lang}/privacy`}
              className='theme-text-secondary hover:theme-text-primary text-sm transition-colors'
            >
              {dict.privacy}
            </Link>
            <Link
              href={`/${lang}/terms`}
              className='theme-text-secondary hover:theme-text-primary text-sm transition-colors'
            >
              {dict.terms}
            </Link>
          </div>
        </div>
        <div className='theme-border theme-text-tertiary mt-8 border-t pt-8 text-center text-sm'>
          © {new Date().getFullYear()} {dict.rights}
        </div>
      </div>
    </footer>
  );
}
