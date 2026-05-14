/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextEvent, ContextEventHandler, ContextEventMap, ContextEventName } from './types';

type HandlerMap = {
  [TName in ContextEventName]?: Set<ContextEventHandler<TName>>;
};

export class ContextEventBus {
  private readonly handlers: HandlerMap = {};

  on<TName extends ContextEventName>(type: TName, handler: ContextEventHandler<TName>): () => void {
    const bucket = (this.handlers[type] as Set<ContextEventHandler<TName>> | undefined) ?? new Set();
    bucket.add(handler);
    this.handlers[type] = bucket as HandlerMap[TName];
    return () => {
      bucket.delete(handler);
      if (bucket.size === 0) {
        delete this.handlers[type];
      }
    };
  }

  async emit<TName extends ContextEventName>(type: TName, payload: ContextEventMap[TName]): Promise<void> {
    const bucket = this.handlers[type] as Set<ContextEventHandler<TName>> | undefined;
    if (!bucket || bucket.size === 0) {
      return;
    }

    const event: ContextEvent<TName> = {
      type,
      payload,
    };

    for (const handler of bucket) {
      await handler(event);
    }
  }
}
