/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'path';
import { getPlatformServices } from '@/common/platform';
import { getDataPath } from '@process/utils';

export const CONTEXTGO_EXTENSIONS_PATH_ENV = 'CONTEXTGO_EXTENSIONS_PATH';
export const CONTEXTGO_STRICT_ENV_ENV = 'CONTEXTGO_STRICT_ENV';
export const EXTENSION_MANIFEST_FILE = 'contextgo-extension.json';
export const EXTENSIONS_DIR_NAME = 'extensions';
export const PATH_SEPARATOR = process.platform === 'win32' ? ';' : ':';

export function getUserExtensionsDir(): string {
  return path.join(getDataPath(), EXTENSIONS_DIR_NAME);
}

export function getAppDataExtensionsDir(): string {
  return path.join(getPlatformServices().paths.getDataDir(), EXTENSIONS_DIR_NAME);
}

export function getEnvExtensionsDirs(): string[] {
  const envPath = process.env[CONTEXTGO_EXTENSIONS_PATH_ENV];
  if (!envPath) return [];
  return envPath.split(PATH_SEPARATOR).filter(Boolean);
}
