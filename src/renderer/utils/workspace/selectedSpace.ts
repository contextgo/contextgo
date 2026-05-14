/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { STORAGE_KEYS } from '@/common/config/storageKeys';
import { ConfigStorage, type TSpace } from '@/common/config/storage';

const listeners = new Set<() => void>();
let hydratePromise: Promise<string | null> | null = null;

const emitSelectedSpaceChange = () => {
  listeners.forEach((listener) => listener());
};

const normalizeSpaceId = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const subscribeSelectedSpaceId = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getStoredSelectedSpaceId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return normalizeSpaceId(localStorage.getItem(STORAGE_KEYS.SELECTED_SPACE_ID));
};

export const hydrateStoredSelectedSpaceId = async (): Promise<string | null> => {
  const storedId = getStoredSelectedSpaceId();
  if (storedId) {
    return storedId;
  }

  if (!hydratePromise) {
    hydratePromise = ConfigStorage.get('space.selectedId')
      .then((spaceId): string | null => {
        const normalized = normalizeSpaceId(spaceId);
        if (normalized && typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.SELECTED_SPACE_ID, normalized);
          emitSelectedSpaceChange();
        }
        return normalized;
      })
      .catch((): string | null => null)
      .finally((): void => {
        hydratePromise = null;
      });
  }

  return hydratePromise;
};

export const setStoredSelectedSpaceId = async (spaceId?: string | null): Promise<void> => {
  const normalized = normalizeSpaceId(spaceId);
  const previous = getStoredSelectedSpaceId();

  if (typeof window !== 'undefined') {
    if (normalized) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_SPACE_ID, normalized);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_SPACE_ID);
    }
  }

  await ConfigStorage.set('space.selectedId', normalized ?? undefined).catch((): void | undefined => undefined);

  if (previous !== normalized) {
    emitSelectedSpaceChange();
  }
};

export const resolveSelectedSpace = (spaces: readonly TSpace[], selectedSpaceId?: string | null): TSpace | null => {
  if (spaces.length === 0) {
    return null;
  }

  const normalizedSelectedId = normalizeSpaceId(selectedSpaceId);
  if (normalizedSelectedId) {
    const matched = spaces.find((space) => space.id === normalizedSelectedId);
    if (matched) {
      return matched;
    }
  }

  return spaces.find((space) => space.isDefault) ?? spaces[0] ?? null;
};
