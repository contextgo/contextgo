/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import coworkSvg from '@/renderer/assets/icons/cowork.svg';
import everythingClaudeCodeSvg from '@/renderer/assets/icons/everything-claude-code.svg';
import superpowersSvg from '@/renderer/assets/icons/superpowers.svg';

/**
 * Map custom avatar identifiers to their resolved image URLs.
 */
export const CUSTOM_AVATAR_IMAGE_MAP: Record<string, string> = {
  'cowork.svg': coworkSvg,
  'everything-claude-code.svg': everythingClaudeCodeSvg,
  'superpowers.svg': superpowersSvg,
  '\u{1F6E0}\u{FE0F}': coworkSvg,
};
