import { describe, expect, it } from 'vitest';
import {
  matchesSettingsNavPath,
  normalizeSettingsAnchor,
} from '@/renderer/pages/settings/components/settingsNavigation';

describe('settingsNavigation', () => {
  it('normalizes legacy display anchor to system', () => {
    expect(normalizeSettingsAnchor('display')).toBe('system');
    expect(normalizeSettingsAnchor('tools')).toBe('runtime');
  });

  it('matches exact settings routes without prefix collisions', () => {
    expect(matchesSettingsNavPath('/settings/system-runs', 'system-runs')).toBe(true);
    expect(matchesSettingsNavPath('/settings/system-runs', 'system')).toBe(false);
    expect(matchesSettingsNavPath('/settings/system', 'system')).toBe(true);
  });

  it('supports aliased settings routes', () => {
    expect(matchesSettingsNavPath('/settings/agent-entry', 'channels')).toBe(true);
    expect(matchesSettingsNavPath('/settings/active-sessions', 'agent-publish')).toBe(true);
    expect(matchesSettingsNavPath('/settings/display', 'system')).toBe(true);
  });
});
