import { describe, expect, it } from 'vitest';
import {
  assessForgetting,
  createInMemoryContextEngineDependencies,
  decideCompaction,
  decidePromotion,
  defineExternalMemoryStrategyAdapter,
  defineExternalMemoryStrategyRegistryEntry,
  selectExternalMemoryStrategyAdapter,
  type ContextEngineExternalMemoryBinding,
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

describe('external memory strategy adapters', () => {
  it('defines a runtime-neutral strategy adapter descriptor with explicit capability metadata', () => {
    const descriptor = defineExternalMemoryStrategyAdapter({
      id: 'mem0-compatible',
      version: '1.0.0',
      displayName: 'Mem0 Compatible Strategy',
      governanceScopes: ['session_steward', 'project_curator'],
      capabilities: {
        profile: true,
        search: true,
        reflect: false,
        graph: false,
        conclude: true,
        prefetch: false,
        trustScore: true,
        toolSurface: 'optional',
      },
      writeSemantics: {
        mode: 'async',
      },
      recallSemantics: {
        mode: 'hybrid',
      },
      performance: {
        latencyClass: 'remote',
        costClass: 'llm_dependent',
      },
      config: {
        schemaRef: 'contextgo://strategy-adapters/mem0-compatible',
        secretKeys: ['apiKey'],
        supportsWorkspaceOverrides: true,
      },
      safety: {
        durableWrites: true,
        sideEffects: 'external_memory_write',
        approvalMode: 'workspace_policy',
      },
      composition: {
        dualLoopParticipation: {
          session: true,
          project: true,
          space: false,
        },
        agentPackage: {
          runtimeNeutral: true,
          capabilityKey: 'external-memory-strategy',
        },
      },
    });

    expect(descriptor.id).toBe('mem0-compatible');
    expect(descriptor.capabilities.search).toBe(true);
    expect(descriptor.recallSemantics.mode).toBe('hybrid');
    expect(descriptor.safety.approvalMode).toBe('workspace_policy');
    expect(descriptor.composition.agentPackage.runtimeNeutral).toBe(true);
  });

  it('registers strategy descriptors separately from the active engine selection', () => {
    const descriptor = defineExternalMemoryStrategyAdapter({
      id: 'honcho-compatible',
      version: '1.0.0',
      displayName: 'Honcho Compatible Strategy',
      governanceScopes: ['session_steward', 'space_curator'],
      capabilities: {
        profile: true,
        search: true,
        reflect: true,
        graph: false,
        conclude: false,
        prefetch: true,
        trustScore: false,
        toolSurface: 'required',
      },
      writeSemantics: {
        mode: 'session_end',
      },
      recallSemantics: {
        mode: 'tools_only',
      },
      performance: {
        latencyClass: 'remote',
        costClass: 'cheap',
      },
      config: {
        schemaRef: 'contextgo://strategy-adapters/honcho-compatible',
        secretKeys: ['apiKey'],
        supportsWorkspaceOverrides: false,
      },
      safety: {
        durableWrites: false,
        sideEffects: 'none',
        approvalMode: 'human_review',
      },
      composition: {
        dualLoopParticipation: {
          session: true,
          project: false,
          space: true,
        },
        agentPackage: {
          runtimeNeutral: true,
          capabilityKey: 'external-memory-strategy',
        },
      },
    });
    const registryEntry = defineExternalMemoryStrategyRegistryEntry({
      descriptor,
      packageCompatibility: {
        agentPackageIds: ['contextgo/default-governance'],
        runtimeNeutral: true,
      },
    });
    const dependencies = createInMemoryContextEngineDependencies({
      externalMemory: {
        registry: [registryEntry],
        activeSelection: selectExternalMemoryStrategyAdapter({
          adapterId: 'honcho-compatible',
          activeScopes: ['session_steward', 'space_curator'],
          mountedToolsOnly: true,
        }),
      },
    });

    expect(dependencies.externalMemory?.registry[0]?.descriptor.id).toBe('honcho-compatible');
    expect(dependencies.externalMemory?.activeSelection.activeScopes).toEqual(['session_steward', 'space_curator']);
    expect(dependencies.externalMemory?.activeSelection.mountedToolsOnly).toBe(true);
    expect(dependencies.externalMemory?.registry[0]?.packageCompatibility.runtimeNeutral).toBe(true);
  });

  it('allows registered adapters to exist before any adapter is selected', () => {
    const descriptor = defineExternalMemoryStrategyAdapter({
      id: 'supermemory-compatible',
      version: '1.0.0',
      displayName: 'Supermemory Compatible Strategy',
      governanceScopes: ['project_curator'],
      capabilities: {
        profile: false,
        search: true,
        reflect: true,
        graph: true,
        conclude: false,
        prefetch: true,
        trustScore: false,
        toolSurface: 'required',
      },
      writeSemantics: {
        mode: 'batch',
      },
      recallSemantics: {
        mode: 'tools_only',
      },
      performance: {
        latencyClass: 'remote',
        costClass: 'expensive',
      },
      config: {
        schemaRef: 'contextgo://strategy-adapters/supermemory-compatible',
        secretKeys: ['apiKey'],
        supportsWorkspaceOverrides: false,
      },
      safety: {
        durableWrites: false,
        sideEffects: 'none',
        approvalMode: 'human_review',
      },
      composition: {
        dualLoopParticipation: {
          session: false,
          project: true,
          space: true,
        },
        agentPackage: {
          runtimeNeutral: true,
          capabilityKey: 'external-memory-strategy',
        },
      },
    });
    const registryEntry = defineExternalMemoryStrategyRegistryEntry({
      descriptor,
      packageCompatibility: {
        agentPackageIds: ['contextgo/space-curation'],
        runtimeNeutral: true,
      },
    });
    const externalMemory: ContextEngineExternalMemoryBinding = {
      registry: [registryEntry],
    };
    const dependencies = createInMemoryContextEngineDependencies({
      externalMemory,
    });

    expect(dependencies.externalMemory?.registry).toHaveLength(1);
    expect(dependencies.externalMemory?.activeSelection).toBeUndefined();
  });
});
