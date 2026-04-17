/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BUILTIN_CHANNEL_TYPES, isBuiltinChannelType, type BuiltinChannelType } from '@/common/config/builtinChannels';
import type {
  IChannelCapabilityRegistry,
  IChannelNativeAgentSurfaceCapabilities,
  IChannelNativeSurfaceCapability,
  PluginType,
} from '../types';
import { CHANNEL_NATIVE_CAPABILITY_SCHEMA_VERSION } from '../types';

type NativeCapabilityDefinition = Omit<IChannelNativeAgentSurfaceCapabilities, 'schemaVersion' | 'platform'>;

function createNoneSurfaceCapability<TSurface extends string>(): IChannelNativeSurfaceCapability<TSurface> {
  return {
    support: 'none',
    officialSurfaces: [],
  };
}

const BUILTIN_CHANNEL_CAPABILITY_DEFINITIONS: Record<BuiltinChannelType, NativeCapabilityDefinition> = {
  telegram: {
    commandEntry: {
      support: 'full',
      officialSurfaces: ['slash_command'],
      compatibilitySurfaces: ['message_text'],
    },
    menuEntry: {
      support: 'full',
      officialSurfaces: ['reply_keyboard'],
    },
    messageActionButtons: {
      support: 'full',
      officialSurfaces: ['inline_keyboard'],
    },
    cardCallbacks: {
      support: 'limited',
      officialSurfaces: ['callback_query'],
    },
    threadReply: {
      support: 'full',
      officialSurfaces: ['thread'],
    },
    notes: ['Telegram topics are projected as thread replies via message_thread_id semantics.'],
  },
  slack: {
    commandEntry: {
      support: 'limited',
      officialSurfaces: [],
      compatibilitySurfaces: ['message_text'],
    },
    menuEntry: {
      support: 'none',
      officialSurfaces: [],
    },
    messageActionButtons: {
      support: 'full',
      officialSurfaces: ['block_actions'],
    },
    cardCallbacks: {
      support: 'full',
      officialSurfaces: ['block_action_payload'],
    },
    threadReply: {
      support: 'full',
      officialSurfaces: ['thread'],
    },
    notes: ['Slash-command style flows are currently modeled through text command compatibility parsing.'],
  },
  discord: {
    commandEntry: {
      support: 'limited',
      officialSurfaces: [],
      compatibilitySurfaces: ['message_text'],
    },
    menuEntry: {
      support: 'none',
      officialSurfaces: [],
    },
    messageActionButtons: {
      support: 'full',
      officialSurfaces: ['message_component'],
    },
    cardCallbacks: {
      support: 'full',
      officialSurfaces: ['message_component_interaction'],
    },
    threadReply: {
      support: 'full',
      officialSurfaces: ['thread'],
    },
  },
  lark: {
    commandEntry: {
      support: 'full',
      officialSurfaces: ['bot_menu'],
      compatibilitySurfaces: ['message_text'],
    },
    menuEntry: {
      support: 'full',
      officialSurfaces: ['bot_menu'],
    },
    messageActionButtons: {
      support: 'full',
      officialSurfaces: ['interactive_card'],
    },
    cardCallbacks: {
      support: 'full',
      officialSurfaces: ['interactive_card_callback', 'menu_event'],
    },
    threadReply: {
      support: 'full',
      officialSurfaces: ['thread', 'topic'],
    },
  },
  dingtalk: {
    commandEntry: {
      support: 'limited',
      officialSurfaces: [],
      compatibilitySurfaces: ['message_text'],
    },
    menuEntry: {
      support: 'limited',
      officialSurfaces: [],
      compatibilitySurfaces: ['interactive_card_menu'],
    },
    messageActionButtons: {
      support: 'full',
      officialSurfaces: ['interactive_card'],
    },
    cardCallbacks: {
      support: 'full',
      officialSurfaces: ['interactive_card_callback'],
    },
    threadReply: {
      support: 'none',
      officialSurfaces: [],
    },
    notes: ['DingTalk command-entry compatibility currently relies on text-driven action routing.'],
  },
  weixin: {
    commandEntry: {
      support: 'limited',
      officialSurfaces: [],
      compatibilitySurfaces: ['message_text'],
    },
    menuEntry: {
      support: 'none',
      officialSurfaces: [],
    },
    messageActionButtons: {
      support: 'none',
      officialSurfaces: [],
    },
    cardCallbacks: {
      support: 'none',
      officialSurfaces: [],
    },
    threadReply: {
      support: 'none',
      officialSurfaces: [],
    },
    notes: [
      'Weixin projection is intentionally constrained and does not promise official command/menu callback surfaces.',
    ],
  },
};

function cloneNativeSurfaceCapability<TSurface extends string>(
  capability: Readonly<IChannelNativeSurfaceCapability<TSurface>>
): IChannelNativeSurfaceCapability<TSurface> {
  return {
    support: capability.support,
    officialSurfaces: [...capability.officialSurfaces],
    compatibilitySurfaces: capability.compatibilitySurfaces ? [...capability.compatibilitySurfaces] : undefined,
  };
}

function materializeProfile(
  platform: PluginType,
  definition: Readonly<NativeCapabilityDefinition>
): IChannelNativeAgentSurfaceCapabilities {
  return {
    schemaVersion: CHANNEL_NATIVE_CAPABILITY_SCHEMA_VERSION,
    platform,
    commandEntry: cloneNativeSurfaceCapability(definition.commandEntry),
    menuEntry: cloneNativeSurfaceCapability(definition.menuEntry),
    messageActionButtons: cloneNativeSurfaceCapability(definition.messageActionButtons),
    cardCallbacks: cloneNativeSurfaceCapability(definition.cardCallbacks),
    threadReply: cloneNativeSurfaceCapability(definition.threadReply),
    notes: definition.notes ? [...definition.notes] : undefined,
  };
}

function buildExtensionFallbackDefinition(platform: PluginType): NativeCapabilityDefinition {
  return {
    commandEntry: {
      support: 'limited',
      officialSurfaces: [],
      compatibilitySurfaces: ['message_text'],
    },
    menuEntry: createNoneSurfaceCapability(),
    messageActionButtons: createNoneSurfaceCapability(),
    cardCallbacks: createNoneSurfaceCapability(),
    threadReply: createNoneSurfaceCapability(),
    notes: [
      `Extension platform "${platform}" currently uses conservative defaults; declare richer capabilities when extension metadata supports it.`,
    ],
  };
}

function normalizePlatform(platform: PluginType): PluginType {
  const normalized = platform.trim();
  return (normalized || platform) as PluginType;
}

export function getChannelNativeAgentSurfaceCapabilities(platform: PluginType): IChannelNativeAgentSurfaceCapabilities {
  const normalizedPlatform = normalizePlatform(platform);
  if (isBuiltinChannelType(normalizedPlatform)) {
    return materializeProfile(normalizedPlatform, BUILTIN_CHANNEL_CAPABILITY_DEFINITIONS[normalizedPlatform]);
  }
  return materializeProfile(normalizedPlatform, buildExtensionFallbackDefinition(normalizedPlatform));
}

export function buildChannelCapabilityRegistry(params?: {
  platforms?: readonly PluginType[];
  includeBuiltinPlatforms?: boolean;
}): IChannelCapabilityRegistry {
  const includeBuiltinPlatforms = params?.includeBuiltinPlatforms ?? true;
  const platformSet = new Set<PluginType>();

  if (includeBuiltinPlatforms) {
    for (const builtinType of BUILTIN_CHANNEL_TYPES) {
      platformSet.add(builtinType);
    }
  }

  for (const platform of params?.platforms ?? []) {
    if (!platform || !platform.trim()) {
      continue;
    }
    platformSet.add(normalizePlatform(platform));
  }

  const platforms = Object.fromEntries(
    Array.from(platformSet)
      .toSorted((left, right) => left.localeCompare(right))
      .map((platform) => [platform, getChannelNativeAgentSurfaceCapabilities(platform)] as const)
  );

  return {
    schemaVersion: CHANNEL_NATIVE_CAPABILITY_SCHEMA_VERSION,
    platforms,
  };
}
