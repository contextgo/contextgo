/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Express, Request, Response } from 'express';

import type { BrowserActivityIngestInput } from '@/common/types/connectors/browserActivity';
import type { TSpace } from '@/common/config/storage';
import { contextEventBus, contextService } from '@process/services/context/contextServiceSingleton';
import { SqliteSpaceRepository } from '@process/services/database/space/SqliteSpaceRepository';
import { BrowserActivityConnectorService } from '@process/services/space/browser/activity/BrowserActivityConnectorService';
import { BrowserActivityStoreService } from '@process/services/space/browser/activity/BrowserActivityStoreService';
import { SpaceServiceImpl } from '@process/services/space/SpaceServiceImpl';

import { apiRateLimiter } from '../middleware/security';

type BrowserExtensionEnvelope = {
  connector?: unknown;
  browser_family?: unknown;
  profile_label?: unknown;
  space_id?: unknown;
  session_id?: unknown;
  events?: unknown;
};

type BrowserExtensionEvent = {
  event_type?: unknown;
  recorded_at?: unknown;
  url?: unknown;
  title?: unknown;
  text_content?: unknown;
  excerpt?: unknown;
  domain?: unknown;
  tab_id?: unknown;
  window_id?: unknown;
  active?: unknown;
  transition_type?: unknown;
};

type RequestContext = {
  connectorId: string;
  browserFamily: string;
  profileLabel: string;
  sessionId?: string;
  clientName?: string;
};

const MAX_EVENT_BATCH = 100;
const spaceService = new SpaceServiceImpl(new SqliteSpaceRepository());
const browserActivityConnectorService = new BrowserActivityConnectorService(
  new BrowserActivityStoreService(),
  contextService,
  contextEventBus
);

function isLoopbackRequest(req: Request): boolean {
  const remoteAddress = req.socket.remoteAddress || '';
  const normalized = remoteAddress.replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1';
}

function normalizeNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeClientName(req: Request): string | undefined {
  const headerValue = req.header('X-ContextGo-Client');
  return normalizeNonEmptyString(headerValue);
}

function normalizeSessionId(req: Request, payload: BrowserExtensionEnvelope): string | undefined {
  return normalizeNonEmptyString(payload.session_id) || normalizeNonEmptyString(req.header('X-ContextGo-Session'));
}

async function resolveDefaultSpace(): Promise<TSpace | null> {
  const spaces = await spaceService.listSpaces();
  return spaces.find((space) => space.isDefault) ?? spaces[0] ?? null;
}

async function resolveTargetSpace(spaceId: unknown): Promise<TSpace> {
  const requestedSpaceId = normalizeNonEmptyString(spaceId);
  if (requestedSpaceId) {
    const existing = await spaceService.getSpace(requestedSpaceId);
    if (!existing) {
      throw new Error(`Unknown space: ${requestedSpaceId}`);
    }
    return existing;
  }

  const fallback = await resolveDefaultSpace();
  if (!fallback) {
    throw new Error('No available space for browser activity ingest');
  }
  return fallback;
}

function normalizeContext(req: Request, payload: BrowserExtensionEnvelope): RequestContext {
  const connectorName = normalizeNonEmptyString(payload.connector);
  const browserFamily = normalizeNonEmptyString(payload.browser_family) ?? 'chrome';
  const profileLabel = normalizeNonEmptyString(payload.profile_label) ?? 'default';
  const clientName = normalizeClientName(req);

  return {
    connectorId:
      connectorName === 'browser_extension'
        ? 'contextgo-browser-extension'
        : (connectorName ?? 'contextgo-browser-extension'),
    browserFamily,
    profileLabel,
    sessionId: normalizeSessionId(req, payload),
    clientName,
  };
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function buildTags(context: RequestContext, eventType: string, domain?: string): string[] {
  return [
    'connector:browser-extension',
    `connector:${context.connectorId}`,
    `browser:${context.browserFamily}`,
    `profile:${context.profileLabel}`,
    `event:${eventType}`,
    domain ? `domain:${domain}` : undefined,
  ].filter((value): value is string => Boolean(value));
}

function mapEventToIngestInput(
  event: BrowserExtensionEvent,
  spaceId: string,
  context: RequestContext
): BrowserActivityIngestInput | null {
  const url = normalizeNonEmptyString(event.url);
  if (!url) {
    return null;
  }

  const title = normalizeNonEmptyString(event.title) ?? url;
  const eventType = normalizeNonEmptyString(event.event_type) ?? 'navigation_completed';
  const excerpt = normalizeNonEmptyString(event.excerpt);
  const textContent = normalizeNonEmptyString(event.text_content);
  const domain = normalizeNonEmptyString(event.domain);

  return {
    spaceId,
    sessionId: context.sessionId,
    url,
    title,
    visitedAt: normalizeNonEmptyString(event.recorded_at),
    textContent,
    excerpt: excerpt ?? title,
    source: 'browser-extension',
    tags: buildTags(context, eventType, domain),
    metadata: {
      connectorId: context.connectorId,
      browserFamily: context.browserFamily,
      profileLabel: context.profileLabel,
      eventType,
      tabId: coerceNumber(event.tab_id) ?? -1,
      windowId: coerceNumber(event.window_id) ?? -1,
      active: coerceBoolean(event.active) ?? false,
      transitionType: normalizeNonEmptyString(event.transition_type) ?? 'unknown',
      clientName: context.clientName ?? 'unknown',
    },
  };
}

function parseEnvelope(body: unknown): BrowserExtensionEnvelope {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid browser activity payload');
  }
  return body as BrowserExtensionEnvelope;
}

function getEvents(payload: BrowserExtensionEnvelope): BrowserExtensionEvent[] {
  if (!Array.isArray(payload.events)) {
    throw new Error('Browser activity payload must include an events array');
  }
  if (payload.events.length > MAX_EVENT_BATCH) {
    throw new Error(`Browser activity batch exceeds limit (${MAX_EVENT_BATCH})`);
  }
  return payload.events as BrowserExtensionEvent[];
}

export function registerBrowserActivityRoutes(app: Express): void {
  app.get('/api/connectors/browser-activity/health', apiRateLimiter, (_req: Request, res: Response) => {
    res.json({ success: true, status: 'ok' });
  });

  app.post('/api/connectors/browser-activity/ingest', apiRateLimiter, async (req: Request, res: Response) => {
    if (!isLoopbackRequest(req)) {
      res.status(403).json({ success: false, msg: 'Browser activity ingest only accepts loopback requests' });
      return;
    }

    try {
      const payload = parseEnvelope(req.body);
      const targetSpace = await resolveTargetSpace(payload.space_id);
      const context = normalizeContext(req, payload);
      const events = getEvents(payload);

      let accepted = 0;
      let rejected = 0;
      const results = [] as Array<{ sourceId: string; documentId?: string; chunkCount: number }>;

      for (const event of events) {
        const ingestInput = mapEventToIngestInput(event, targetSpace.id, context);
        if (!ingestInput) {
          rejected += 1;
          continue;
        }

        try {
          const result = await browserActivityConnectorService.ingest(ingestInput);
          accepted += 1;
          results.push({
            sourceId: result.sourceId,
            documentId: result.documentId,
            chunkCount: result.chunkCount,
          });
        } catch {
          rejected += 1;
        }
      }

      res.json({
        success: true,
        data: {
          accepted,
          rejected,
          spaceId: targetSpace.id,
          connectorId: context.connectorId,
          profileLabel: context.profileLabel,
          browserFamily: context.browserFamily,
          results,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        msg: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
