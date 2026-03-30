import type { Metadata } from 'next';
import ThemeScript from '@/components/ThemeScript';
import './globals.css';

export const metadata: Metadata = {
  title: 'ContextGo - Connect The Context. Let Agents Work.',
  description:
    'ContextGo connects knowledge, tasks, conversations, and channels so agents can work inside real workflows.',
  icons: {
    icon: '/icon.png',
  },
};

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
