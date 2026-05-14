import { permanentRedirect } from 'next/navigation';

export const runtime = 'edge';

export default function RootPage() {
  permanentRedirect('/en');
}
