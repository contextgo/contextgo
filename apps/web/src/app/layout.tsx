import ThemeScript from '@/components/ThemeScript';
import { buildRootMetadata } from '@/lib/seo';
import './globals.css';

export const runtime = 'edge';
export const metadata = buildRootMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className='antialiased min-h-screen flex flex-col theme-page theme-text-primary'>{children}</body>
    </html>
  );
}
