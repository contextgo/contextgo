import type { Metadata } from 'next';
import ThemeScript from '@/components/ThemeScript';
import './globals.css';

export const metadata: Metadata = {
  title: 'ContextGo - Manage Your Context, Empower Your AI',
  description: 'Local context management for the AI era. Edit, manage, and serve context to LLMs via standard protocols.',
  icons: {
    icon: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className='antialiased min-h-screen flex flex-col theme-page theme-text-primary'>
        {children}
      </body>
    </html>
  );
}
