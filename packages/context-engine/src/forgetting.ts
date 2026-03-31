/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ForgettingReason =
  | 'pinned'
  | 'superseded'
  | 'expired'
  | 'stale'
  | 'low-signal'
  | 'contradicted'
  | 'source-removed';

export type ForgettingAction = 'retain' | 'deprioritize' | 'archive' | 'supersede' | 'delete';

export type ForgettingCandidate = {
  pinned: boolean;
  supersededById?: string;
  expired: boolean;
  contradictionCount: number;
  hitCount: number;
  confidence: number;
  createdAgeDays: number;
  lastAccessedAgeDays: number;
  sourceStillAvailable: boolean;
};

export type ForgettingPolicy = {
  deprioritizeAfterDays: number;
  archiveAfterDays: number;
  deleteAfterDays: number;
  minimumHitCountToRetain: number;
  contradictionThreshold: number;
  minimumConfidenceToRetain: number;
};

export type ForgettingAssessment = {
  action: ForgettingAction;
  reasons: readonly ForgettingReason[];
  shouldWriteOpLog: boolean;
};

export const DEFAULT_FORGETTING_POLICY: ForgettingPolicy = {
  deprioritizeAfterDays: 14,
  archiveAfterDays: 45,
  deleteAfterDays: 180,
  minimumHitCountToRetain: 2,
  contradictionThreshold: 1,
  minimumConfidenceToRetain: 0.55,
};

/**
 * Decide whether a memory should be retained, decayed, archived, or forgotten.
 */
export function assessForgetting(
  candidate: ForgettingCandidate,
  policy: ForgettingPolicy = DEFAULT_FORGETTING_POLICY
): ForgettingAssessment {
  if (candidate.pinned) {
    return {
      action: 'retain',
      reasons: ['pinned'],
      shouldWriteOpLog: false,
    };
  }

  if (candidate.supersededById) {
    return {
      action: 'supersede',
      reasons: ['superseded'],
      shouldWriteOpLog: true,
    };
  }

  const reasons: ForgettingReason[] = [];

  if (candidate.expired) {
    reasons.push('expired');
  }
  if (candidate.contradictionCount >= policy.contradictionThreshold) {
    reasons.push('contradicted');
  }
  if (candidate.lastAccessedAgeDays >= policy.deprioritizeAfterDays) {
    reasons.push('stale');
  }
  if (candidate.hitCount < policy.minimumHitCountToRetain && candidate.confidence < policy.minimumConfidenceToRetain) {
    reasons.push('low-signal');
  }
  if (!candidate.sourceStillAvailable) {
    reasons.push('source-removed');
  }

  if (
    candidate.createdAgeDays >= policy.deleteAfterDays &&
    !candidate.sourceStillAvailable &&
    candidate.hitCount === 0
  ) {
    return {
      action: 'delete',
      reasons: reasons.includes('expired') ? reasons : [...reasons, 'expired'],
      shouldWriteOpLog: true,
    };
  }

  if (candidate.createdAgeDays >= policy.archiveAfterDays && reasons.length > 0) {
    return {
      action: 'archive',
      reasons,
      shouldWriteOpLog: true,
    };
  }

  if (reasons.includes('stale') || reasons.includes('low-signal')) {
    return {
      action: 'deprioritize',
      reasons,
      shouldWriteOpLog: true,
    };
  }

  return {
    action: 'retain',
    reasons,
    shouldWriteOpLog: false,
  };
}
