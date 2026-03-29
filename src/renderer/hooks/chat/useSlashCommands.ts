import { isSlashCommandListEnabled } from '@/common/chat/slash/availability';
import {
  normalizeManagedSlashCommandLibrary,
  resolveManagedSlashCommands,
  toSlashCommandItems,
} from '@/common/chat/slash/library';
import type { SlashCommandItem } from '@/common/chat/slash/types';
import { ConfigStorage } from '@/common/config/storage';
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
  const [remoteCommands, setRemoteCommands] = useState<SlashCommandItem[]>(() => {
    if (!canUseCachedCommands) {
      return [];
    }
    return getCachedCommands(conversationId) || [];
  });
  const [managedCommands, setManagedCommands] = useState<SlashCommandItem[]>([]);

  useEffect(() => {
    let isDisposed = false;

    const loadManagedCommands = async () => {
      try {
        const storedLibrary = await ConfigStorage.get('command.library');
        const normalizedLibrary = normalizeManagedSlashCommandLibrary(storedLibrary);
        const resolvedCommands = resolveManagedSlashCommands(normalizedLibrary, (key, defaultValue) =>
          t(key, { defaultValue })
        );

        if (JSON.stringify(storedLibrary) !== JSON.stringify(normalizedLibrary)) {
          await ConfigStorage.set('command.library', normalizedLibrary);
        }

        if (!isDisposed) {
          setManagedCommands(toSlashCommandItems(resolvedCommands));
        }
      } catch (error) {
        if (!isDisposed) {
          console.error('[useSlashCommands] Failed to load managed commands:', error);
          setManagedCommands([]);
        }
      }
    };

    void loadManagedCommands();
    const unsubscribe = addEventListener('commands.library.updated', () => {
      void loadManagedCommands();
    });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [i18n.language]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let isCancelled = false;

    if (!conversationId) {
      setRemoteCommands([]);
      return;
    }

    if (!canUseCachedCommands) {
      setRemoteCommands([]);
      return;
    }

    const cached = getCachedCommands(conversationId);
    if (canUseCachedCommands && cached) {
      setRemoteCommands(cached);
    }

    void ipcBridge.conversation.getSlashCommands
      .invoke({ conversation_id: conversationId })
      .then((response) => {
        if (isCancelled || requestId !== requestIdRef.current) {
          return;
        }
        if (!response.success || !response.data?.commands) {
          setRemoteCommands([]);
          return;
        }
        setCachedCommands(conversationId, response.data.commands);
        setRemoteCommands(response.data.commands);
      })
      .catch((error) => {
        if (isCancelled || requestId !== requestIdRef.current) {
          return;
        }
        console.error('[useSlashCommands] Failed to load slash commands:', error);
        setRemoteCommands([]);
      });

    return () => {
      isCancelled = true;
    };
  }, [conversationId, canUseCachedCommands, codexStatus, conversationType, agentStatus]);

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
