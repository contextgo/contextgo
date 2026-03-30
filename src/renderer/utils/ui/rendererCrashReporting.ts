/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ErrorInfo } from 'react';
import type { RendererCrashInput, RendererCrashRecord } from './rendererCrashStore';
import { setRendererCrash } from './rendererCrashStore';

let errorListener: ((event: ErrorEvent) => void) | null = null;
let rejectionListener: ((event: PromiseRejectionEvent) => void) | null = null;

const NON_FATAL_RESOURCE_TAGS = new Set(['IMG', 'IMAGE', 'AUDIO', 'VIDEO', 'SOURCE', 'TRACK']);

type ResourceErrorContext = {
  tagName: string;
  label: string;
  resourceUrl?: string;
};

const formatUnknownReason = (reason: unknown): string => {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (typeof reason === 'string') {
    return reason;
  }

  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
};

const buildCrashStack = (error?: Error, componentStack?: string): string | undefined => {
  const stackParts = [error?.stack, componentStack].filter(Boolean);
  if (stackParts.length === 0) {
    return undefined;
  }

  return stackParts.join('\n\n');
};

const getResourceErrorContext = (target: EventTarget | null): ResourceErrorContext | null => {
  if (!(target instanceof Element)) {
    return null;
  }

  const tagName = target.tagName.toUpperCase();
  const resourceUrl =
    (target instanceof HTMLImageElement ? target.currentSrc : undefined) ||
    (target instanceof HTMLScriptElement ? target.src : undefined) ||
    (target instanceof HTMLLinkElement ? target.href : undefined) ||
    target.getAttribute('src') ||
    target.getAttribute('href') ||
    undefined;

  if (tagName === 'LINK' && target instanceof HTMLLinkElement && target.rel === 'stylesheet') {
    return {
      tagName,
      label: 'stylesheet',
      resourceUrl,
    };
  }

  if (tagName === 'SCRIPT') {
    return {
      tagName,
      label: 'script',
      resourceUrl,
    };
  }

  if (NON_FATAL_RESOURCE_TAGS.has(tagName)) {
    return {
      tagName,
      label: tagName.toLowerCase(),
      resourceUrl,
    };
  }

  return null;
};

const shouldIgnoreResourceError = (context: ResourceErrorContext | null): boolean =>
  Boolean(context && NON_FATAL_RESOURCE_TAGS.has(context.tagName));

const buildWindowErrorDetails = (
  event: ErrorEvent,
  resourceContext: ResourceErrorContext | null
): string | undefined => {
  const details = [
    event.filename ? `filename: ${event.filename}` : undefined,
    event.lineno || event.colno ? `location: ${event.lineno}:${event.colno}` : undefined,
    resourceContext ? `target: <${resourceContext.tagName.toLowerCase()}>` : undefined,
    resourceContext?.resourceUrl ? `resource: ${resourceContext.resourceUrl}` : undefined,
  ].filter(Boolean);

  if (details.length === 0) {
    return undefined;
  }

  return details.join('\n');
};

export const reportRendererCrash = (record: RendererCrashInput): RendererCrashRecord => {
  const crashRecord = setRendererCrash(record);

  ipcBridge.application.reportRendererError
    .invoke({
      ...crashRecord,
      href: crashRecord.href ?? (typeof window !== 'undefined' ? window.location.href : undefined),
    })
    .catch(() => {
      // Avoid cascading failures while the renderer is already in a bad state.
    });

  return crashRecord;
};

export const reportRendererBoundaryCrash = (error: Error, errorInfo: ErrorInfo): RendererCrashRecord =>
  reportRendererCrash({
    type: 'react-error-boundary',
    message: error.message || 'Unknown renderer error',
    stack: buildCrashStack(error, errorInfo.componentStack),
  });

export const registerRendererCrashReporting = (): void => {
  if (typeof window === 'undefined' || errorListener || rejectionListener) {
    return;
  }

  errorListener = (event: ErrorEvent) => {
    const error = event.error instanceof Error ? event.error : undefined;
    const resourceContext = getResourceErrorContext(event.target);
    const windowErrorMessage = event.message?.trim();

    if (!error && shouldIgnoreResourceError(resourceContext)) {
      return;
    }

    if (!error && !windowErrorMessage && !resourceContext) {
      return;
    }

    const message =
      error?.message ||
      windowErrorMessage ||
      (resourceContext ? `Failed to load ${resourceContext.label} resource` : 'Unknown renderer error');
    const eventDetails = buildWindowErrorDetails(event, resourceContext);

    reportRendererCrash({
      type: 'error',
      message,
      stack: buildCrashStack(error, eventDetails),
    });
  };

  rejectionListener = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : undefined;

    reportRendererCrash({
      type: 'unhandledrejection',
      message: formatUnknownReason(reason) || 'Unhandled renderer rejection',
      stack: buildCrashStack(error),
    });
  };

  window.addEventListener('error', errorListener, true);
  window.addEventListener('unhandledrejection', rejectionListener, true);
};

export const unregisterRendererCrashReporting = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  if (errorListener) {
    window.removeEventListener('error', errorListener, true);
    errorListener = null;
  }

  if (rejectionListener) {
    window.removeEventListener('unhandledrejection', rejectionListener, true);
    rejectionListener = null;
  }
};
