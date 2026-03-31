/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type CompactionTopic = 'preference' | 'constraint' | 'decision' | 'identity' | 'workflow';

export type CompactionStrategy =
  | 'merge-preferences'
  | 'roll-up-constraints'
  | 'compress-decisions'
  | 'stabilize-identity'
  | 'summarize-workflow';

export type CompactionCandidate = {
  topic: CompactionTopic;
  acceptedMemoryCount: number;
  redundantMemoryCount: number;
  contradictoryMemoryCount: number;
  staleMemoryCount: number;
  distinctSourceCount: number;
  approximateTokenCount: number;
};

export type CompactionPolicy = {
  minimumPressure: number;
  minimumAcceptedMemoryCount: number;
  minimumTokenPressure: number;
  minimumRedundancyRatio: number;
  maximumContradictionRatio: number;
  tokenPressureWeight: number;
  redundancyWeight: number;
  staleMemoryWeight: number;
  sourceCoverageBonus: number;
};

export type CompactionDecision = {
  pressure: number;
  shouldCompact: boolean;
  strategy: CompactionStrategy;
  rationale: readonly string[];
};

export const DEFAULT_COMPACTION_POLICY: CompactionPolicy = {
  minimumPressure: 45,
  minimumAcceptedMemoryCount: 3,
  minimumTokenPressure: 600,
  minimumRedundancyRatio: 0.35,
  maximumContradictionRatio: 0.3,
  tokenPressureWeight: 20,
  redundancyWeight: 35,
  staleMemoryWeight: 15,
  sourceCoverageBonus: 10,
};

function ratio(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return value / total;
}

export function inferCompactionStrategy(topic: CompactionTopic): CompactionStrategy {
  switch (topic) {
    case 'constraint':
      return 'roll-up-constraints';
    case 'decision':
      return 'compress-decisions';
    case 'identity':
      return 'stabilize-identity';
    case 'workflow':
      return 'summarize-workflow';
    case 'preference':
    default:
      return 'merge-preferences';
  }
}

/**
 * Estimate compaction pressure before merging many memories into profile-level state.
 */
export function estimateCompactionPressure(
  candidate: CompactionCandidate,
  policy: CompactionPolicy = DEFAULT_COMPACTION_POLICY
): number {
  const tokenPressureScore =
    Math.min(candidate.approximateTokenCount / policy.minimumTokenPressure, 2) * policy.tokenPressureWeight;
  const redundancyScore =
    ratio(candidate.redundantMemoryCount, candidate.acceptedMemoryCount) * policy.redundancyWeight;
  const staleScore = ratio(candidate.staleMemoryCount, candidate.acceptedMemoryCount) * policy.staleMemoryWeight;
  const sourceCoverageScore = candidate.distinctSourceCount >= 2 ? policy.sourceCoverageBonus : 0;
  const contradictionPenalty = ratio(candidate.contradictoryMemoryCount, candidate.acceptedMemoryCount) * 40;
  const minimumCountScore = candidate.acceptedMemoryCount >= policy.minimumAcceptedMemoryCount ? 12 : -12;

  return Math.max(
    0,
    Math.round(
      tokenPressureScore + redundancyScore + staleScore + sourceCoverageScore + minimumCountScore - contradictionPenalty
    )
  );
}

/**
 * Decide whether accepted memories are ready to be compacted into a profile segment.
 */
export function decideCompaction(
  candidate: CompactionCandidate,
  policy: CompactionPolicy = DEFAULT_COMPACTION_POLICY
): CompactionDecision {
  const pressure = estimateCompactionPressure(candidate, policy);
  const redundancyRatio = ratio(candidate.redundantMemoryCount, candidate.acceptedMemoryCount);
  const contradictionRatio = ratio(candidate.contradictoryMemoryCount, candidate.acceptedMemoryCount);
  const rationale: string[] = [];

  if (candidate.acceptedMemoryCount >= policy.minimumAcceptedMemoryCount) {
    rationale.push('memory-count-ready');
  } else {
    rationale.push('insufficient-memory-count');
  }
  if (candidate.approximateTokenCount >= policy.minimumTokenPressure) {
    rationale.push('token-pressure-high');
  }
  if (redundancyRatio >= policy.minimumRedundancyRatio) {
    rationale.push('redundancy-high');
  }
  if (candidate.distinctSourceCount >= 2) {
    rationale.push('cross-source-coverage');
  }
  if (contradictionRatio > policy.maximumContradictionRatio) {
    rationale.push('resolve-contradictions-first');
  }

  const shouldCompact =
    candidate.acceptedMemoryCount >= policy.minimumAcceptedMemoryCount &&
    contradictionRatio <= policy.maximumContradictionRatio &&
    (pressure >= policy.minimumPressure || redundancyRatio >= policy.minimumRedundancyRatio);

  rationale.push(shouldCompact ? 'compact-now' : 'defer-compaction');

  return {
    pressure,
    shouldCompact,
    strategy: inferCompactionStrategy(candidate.topic),
    rationale,
  };
}
