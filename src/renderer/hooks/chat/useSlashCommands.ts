import { isSlashCommandListEnabled } from '@/common/chat/slash/availability';
import {
  normalizeManagedSlashCommandLibrary,
  resolveManagedSlashCommands,
  toSlashCommandItems,
} from '@/common/chat/slash/library';
import type { SlashCommandItem } from '@/common/chat/slash/types';
import { ipcBridge } from '@/common';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addEventListener } from '@/renderer/utils/emitter';

interface CacheEntry {
  commands: SlashCommandItem[];
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

const slashCommandCache = new Map<string, CacheEntry>();

function getCachedCommands(conversationId: string): SlashCommandItem[] | null {
  const entry = slashCommandCache.get(conversationId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    slashCommandCache.delete(conversationId);
    return null;
  }
  return entry.commands;
}

function setCachedCommands(conversationId: string, commands: SlashCommandItem[]): void {
  // LRU eviction if cache is full
  if (slashCommandCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = slashCommandCache.keys().next().value;
    if (oldestKey) {
      slashCommandCache.delete(oldestKey);
    }
  }
  slashCommandCache.set(conversationId, { commands, timestamp: Date.now() });
}

interface UseSlashCommandsOptions {
  conversationType?: string;
  codexStatus?: string | null;
  /** When provided, changes to this value trigger a re-fetch. Used by ACP to
   *  re-fetch commands after the agent becomes active. */
  agentStatus?: string | null;
}

export function useSlashCommands(conversationId: string, options: UseSlashCommandsOptions = {}) {
  const { conversationType, codexStatus, agentStatus } = options;
  const { t, i18n } = useTranslation();
  const canUseCachedCommands = isSlashCommandListEnabled({ conversationType, codexStatus });
  const requestIdRef = useRef(0);
  const [libraryRefreshToken, setLibraryRefreshToken] = useState(0);
  const [remoteCommands, setRemoteCommands] = useState<SlashCommandItem[]>(() => {
    if (!canUseCachedCommands) {
      return [];
    }
    return getCachedCommands(conversationId) || [];
  });
  const [managedCommands, setManagedCommands] = useState<SlashCommandItem[]>([]);

  useEffect(() => {
    const unsubscribe = addEventListener('commands.library.updated', () => {
      setLibraryRefreshToken((value) => value + 1);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let isCancelled = false;

    if (!conversationId) {
      setRemoteCommands([]);
      setManagedCommands([]);
      return;
    }

    const cached = getCachedCommands(conversationId);
    if (canUseCachedCommands && cached) {
      setRemoteCommands(cached);
    } else if (!canUseCachedCommands) {
      setRemoteCommands([]);
    }

    void ipcBridge.conversation.getSlashCommands
      .invoke({ conversation_id: conversationId, includeRuntimeCommands: canUseCachedCommands })
      .then((response) => {
        if (isCancelled || requestId !== requestIdRef.current) {
          return;
        }

        const managedLibrary = normalizeManagedSlashCommandLibrary(response.data?.managedLibrary);
        const resolvedManagedCommands = resolveManagedSlashCommands(managedLibrary, (key, defaultValue) =>
          t(key, { defaultValue })
        );
        setManagedCommands(toSlashCommandItems(resolvedManagedCommands));

        if (!response.success || !response.data?.commands) {
          if (canUseCachedCommands) {
            setRemoteCommands([]);
          }
          return;
        }

        if (canUseCachedCommands) {
          setCachedCommands(conversationId, response.data.commands);
          setRemoteCommands(response.data.commands);
        } else {
          setRemoteCommands([]);
        }
      })
      .catch((error) => {
        if (isCancelled || requestId !== requestIdRef.current) {
          return;
        }
        console.error('[useSlashCommands] Failed to load slash commands:', error);
        setManagedCommands([]);
        if (canUseCachedCommands) {
          setRemoteCommands([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [agentStatus, canUseCachedCommands, codexStatus, conversationId, conversationType, i18n.language, libraryRefreshToken, t]);

  return useMemo(() => {
    const mergedCommands = new Map<string, SlashCommandItem>();

    for (const command of remoteCommands) {
      mergedCommands.set(command.name, command);
    }

    for (const command of managedCommands) {
      mergedCommands.set(command.name, command);
    }

    return Array.from(mergedCommands.values());
  }, [managedCommands, remoteCommands]);
}
