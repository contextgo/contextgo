/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextJobType } from '../../contextDomain';
import type { ContextTriggerKind, ContextTriggerSpec } from './types';

export class ContextTriggerRegistry {
  private readonly triggers = new Map<string, ContextTriggerSpec>();

  constructor(seed: readonly ContextTriggerSpec[] = []) {
    seed.forEach((trigger) => {
      this.register(trigger);
    });
  }

  register(trigger: ContextTriggerSpec): void {
    this.triggers.set(trigger.id, trigger);
  }

  get(triggerId: string): ContextTriggerSpec | undefined {
    return this.triggers.get(triggerId);
  }

  getOrThrow(triggerId: string): ContextTriggerSpec {
    const trigger = this.get(triggerId);
    if (!trigger) {
      throw new Error(`Context trigger not found: ${triggerId}`);
    }
    return trigger;
  }

  findByKindAndJobType(kind: ContextTriggerKind, jobType: ContextJobType): ContextTriggerSpec | undefined {
    for (const trigger of this.triggers.values()) {
      if (trigger.kind === kind && trigger.jobType === jobType) {
        return trigger;
      }
    }
    return undefined;
  }

  list(): ContextTriggerSpec[] {
    return [...this.triggers.values()];
  }
}
