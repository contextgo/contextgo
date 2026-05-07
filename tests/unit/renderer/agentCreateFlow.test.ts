import { describe, expect, it } from 'vitest';
import {
  buildCapabilityRecommendation,
  buildCreateFlowSummary,
  type AgentCreateIntentDraft,
} from '@/renderer/pages/settings/AgentSettings/Workspace/create/createFlow';
import { buildAssistantWorkspaceModel } from '@/renderer/pages/settings/AgentSettings/Workspace/viewModel';

describe('buildCapabilityRecommendation', () => {
  it('should recommend pm workbench for product planning intent', () => {
    const draft: AgentCreateIntentDraft = {
      workDescription: 'Turn discovery notes into a PRD and roadmap',
      audience: 'Product team',
      output: 'PRD',
      workStyle: 'analyze',
      recurrence: 'frequent',
    };

    const recommendation = buildCapabilityRecommendation(draft);

    expect(recommendation.linkedPackagePresetId).toBe('builtin-pm-workbench');
    expect(recommendation.defaultSkills.length).toBeGreaterThan(0);
    expect(recommendation.commandCount).toBeGreaterThan(0);
    expect(recommendation.packageLabel).toBe('PM Workbench');
  });

  it('should recommend finance analyst for finance review intent', () => {
    const draft: AgentCreateIntentDraft = {
      workDescription: 'Analyze budget variance and financial statements',
      audience: 'Finance',
      output: 'Executive summary',
      workStyle: 'analyze',
      recurrence: 'frequent',
    };

    const recommendation = buildCapabilityRecommendation(draft);

    expect(recommendation.linkedPackagePresetId).toBe('builtin-finance-analyst');
    expect(recommendation.defaultSkills.length).toBeGreaterThan(0);
  });

  it('should recommend marketing creative studio for campaign asset intent', () => {
    const draft: AgentCreateIntentDraft = {
      workDescription: 'Build a multi-platform ad creative batch for campaign launch',
      audience: 'Growth marketing',
      output: 'Campaign variants and social assets',
      workStyle: 'create',
      recurrence: 'frequent',
    };

    const recommendation = buildCapabilityRecommendation(draft);

    expect(recommendation.linkedPackagePresetId).toBe('builtin-marketing-creative-studio');
    expect(recommendation.defaultSkills).toEqual(
      expect.arrayContaining(['marketing-context-normalizer', 'ad-creative-builder', 'campaign-variant-generator'])
    );
    expect(recommendation.commandCount).toBeGreaterThan(0);
  });

  it('should recommend motion studio for storyboard and render intent', () => {
    const draft: AgentCreateIntentDraft = {
      workDescription: 'Plan a storyboard and render social cutdowns for a launch video',
      audience: 'Growth and brand team',
      output: 'Storyboard JSON, renders, and QC report',
      workStyle: 'create',
      recurrence: 'frequent',
    };

    const recommendation = buildCapabilityRecommendation(draft);

    expect(recommendation.linkedPackagePresetId).toBe('builtin-motion-studio');
    expect(recommendation.packageLabel).toBe('Motion Studio');
    expect(recommendation.defaultSkills).toEqual(
      expect.arrayContaining([
        'motion-storyboard',
        'motion-scene-builder',
        'motion-poster-builder',
        'motion-render-ops',
        'motion-qc',
      ])
    );
    expect(recommendation.commandCount).toBeGreaterThan(0);
    expect(recommendation.runtime).toBe('codex');
  });

  it('should recommend HyperFrames video studio for deterministic website-to-video intent', () => {
    const draft: AgentCreateIntentDraft = {
      workDescription: 'Use HyperFrames to turn this website into an HTML-to-video MP4 render with captions',
      audience: 'Product marketing',
      output: 'MP4 render, manifest, and QC report',
      workStyle: 'create',
      recurrence: 'frequent',
    };

    const recommendation = buildCapabilityRecommendation(draft);

    expect(recommendation.linkedPackagePresetId).toBe('builtin-hyperframes-video-studio');
    expect(recommendation.packageLabel).toBe('HyperFrames Video Studio');
    expect(recommendation.defaultSkills).toEqual(
      expect.arrayContaining([
        'hyperframes',
        'hyperframes-composition',
        'hyperframes-cli',
        'website-to-hyperframes',
        'website-to-video',
        'hyperframes-qc',
      ])
    );
    expect(recommendation.commandCount).toBeGreaterThan(0);
    expect(recommendation.scheduleCount).toBe(2);
    expect(recommendation.runtime).toBe('codex');
  });

  it('should recommend visual artifact runner for deck/pdf artifact requests', () => {
    const draft: AgentCreateIntentDraft = {
      workDescription: 'Convert this PDF report into a polished deck artifact with QC and export notes',
      audience: 'Leadership team',
      output: 'Deck',
      workStyle: 'create',
      recurrence: 'frequent',
    };

    const recommendation = buildCapabilityRecommendation(draft);

    expect(recommendation.linkedPackagePresetId).toBe('builtin-visual-artifact-runner');
    expect(recommendation.defaultSkills).toEqual(
      expect.arrayContaining(['deck-from-brief', 'pdf-to-deck', 'report-to-infographic', 'artifact-qc'])
    );
    expect(recommendation.commandCount).toBeGreaterThan(0);
    expect(recommendation.scheduleCount).toBe(0);
    expect(recommendation.packageLabel).toBe('Visual Artifact Runner');
  });
});

describe('buildCreateFlowSummary', () => {
  it('should summarize the selected capability stack for the review step', () => {
    const summary = buildCreateFlowSummary({
      recommendation: {
        linkedPackagePresetId: 'builtin-pm-workbench',
        packageLabel: 'PM Workbench',
        packageDescription: 'Product management assistant',
        defaultSkills: ['pm-discovery', 'pm-prd'],
        defaultHooks: ['quality-gate'],
        commandCount: 4,
        scheduleCount: 1,
        docsCount: 2,
        agentsDocumentAvailable: true,
        runtime: 'codex',
        reasons: ['Matches roadmap and PRD work'],
      },
      editName: 'Roadmap Pilot',
      editDescription: 'Runs PM discovery and planning loops',
      workDescription: 'Draft roadmap and PRD',
      workStyle: 'analyze',
      recurrence: 'frequent',
    });

    expect(summary.capabilityCountLabel).toContain('2');
    expect(summary.capabilityCountLabel).toContain('1');
    expect(summary.runtimeLabel).toBe('codex');
    expect(summary.workSummary).toContain('Draft roadmap and PRD');
  });
});

describe('buildAssistantWorkspaceModel', () => {
  it('should resolve package-backed tabs for a custom assistant linked to a bundled package', () => {
    const model = buildAssistantWorkspaceModel({
      assistant: {
        id: 'custom-123',
        name: 'Roadmap Pilot',
        description: 'Custom PM agent',
        isPreset: true,
        isBuiltin: false,
        presetAgentType: 'codex',
        linkedPackagePresetId: 'builtin-pm-workbench',
      },
      availableSkills: [],
      availableHooks: [],
      pendingSkills: [],
      selectedSkills: [],
      selectedHooks: [],
    });

    expect(model.packageManifest?.packageId).toBe('pm-workbench');
    expect(model.availableTabs).toContain('commands');
    expect(model.availableTabs).toContain('docs');
    expect(model.availableTabs).toContain('agents');
  });
});
