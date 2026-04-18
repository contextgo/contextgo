import { permanentRedirect } from 'next/navigation';
import { getDocsSiteUrl } from '@/lib/docsSite';

export const runtime = 'edge';

export default async function DocsPage() {
  permanentRedirect(getDocsSiteUrl());
}
