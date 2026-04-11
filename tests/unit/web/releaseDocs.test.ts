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

      if (url.endsWith('/docs/1.2.3/en/index.json')) {
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
                  updatedAt: '2026-04-01',
                },
              ],
            },
          }),
          { status: 200 }
        );
      }

      if (url.endsWith('/docs/1.2.3/en/quick-start/article.json')) {
        return new Response(
          JSON.stringify({
            schemaVersion: 1,
            version: '1.2.3',
            locale: 'en',
            exportedAt: '2026-04-01T00:00:00.000Z',
            article: {
              slug: 'quick-start',
              category: 'guides',
              eyebrow: 'Quick Start',
              title: 'Quick start',
              summary: 'Summary',
              readingTime: '5 min',
              updatedAt: '2026-04-01',
              html: '<h2 id="start">Start</h2><p>Body</p>',
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
    await expect(getReleaseDocEntry(resolved, 'quick-start')).resolves.toEqual(
      expect.objectContaining({
        title: 'Quick start',
        html: '<h2 id="start">Start</h2><p>Body</p>',
      })
    );
  });

  it('falls back to in-repo docs when release docs are unavailable', async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 404 })) as typeof global.fetch;

    const resolved = await getResolvedReleaseDocs('zh');

    expect(resolved.source).toBe('site-fallback');
    expect(resolved.bundle.version).toBe('draft');
    expect(resolved.bundle.docs.entries.length).toBeGreaterThan(0);
    await expect(getReleaseDocEntry(resolved, 'quick-start')).resolves.not.toBeNull();
  });
});
