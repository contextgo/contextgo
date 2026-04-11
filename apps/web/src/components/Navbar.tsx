'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { Github } from 'lucide-react';
import type { Dictionary } from '@/app/types';
import ThemeToggle from '@/components/ThemeToggle';

const DEFAULT_GITHUB_URL = 'https://github.com/contextgo';

export default function Navbar({ dict, lang }: { dict: Dictionary['navbar']; lang: string }) {
  const pathname = usePathname();
  const githubUrl = process.env.NEXT_PUBLIC_CONTEXTGO_GITHUB_URL || DEFAULT_GITHUB_URL;
  const isActivePath = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  const linkClass = (href: string, emphasized = false) => {
    if (emphasized) {
      return 'theme-button-primary rounded-full px-4 py-2 text-sm font-medium transition-colors';
    }

    const isActive = isActivePath(href);
    return isActive
      ? 'text-sm font-medium theme-text-primary transition-colors'
      : 'text-sm font-medium theme-text-secondary hover:theme-text-primary transition-colors';
  };

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
      className='fixed top-0 left-0 right-0 z-50 border-b border-brand-gray theme-surface-overlay backdrop-blur-md'
    >
      <div className='container-custom flex items-center justify-between gap-4 h-16'>
        <Link href={`/${lang}`} className='flex items-center'>
          <div className='hover:opacity-80 transition-opacity'>
            <Image
              src='/logo.png'
              alt='ContextGo Logo'
              width={128}
              height={40}
              className='theme-logo object-contain object-left'
              priority
            />
          </div>
        </Link>
        <div className='ml-auto flex items-center gap-3'>
          <div className='hidden md:flex items-center gap-6'>
            <Link href={`/${lang}`} className={linkClass(`/${lang}`)}>
              {dict.product}
            </Link>
            <Link href={`/${lang}/connect`} className={linkClass(`/${lang}/connect`)}>
              {dict.connect}
            </Link>
            <Link
              href={`/${lang}/docs`}
              className={
                isActivePath(`/${lang}/docs`)
                  ? 'theme-button-secondary rounded-full px-4 py-2 text-sm font-medium transition-colors'
                  : linkClass(`/${lang}/docs`)
              }
            >
              {dict.docs}
            </Link>
            <Link href={`/${lang}/blog`} className={linkClass(`/${lang}/blog`)}>
              {dict.blog}
            </Link>
            <Link href={`/${lang}/download`} className={linkClass(`/${lang}/download`, true)}>
              {dict.download}
            </Link>

            <div className='flex gap-2 border-l pl-4 text-sm font-medium theme-border-strong'>
              <Link
                href={switchLocale('en')}
                className={lang === 'en' ? 'theme-text-primary' : 'theme-text-tertiary hover:theme-text-secondary'}
              >
                EN
              </Link>
              <Link
                href={switchLocale('zh')}
                className={lang === 'zh' ? 'theme-text-primary' : 'theme-text-tertiary hover:theme-text-secondary'}
              >
                中
              </Link>
            </div>
          </div>

          <ThemeToggle dict={dict.theme} />
          <a
            href={githubUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='theme-button-secondary inline-flex items-center justify-center rounded-full p-2 transition-colors'
            title='GitHub'
          >
            <Github size={20} />
          </a>
        </div>
      </div>
    </motion.nav>
  );
}
