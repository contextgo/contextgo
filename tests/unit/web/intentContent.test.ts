import { describe, expect, it } from 'vitest';
import { getIntentPage, getIntentPages, getPageFaqItems } from '../../../apps/web/src/lib/intentContent';

describe('intentContent', () => {
  it('exposes publishable search-intent pages for both locales', () => {
    const englishPages = getIntentPages('en');
    const chinesePages = getIntentPages('zh');

    expect(englishPages).toHaveLength(6);
    expect(chinesePages).toHaveLength(6);
    expect(englishPages.map((page) => page.slug)).toEqual(chinesePages.map((page) => page.slug));
    expect(englishPages.every((page) => page.faq.length >= 3)).toBe(true);
  });

  it('returns page-specific faq items for supported surfaces', () => {
    expect(getPageFaqItems('en', 'home')).toHaveLength(3);
    expect(getPageFaqItems('zh', 'download')).toHaveLength(3);
    expect(getPageFaqItems('en', 'connect')).toHaveLength(3);
  });

  it('looks up a page by slug', () => {
    const page = getIntentPage('en', 'remote-ai-workspace');

    expect(page?.title).toContain('Remote');
    expect(page?.sections).toHaveLength(3);
  });
});
