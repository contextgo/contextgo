import { buildLlmsText } from '@/app/llms.txt/content';

export const runtime = 'edge';

export function GET() {
  return new Response(buildLlmsText(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
