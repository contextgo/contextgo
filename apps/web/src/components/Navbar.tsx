'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { Dictionary } from '@/app/types';
import { Github } from 'lucide-react';

export default function Navbar({ dict, lang }: { dict: Dictionary['navbar']; lang: string }) {
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    if (!pathname) return `/${newLocale}`;
    const segments = pathname.split('/');
    segments[1] = newLocale;
    return segments.join('/');
  };

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className='fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-brand-gray'
    >
      <div className='container-custom flex items-center justify-between h-16'>
        <Link href={`/${lang}`} className='flex items-center'>
          <div className='hover:opacity-80 transition-opacity'>
            <Image
              src='/logo.png'
              alt='ContextGo Logo'
              width={128}
              height={40}
              className='object-contain object-left'
              priority
            />
          </div>
        </Link>
        <div className='hidden md:flex items-center gap-6'>
          <Link href={`/${lang}`} className='text-sm font-medium hover:text-gray-600 transition-colors'>
            {dict.product}
          </Link>
          <Link href={`/${lang}/connect`} className='text-sm font-medium hover:text-gray-600 transition-colors'>
            {dict.connect}
          </Link>
          <Link
            href={`/${lang}/download`}
            className='px-4 py-2 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors'
          >
            {dict.download}
          </Link>

          <div className='flex gap-2 text-sm font-medium border-l pl-4 border-gray-300'>
            <Link
              href={switchLocale('en')}
              className={lang === 'en' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}
            >
              EN
            </Link>
            <Link
              href={switchLocale('zh')}
              className={lang === 'zh' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}
            >
              中
            </Link>
          </div>

          <a
            href='https://github.com/contextgo/contextgo'
            target='_blank'
            rel='noopener noreferrer'
            className='text-gray-500 hover:text-black transition-colors'
            title='GitHub'
          >
            <Github size={20} />
          </a>
        </div>
      </div>
    </motion.nav>
  );
}
