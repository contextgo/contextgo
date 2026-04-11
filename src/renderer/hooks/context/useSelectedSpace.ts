/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TSpace } from '@/common/config/storage';
import {
  getStoredSelectedSpaceId,
  hydrateStoredSelectedSpaceId,
  resolveSelectedSpace,
  setStoredSelectedSpaceId,
  subscribeSelectedSpaceId,
} from '@/renderer/utils/workspace/selectedSpace';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

const getSelectedSpaceIdSnapshot = (): string | null => getStoredSelectedSpaceId();

export const useSelectedSpaceId = (): string | null => {
  const selectedSpaceId = useSyncExternalStore(
    subscribeSelectedSpaceId,
    getSelectedSpaceIdSnapshot,
    (): string | null => null
  );

  useEffect(() => {
    void hydrateStoredSelectedSpaceId();
  }, []);

  return selectedSpaceId;
};

export type UseSelectedSpaceResult = {
  spaces: TSpace[];
  selectedSpaceId: string | null;
  selectedSpace: TSpace | null;
  isLoading: boolean;
  isCreating: boolean;
  refreshSpaces: () => Promise<TSpace[]>;
  selectSpace: (spaceId: string) => Promise<void>;
  createSpace: (params: { name: string; description?: string }) => Promise<TSpace>;
};

export const useSelectedSpace = (): UseSelectedSpaceResult => {
  const selectedSpaceId = useSelectedSpaceId();
  const [spaces, setSpaces] = useState<TSpace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const refreshSpaces = useCallback(async (): Promise<TSpace[]> => {
    setIsLoading(true);
    try {
      const hydratedSpaceId = await hydrateStoredSelectedSpaceId();
      const listedSpaces = await ipcBridge.space.list.invoke();
      const nextSpaces = listedSpaces.length > 0 ? listedSpaces : [await ipcBridge.space.ensureDefault.invoke()];
      setSpaces(nextSpaces);

      const resolvedSpace = resolveSelectedSpace(nextSpaces, hydratedSpaceId);
      await setStoredSelectedSpaceId(resolvedSpace?.id ?? null);

      return nextSpaces;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSpaces();
  }, [refreshSpaces]);

  const selectedSpace = useMemo(() => {
    return resolveSelectedSpace(spaces, selectedSpaceId);
  }, [selectedSpaceId, spaces]);

  useEffect(() => {
    if (spaces.length === 0) {
      return;
    }

    const resolvedSpace = resolveSelectedSpace(spaces, selectedSpaceId);
    if (resolvedSpace?.id && resolvedSpace.id !== selectedSpaceId) {
      void setStoredSelectedSpaceId(resolvedSpace.id);
    }
  }, [selectedSpaceId, spaces]);

  const selectSpace = useCallback(async (spaceId: string) => {
    await setStoredSelectedSpaceId(spaceId);
  }, []);

  const createSpace = useCallback(async (params: { name: string; description?: string }): Promise<TSpace> => {
    setIsCreating(true);
    try {
      const createdSpace = await ipcBridge.space.create.invoke(params);
      setSpaces((previousSpaces) => [...previousSpaces, createdSpace]);
      await setStoredSelectedSpaceId(createdSpace.id);
      return createdSpace;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return {
    spaces,
    selectedSpaceId: selectedSpace?.id ?? selectedSpaceId,
    selectedSpace,
    isLoading,
    isCreating,
    refreshSpaces,
    selectSpace,
    createSpace,
  };
};
