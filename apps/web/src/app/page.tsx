'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const runtime = 'edge';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Simple client-side redirect to default locale
    router.replace('/en');
  }, [router]);

  return null;
}
