import { describe, expect, it } from 'vitest';
import { normalizeHashRouteShellHref, normalizeHashRouteShellPath } from '@/renderer/components/layout/routerLocation';

describe('routerLocation', () => {
  it('strips the /login shell while preserving the hash route', () => {
    expect(normalizeHashRouteShellPath('/login', '', '#/connectors/gitlab')).toBe('/#/connectors/gitlab');
  });

  it('preserves search parameters when normalizing the shell path', () => {
    expect(normalizeHashRouteShellPath('/login', '?from=oauth', '#/guid')).toBe('/?from=oauth#/guid');
  });

  it('leaves non-login shell paths unchanged', () => {
    expect(normalizeHashRouteShellPath('/', '', '#/guid')).toBeNull();
  });

  it('normalizes a full authenticated href generated from the login shell', () => {
    expect(normalizeHashRouteShellHref('https://remote.contextgo.io/login#/connectors/gitlab')).toBe(
      'https://remote.contextgo.io/#/connectors/gitlab'
    );
  });
});
