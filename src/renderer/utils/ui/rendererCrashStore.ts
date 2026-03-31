/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export type RendererCrashType = 'error' | 'unhandledrejection' | 'react-error-boundary';

export type RendererCrashRecord = {
  type: RendererCrashType;
  message: string;
  stack?: string;
  href?: string;
  timestamp: string;
};

export type RendererCrashInput = Omit<RendererCrashRecord, 'timestamp'> & {
  timestamp?: string;
};

type RendererCrashListener = () => void;

let currentCrash: RendererCrashRecord | null = null;

const listeners = new Set<RendererCrashListener>();

const normalizeCrashRecord = (record: RendererCrashInput): RendererCrashRecord => ({
  ...record,
  href: record.href ?? (typeof window !== 'undefined' ? window.location.href : undefined),
  timestamp: record.timestamp ?? new Date().toISOString(),
});

const isSameCrashRecord = (left: RendererCrashRecord | null, right: RendererCrashRecord): boolean => {
  if (!left) {
    return false;
  }

  return (
    left.type === right.type && left.message === right.message && left.stack === right.stack && left.href === right.href
  );
};

const emitChange = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

export const getRendererCrash = (): RendererCrashRecord | null => currentCrash;

export const subscribeRendererCrash = (listener: RendererCrashListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setRendererCrash = (record: RendererCrashInput): RendererCrashRecord => {
  const nextRecord = normalizeCrashRecord(record);

  if (isSameCrashRecord(currentCrash, nextRecord)) {
    return currentCrash as RendererCrashRecord;
  }

  currentCrash = nextRecord;
  emitChange();
  return nextRecord;
};

export const clearRendererCrash = (): void => {
  if (!currentCrash) {
    return;
  }

  currentCrash = null;
  emitChange();
};
