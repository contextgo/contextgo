import { describe, expect, it } from 'vitest';
import {
  assessForgetting,
  decideCompaction,
  decidePromotion,
  type ForgettingCandidate,
  type PromotionCandidate,
} from '../../../packages/context-engine/src/index';

describe('context-engine policies', () => {
  it('promotes explicitly confirmed memory candidates even with thin evidence', () => {
    const candidate: PromotionCandidate = {
      memoryKind: 'preference',
      confidence: 0.58,
      evidenceCount: 1,
      repeatedAcrossSources: 0,
      recentReferenceCount: 1,
      userConfirmed: true,
      manuallyPinned: false,
      executionBacked: false,
      contradictionDetected: false,
    };

    const decision = decidePromotion(candidate);

    expect(decision.shouldPromote).toBe(true);
    expect(decision.rationale).toContain('explicit-user-confirmation');
    expect(decision.rationale).toContain('promote');
  });

  it('blocks automatic promotion when contradiction exists without an explicit override', () => {
    const candidate: PromotionCandidate = {
      memoryKind: 'fact',
      confidence: 0.92,
      evidenceCount: 4,
      repeatedAcrossSources: 3,
      recentReferenceCount: 4,
      userConfirmed: false,
      manuallyPinned: false,
      executionBacked: true,
      contradictionDetected: true,
    };

    const decision = decidePromotion(candidate);

    expect(decision.shouldPromote).toBe(false);
    expect(decision.rationale).toContain('contradiction-detected');
    expect(decision.rationale).toContain('keep-as-candidate');
  });

  it('compacts repeated preferences when token pressure and redundancy are high', () => {
    const decision = decideCompaction({
      topic: 'preference',
      acceptedMemoryCount: 6,
      redundantMemoryCount: 4,
      contradictoryMemoryCount: 0,
      staleMemoryCount: 2,
      distinctSourceCount: 3,
      approximateTokenCount: 1200,
    });

    expect(decision.shouldCompact).toBe(true);
    expect(decision.strategy).toBe('merge-preferences');
    expect(decision.rationale).toContain('compact-now');
  });

  it('retains pinned memories even when they are old', () => {
    const candidate: ForgettingCandidate = {
      pinned: true,
      expired: false,
      contradictionCount: 3,
      hitCount: 0,
      confidence: 0.1,
      createdAgeDays: 365,
      lastAccessedAgeDays: 365,
      sourceStillAvailable: false,
    };

    const assessment = assessForgetting(candidate);

    expect(assessment.action).toBe('retain');
    expect(assessment.reasons).toEqual(['pinned']);
  });

  it('archives stale low-signal memories before hard deletion when source still exists', () => {
    const candidate: ForgettingCandidate = {
      pinned: false,
      expired: true,
      contradictionCount: 0,
      hitCount: 1,
      confidence: 0.2,
      createdAgeDays: 60,
      lastAccessedAgeDays: 40,
      sourceStillAvailable: true,
    };

    const assessment = assessForgetting(candidate);

    expect(assessment.action).toBe('archive');
    expect(assessment.reasons).toContain('expired');
    expect(assessment.reasons).toContain('stale');
    expect(assessment.reasons).toContain('low-signal');
  });
});
