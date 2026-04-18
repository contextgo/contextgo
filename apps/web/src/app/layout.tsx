import { headers } from 'next/headers';
import ThemeScript from '@/components/ThemeScript';
import { buildRootMetadata, resolveSiteLocale } from '@/lib/seo';
import './globals.css';

export const metadata = buildRootMetadata();

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const locale = resolveSiteLocale(requestHeaders.get('x-contextgo-locale') || 'en');

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className='antialiased min-h-screen flex flex-col theme-page theme-text-primary'>{children}</body>
    </html>
  );
}
