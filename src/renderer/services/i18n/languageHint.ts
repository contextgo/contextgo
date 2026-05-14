/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

const LANGUAGE_HINT_STORAGE_KEY = 'i18nextLng';

function getLocalStorage(): Storage | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  return globalThis.localStorage ?? null;
}

export function readLanguageHint(fallbackLanguage: string): string {
  try {
    return getLocalStorage()?.getItem(LANGUAGE_HINT_STORAGE_KEY) || fallbackLanguage;
  } catch {
    return fallbackLanguage;
  }
}

export function writeLanguageHint(language: string): void {
  try {
    getLocalStorage()?.setItem(LANGUAGE_HINT_STORAGE_KEY, language);
  } catch {
    // Ignore storage write failures so i18n can still initialize in non-browser environments.
  }
}
