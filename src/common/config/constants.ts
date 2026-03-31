/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ContextGo 应用程序共用常量
 */

// ===== 文件处理相关常量 =====

/** 临时文件时间戳分隔符 */
export const CONTEXTGO_TIMESTAMP_SEPARATOR = '_contextgo_';

/** 用于匹配和清理时间戳后缀的正则表达式 */
export const CONTEXTGO_TIMESTAMP_REGEX = /_contextgo_\d{13}(\.\w+)?$/;
export const CONTEXTGO_FILES_MARKER = '[[CONTEXTGO_FILES]]';

// ===== 媒体类型相关常量 =====

/** 支持的图片文件扩展名 */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'] as const;

/** 文件扩展名到MIME类型的映射 */
export const MIME_TYPE_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.svg': 'image/svg+xml',
};

/** MIME类型到文件扩展名的映射 */
export const MIME_TO_EXT_MAP: Record<string, string> = {
  jpeg: '.jpg',
  jpg: '.jpg',
  png: '.png',
  gif: '.gif',
  webp: '.webp',
  bmp: '.bmp',
  tiff: '.tiff',
  'svg+xml': '.svg',
};

/** 默认图片文件扩展名 */
export const DEFAULT_IMAGE_EXTENSION = '.png';

// ===== WebUI 相关常量 =====

/** WebUI default port: 25808 for production, 25809 for development (environment isolation) */
export const WEBUI_DEFAULT_PORT = process.env.NODE_ENV === 'production' ? 25808 : 25809;

/** Shared cloud auth base URL for ContextGo account sign-in. */
export const CONTEXTGO_AUTH_BASE_URL = process.env.CONTEXTGO_AUTH_BASE_URL?.trim() || 'https://auth.contextgo.io';

/** Shared cloud API base URL for device registration and sync APIs. */
export const CONTEXTGO_API_BASE_URL = process.env.CONTEXTGO_API_BASE_URL?.trim() || 'https://api.contextgo.io';

// ===== AI Provider 相关常量 =====

// Stable ID for the Google Auth virtual provider.
// Shared between frontend (useModelProviderList) and backend (SystemActions).
export const GOOGLE_AUTH_PROVIDER_ID = 'google-auth-gemini';
