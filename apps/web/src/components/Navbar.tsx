'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Dictionary } from '@/app/types';
import ThemeToggle from '@/components/ThemeToggle';

const DEFAULT_DISCORD_URL = 'https://discord.gg/6HWsa2jB5w';
const DEFAULT_GITHUB_URL = 'https://github.com/contextgo/contextgo';

const GitHubIcon = () => (
  <svg aria-hidden viewBox='0 0 512 512' className='theme-social-link-icon theme-social-link-icon-github'>
    <path
      fill='currentColor'
      d='M256 6.3C114.6 6.3 0 120.9 0 262.3c0 113.3 73.3 209 175 242.9c12.8 2.2 17.6-5.4 17.6-12.2c0-6.1-.3-26.2-.3-47.7c-64.3 11.8-81-15.7-86.1-30.1c-2.9-7.4-15.4-30.1-26.2-36.2c-9-4.8-21.8-16.6-.3-17c20.2-.3 34.6 18.6 39.4 26.2c23 38.7 59.8 27.8 74.6 21.1c2.2-16.6 9-27.8 16.3-34.2c-57-6.4-116.5-28.5-116.5-126.4c0-27.8 9.9-50.9 26.2-68.8c-2.6-6.4-11.5-32.6 2.6-67.8c0 0 21.4-6.7 70.4 26.2c20.5-5.8 42.2-8.6 64-8.6s43.5 2.9 64 8.6c49-33.3 70.4-26.2 70.4-26.2c14.1 35.2 5.1 61.4 2.6 67.8c16.3 17.9 26.2 40.6 26.2 68.8c0 98.2-59.8 120-116.8 126.4c9.3 8 17.3 23.4 17.3 47.4c0 34.2-.3 61.8-.3 70.4c0 6.7 4.8 14.7 17.6 12.2C438.7 471.3 512 375.3 512 262.3c0-141.4-114.6-256-256-256'
    />
  </svg>
);

const DiscordIcon = () => (
  <svg aria-hidden viewBox='0 0 256 199' className='theme-social-link-icon theme-social-link-icon-discord'>
    <path
      fill='currentColor'
      d='M216.856 16.597A208.5 208.5 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046q-29.538-4.442-58.533 0c-1.832-4.4-4.55-9.933-6.846-14.046a207.8 207.8 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161 161 0 0 0 79.735 175.3a136.4 136.4 0 0 1-21.846-10.632a109 109 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a132 132 0 0 0 5.355 4.237a136 136 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848c21.142-6.58 42.646-16.637 64.815-33.213c5.316-56.288-9.08-105.09-38.056-148.36M85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2s23.236 11.804 23.015 26.2c.02 14.375-10.148 26.18-23.015 26.18m85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2c0 14.375-10.148 26.18-23.015 26.18'
    />
  </svg>
);

type SocialLink = {
  brand: 'discord' | 'github';
  href: string;
  label: string;
  iconPath: string;
  icon: ReactNode;
};

export default function Navbar({ dict, lang }: { dict: Dictionary['navbar']; lang: string }) {
  const pathname = usePathname();
  const discordUrl = process.env.NEXT_PUBLIC_CONTEXTGO_DISCORD_URL || DEFAULT_DISCORD_URL;
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

  const socialLinks: SocialLink[] = [
    {
      brand: 'discord',
      href: discordUrl,
      label: 'Discord',
      iconPath: '/social/discord.svg',
      icon: <DiscordIcon />,
    },
    {
      brand: 'github',
      href: githubUrl,
      label: 'GitHub',
      iconPath: '/social/github.svg',
      icon: <GitHubIcon />,
    },
  ];

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
              width={3172}
              height={879}
              className='theme-logo h-10 w-auto object-contain object-left'
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
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target='_blank'
              rel='noopener noreferrer'
              className='theme-social-link'
              data-brand={link.brand}
              title={link.label}
              aria-label={link.label}
            >
              {link.icon}
            </a>
          ))}
        </div>
      </div>
    </motion.nav>
  );
}
