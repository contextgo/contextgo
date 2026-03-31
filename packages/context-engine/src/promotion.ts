/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MemoryKind } from './domain';

export type PromotionCandidate = {
  memoryKind: MemoryKind;
  confidence: number;
  evidenceCount: number;
  repeatedAcrossSources: number;
  recentReferenceCount: number;
  userConfirmed: boolean;
  manuallyPinned: boolean;
  executionBacked: boolean;
  contradictionDetected: boolean;
};

export type PromotionPolicy = {
  minimumScore: number;
  minimumConfidence: number;
  minimumEvidenceCount: number;
  repeatWeight: number;
  recentReferenceWeight: number;
  explicitConfirmationBonus: number;
  manualPinBonus: number;
  executionBackedBonus: number;
  contradictionPenalty: number;
};

export type PromotionDecision = {
  score: number;
  shouldPromote: boolean;
  rationale: readonly string[];
};

export const DEFAULT_PROMOTION_POLICY: PromotionPolicy = {
  minimumScore: 65,
  minimumConfidence: 0.65,
  minimumEvidenceCount: 2,
  repeatWeight: 6,
  recentReferenceWeight: 3,
  explicitConfirmationBonus: 24,
  manualPinBonus: 30,
  executionBackedBonus: 12,
  contradictionPenalty: 28,
};

function clampProbability(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Score a promotion candidate before it becomes an accepted long-term memory.
 */
export function scorePromotionCandidate(
  candidate: PromotionCandidate,
  policy: PromotionPolicy = DEFAULT_PROMOTION_POLICY
): number {
  const confidenceScore = clampProbability(candidate.confidence) * 50;
  const evidenceScore = candidate.evidenceCount >= policy.minimumEvidenceCount ? 10 : -10;
  const repeatScore = Math.min(candidate.repeatedAcrossSources, 3) * policy.repeatWeight;
  const recentReferenceScore = Math.min(candidate.recentReferenceCount, 5) * policy.recentReferenceWeight;
  const explicitScore = candidate.userConfirmed ? policy.explicitConfirmationBonus : 0;
  const manualPinScore = candidate.manuallyPinned ? policy.manualPinBonus : 0;
  const executionScore = candidate.executionBacked ? policy.executionBackedBonus : 0;
  const contradictionScore = candidate.contradictionDetected ? -policy.contradictionPenalty : 0;

  return Math.max(
    0,
    Math.round(
      confidenceScore +
        evidenceScore +
        repeatScore +
        recentReferenceScore +
        explicitScore +
        manualPinScore +
        executionScore +
        contradictionScore
    )
  );
}

/**
 * Decide whether a candidate should be promoted into a durable memory entry.
 */
export function decidePromotion(
  candidate: PromotionCandidate,
  policy: PromotionPolicy = DEFAULT_PROMOTION_POLICY
): PromotionDecision {
  const score = scorePromotionCandidate(candidate, policy);
  const rationale: string[] = [];
  const explicitOverride = candidate.userConfirmed || candidate.manuallyPinned;
  const meetsConfidence = clampProbability(candidate.confidence) >= policy.minimumConfidence;
  const meetsEvidence = candidate.evidenceCount >= policy.minimumEvidenceCount;
  const contradictionBlocked = candidate.contradictionDetected && !explicitOverride;

  if (candidate.userConfirmed) {
    rationale.push('explicit-user-confirmation');
  }
  if (candidate.manuallyPinned) {
    rationale.push('manual-pin');
  }
  if (candidate.executionBacked) {
    rationale.push('execution-backed-evidence');
  }
  if (candidate.repeatedAcrossSources > 0) {
    rationale.push('cross-source-repeat');
  }
  if (candidate.contradictionDetected) {
    rationale.push('contradiction-detected');
  }
  if (!meetsEvidence && !explicitOverride) {
    rationale.push('insufficient-evidence');
  }
  if (!meetsConfidence && !explicitOverride) {
    rationale.push('confidence-below-threshold');
  }

  const shouldPromote =
    !contradictionBlocked && (explicitOverride || (score >= policy.minimumScore && meetsConfidence && meetsEvidence));

  if (shouldPromote) {
    rationale.push('promote');
  } else {
    rationale.push('keep-as-candidate');
  }

  return {
    score,
    shouldPromote,
    rationale,
  };
}
