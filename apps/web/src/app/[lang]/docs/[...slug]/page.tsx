import { redirect } from 'next/navigation';
import { getDocsSiteUrl } from '@/lib/docsSite';

export const runtime = 'edge';

export default async function DocArticlePage({ params }: { params: Promise<{ lang: string; slug: string[] }> }) {
  const { slug } = await params;
  redirect(getDocsSiteUrl(slug));
}
