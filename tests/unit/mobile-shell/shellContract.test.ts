import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readWorkspaceFile = async (relativePath: string): Promise<string> => {
  return readFile(path.join(process.cwd(), relativePath), 'utf8');
};

describe('mobile-shell native contract', () => {
  it('keeps Android deep-link login bootstrap behavior wired into the shell', async () => {
    const androidManifest = await readWorkspaceFile('mobile-shell/android/app/src/main/AndroidManifest.xml');
    const androidSource = await readWorkspaceFile(
      'mobile-shell/android/app/src/main/java/io/contextgo/mobileshell/MainActivity.kt'
    );

    expect(androidManifest).toContain('android:launchMode="singleTask"');
    expect(androidSource).toContain('ContextGoMobileShell/1.0');
    expect(androidSource).toContain('https://remote.contextgo.io/remote/devices');
    expect(androidSource).toContain('/api/auth/desktop/consume');
  });

  it('keeps Harmony aligned with the shared shell runtime contract', async () => {
    const harmonyIndex = await readWorkspaceFile('mobile-shell/harmony/entry/src/main/ets/pages/Index.ets');
    const harmonyAbility = await readWorkspaceFile(
      'mobile-shell/harmony/entry/src/main/ets/entryability/EntryAbility.ets'
    );
    const harmonyModule = await readWorkspaceFile('mobile-shell/harmony/entry/src/main/module.json5');

    expect(harmonyIndex).toContain('https://remote.contextgo.io/remote/devices');
    expect(harmonyIndex).toContain('ContextGoMobileShell/1.0');
    expect(harmonyIndex).toContain('.onControllerAttached(');
    expect(harmonyIndex).toContain('.onPageEnd(');
    expect(harmonyAbility).toContain('onNewWant(');
    expect(harmonyModule).toContain('action.system.view');
    expect(harmonyModule).toContain('contextgo-remote');
  });
});
