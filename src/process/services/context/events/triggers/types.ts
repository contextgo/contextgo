/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ContextJobPriority,
  ContextJobType,
  ContextJobSource,
  ProjectPromotionCandidate,
  SessionCompactionSnapshot,
} from '../../contextDomain';

export type ContextTriggerKind = 'hook' | 'lifecycle' | 'timer' | 'manual' | 'connector' | 'derived';

export type ContextTriggerScopeKind = 'conversation' | 'project' | 'space';

export type ContextTriggerBuilder = 'session_compaction' | 'project_promotion' | 'planned';

export type ContextTriggerSource = Extract<ContextJobSource, ContextTriggerKind>;

export type ContextTriggerSpec = {
  id: string;
  kind: ContextTriggerKind;
  source: ContextTriggerSource;
  builder: ContextTriggerBuilder;
  jobType: ContextJobType;
  scopeKind: ContextTriggerScopeKind;
  event: string;
  label: string;
  defaultPriority?: ContextJobPriority;
  defaultReason: string;
};

export type ContextTriggerDispatchInput = {
  triggerId: string;
  spaceId: string;
  threadId?: string;
  projectSlug?: string;
  firedAt?: string;
  reason?: string;
  priority?: ContextJobPriority;
  payload?: Readonly<Record<string, unknown>>;
  snapshot?: SessionCompactionSnapshot;
  candidate?: ProjectPromotionCandidate;
  triggerEvent?: string;
  triggerLabel?: string;
};
