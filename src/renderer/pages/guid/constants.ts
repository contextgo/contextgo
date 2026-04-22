/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import coworkSvg from '@/renderer/assets/icons/cowork.svg';
import contextEngineConnectorDigestSvg from '@/renderer/assets/icons/context-engine-connector-digest.svg';
import contextEngineProjectCapabilitySvg from '@/renderer/assets/icons/context-engine-project-capability.svg';
import contextEngineProjectPromoterSvg from '@/renderer/assets/icons/context-engine-project-promoter.svg';
import contextEngineSessionKeeperSvg from '@/renderer/assets/icons/context-engine-session-keeper.svg';
import contextEngineSessionPatternSvg from '@/renderer/assets/icons/context-engine-session-pattern.svg';
import contextEngineSpaceDistillerSvg from '@/renderer/assets/icons/context-engine-space-distiller.svg';
import everythingClaudeCodeSvg from '@/renderer/assets/icons/everything-claude-code.svg';
import morphPptSvg from '@/renderer/assets/icons/morph-ppt.svg';
import officeAnalystSvg from '@/renderer/assets/icons/office-analyst.svg';
import pmWorkbenchSvg from '@/renderer/assets/icons/pm-workbench.svg';
import superpowersSvg from '@/renderer/assets/icons/superpowers.svg';

/**
 * Map custom avatar identifiers to their resolved image URLs.
 */
export const CUSTOM_AVATAR_IMAGE_MAP: Record<string, string> = {
  'cowork.svg': coworkSvg,
  'context-engine-connector-digest.svg': contextEngineConnectorDigestSvg,
  'context-engine-project-capability.svg': contextEngineProjectCapabilitySvg,
  'context-engine-project-promoter.svg': contextEngineProjectPromoterSvg,
  'context-engine-session-keeper.svg': contextEngineSessionKeeperSvg,
  'context-engine-session-pattern.svg': contextEngineSessionPatternSvg,
  'context-engine-space-distiller.svg': contextEngineSpaceDistillerSvg,
  'everything-claude-code.svg': everythingClaudeCodeSvg,
  'morph-ppt.svg': morphPptSvg,
  'office-analyst.svg': officeAnalystSvg,
  'pm-workbench.svg': pmWorkbenchSvg,
  'superpowers.svg': superpowersSvg,
  '\u{1F6E0}\u{FE0F}': coworkSvg,
};
