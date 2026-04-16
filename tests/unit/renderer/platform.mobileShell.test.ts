import { afterEach, describe, expect, it } from 'vitest';
import { isMobileShellWebView } from '@/renderer/utils/platform';

const originalNavigator = globalThis.navigator;

const setNavigator = (userAgent: string): void => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent },
  });
};

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: originalNavigator,
  });
});

describe('isMobileShellWebView', () => {
  it('detects the shared mobile shell token across iOS, Android, and Harmony runtimes', () => {
    setNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) ContextGoMobileShell/1.0');
    expect(isMobileShellWebView()).toBe(true);

    setNavigator('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126.0 ContextGoMobileShell/1.0');
    expect(isMobileShellWebView()).toBe(true);

    setNavigator('Mozilla/5.0 (Linux; HarmonyOS 5) AppleWebKit/537.36 Mobile ContextGoMobileShell/1.0');
    expect(isMobileShellWebView()).toBe(true);
  });

  it('does not treat ordinary browsers as mobile shell runtimes', () => {
    setNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148');
    expect(isMobileShellWebView()).toBe(false);

    setNavigator('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36');
    expect(isMobileShellWebView()).toBe(false);
  });
});
