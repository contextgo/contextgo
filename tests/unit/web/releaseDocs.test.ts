import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getReleaseDocEntry, getReleaseDocGroups, getResolvedReleaseDocs } from '../../../apps/web/src/lib/releaseDocs';

const originalFetch = global.fetch;

describe('releaseDocs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reads latest docs from the release repository bundle when available', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith('/docs/latest.json')) {
        return new Response(
          JSON.stringify({
            schemaVersion: 1,
            version: '1.2.3',
            exportedAt: '2026-04-01T00:00:00.000Z',
          }),
          { status: 200 }
        );
      }

      if (url.endsWith('/docs/versions.json')) {
        return new Response(
          JSON.stringify({
            schemaVersion: 1,
            latestVersion: '1.2.3',
            exportedAt: '2026-04-01T00:00:00.000Z',
            versions: [{ version: '1.2.3', exportedAt: '2026-04-01T00:00:00.000Z' }],
          }),
          { status: 200 }
        );
      }

      if (url.endsWith('/docs/1.2.3/en.json')) {
        return new Response(
          JSON.stringify({
            schemaVersion: 1,
            version: '1.2.3',
            locale: 'en',
            exportedAt: '2026-04-01T00:00:00.000Z',
            docs: {
              badge: 'Documentation',
              title: 'ContextGo Docs',
              description: 'Release docs',
              featuredLabel: 'Documentation structure',
              featuredDescription: 'Release-backed docs',
              categories: [{ id: 'guides', title: 'Guides', description: 'Guides' }],
              entries: [
                {
                  slug: 'quick-start',
                  category: 'guides',
                  eyebrow: 'Quick Start',
                  title: 'Quick start',
                  summary: 'Summary',
                  readingTime: '5 min',
                  sections: [{ heading: 'Start', paragraphs: ['Body'] }],
                },
              ],
            },
            labels: {
              updated: 'Updated',
              published: 'Published',
              readingTime: 'Reading time',
              backToDocs: 'Back to docs',
              backToBlog: 'Back to blog',
              latestRelease: 'Latest release',
              releaseSource: 'Release source',
              openDownloadCenter: 'Open download center',
              openReleasePage: 'Open release page',
              articleSidebarTitle: 'ContextGo',
              articleSidebarBody: 'Sidebar',
              docsSource: 'Docs source',
              docsSourceRelease: 'Release docs v{{version}}',
              docsSourceFallback: 'Draft docs fallback',
              openReleaseRepository: 'Open release repository',
              openVersionedDocs: 'Open versioned docs',
              releaseHistory: 'Release history',
            },
          }),
          { status: 200 }
        );
      }

      return new Response(null, { status: 404 });
    });

    global.fetch = fetchMock as typeof global.fetch;

    const resolved = await getResolvedReleaseDocs('en');

    expect(resolved.source).toBe('release-repo');
    expect(resolved.bundle.version).toBe('1.2.3');
    expect(getReleaseDocGroups(resolved)).toHaveLength(1);
    expect(getReleaseDocEntry(resolved, 'quick-start')?.title).toBe('Quick start');
  });

  it('falls back to in-repo docs when release docs are unavailable', async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 404 })) as typeof global.fetch;

    const resolved = await getResolvedReleaseDocs('zh');

    expect(resolved.source).toBe('site-fallback');
    expect(resolved.bundle.version).toBe('draft');
    expect(resolved.bundle.docs.entries.length).toBeGreaterThan(0);
    expect(getReleaseDocEntry(resolved, 'quick-start')).not.toBeNull();
  });
});
