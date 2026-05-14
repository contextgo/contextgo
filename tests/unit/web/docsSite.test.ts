import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDocsSiteUrl, resolveDocsSitePath } from '../../../apps/web/src/lib/docsSite';

describe('docsSite', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the standalone docs root when no legacy path is provided', () => {
    expect(getDocsSiteUrl()).toBe('https://docs.contextgo.io');
  });

  it('maps known single-segment legacy slugs to the standalone docs structure', () => {
    expect(resolveDocsSitePath('quick-start')).toBe('start-here/quick-start');
    expect(getDocsSiteUrl('quick-start')).toBe('https://docs.contextgo.io/start-here/quick-start');
  });

  it('preserves nested legacy docs paths from catch-all route segments', () => {
    expect(resolveDocsSitePath(['start-here', 'quick-start'])).toBe('start-here/quick-start');
    expect(getDocsSiteUrl(['start-here', 'quick-start'])).toBe('https://docs.contextgo.io/start-here/quick-start');
  });
});
