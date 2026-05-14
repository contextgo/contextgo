import type { VoiceInputExternalOption } from '@/common/types/voiceInput';
import { clipboard } from 'electron';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const WETYPE_BUNDLE_ID = 'com.tencent.inputmethod.wetype';
const WETYPE_DOWNLOAD_URL = 'https://z.weixin.qq.com/';

type FrontmostAppInfo = {
  appName?: string;
  bundleId?: string;
};

const findExistingPath = async (candidates: string[]): Promise<string | undefined> => {
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await access(candidate);
        return candidate;
      } catch {
        return undefined;
      }
    })
  );

  return results.find((candidate): candidate is string => Boolean(candidate));
};

const detectWeChatInputMethodPath = async (): Promise<string | undefined> => {
  const directPath = await findExistingPath([
    '/Library/Input Methods/WeType.app',
    `${homedir()}/Library/Input Methods/WeType.app`,
    '/Applications/WeType.app',
    `${homedir()}/Applications/WeType.app`,
  ]);

  if (directPath) {
    return directPath;
  }

  try {
    const { stdout } = await execFileAsync('mdfind', [
      `kMDItemCFBundleIdentifier == "${WETYPE_BUNDLE_ID}"c || kMDItemFSName == "WeType.app"c`,
    ]);
    const spotlightCandidates = stdout
      .split(/\r?\n/u)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return findExistingPath(spotlightCandidates);
  } catch {
    return undefined;
  }
};

export const detectExternalVoiceInputOptions = async (): Promise<VoiceInputExternalOption[]> => {
  if (process.platform !== 'darwin') {
    return [];
  }

  const installedPath = await detectWeChatInputMethodPath();

  return [
    {
      id: 'wechat-input-method',
      detected: Boolean(installedPath),
      installedPath,
      bundleId: WETYPE_BUNDLE_ID,
      downloadUrl: WETYPE_DOWNLOAD_URL,
    },
  ];
};

export const getFrontmostAppInfo = async (): Promise<FrontmostAppInfo> => {
  if (process.platform !== 'darwin') {
    return {};
  }

  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'tell application "System Events" to set frontApp to first application process whose frontmost is true',
      '-e',
      'set appName to name of frontApp',
      '-e',
      'try',
      '-e',
      'set bundleId to bundle identifier of frontApp',
      '-e',
      'on error',
      '-e',
      'set bundleId to ""',
      '-e',
      'end try',
      '-e',
      'return appName & "||" & bundleId',
    ]);
    const [appName = '', bundleId = ''] = stdout.trim().split('||');
    return {
      appName: appName || undefined,
      bundleId: bundleId || undefined,
    };
  } catch {
    return {};
  }
};

export const pasteTextToActiveApp = async (text: string): Promise<'inserted' | 'copied'> => {
  if (process.platform !== 'darwin') {
    return 'copied';
  }

  const previousClipboardText = clipboard.readText();
  clipboard.writeText(text);

  try {
    await execFileAsync('osascript', [
      '-e',
      'tell application "System Events"',
      '-e',
      'keystroke "v" using command down',
      '-e',
      'end tell',
    ]);
    await new Promise((resolve) => setTimeout(resolve, 180));
    clipboard.writeText(previousClipboardText);
    return 'inserted';
  } catch {
    return 'copied';
  }
};
