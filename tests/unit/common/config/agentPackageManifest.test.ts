/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  AGENT_PACKAGE_MANIFEST_FILE_NAME,
  parseAgentPackageManifest,
  type AgentPackageManifest,
  type AgentPackageSourceDescriptor,
} from '@/common/config/presets/agentPackageManifest';
import { ASSISTANT_PRESETS } from '@/common/config/presets/assistantPresets';
import {
  BUNDLED_AGENT_PACKAGE_DESCRIPTORS,
  findBundledAgentPackageDescriptorByPackageId,
  getBundledAgentPackageConnectorTypes,
  getBundledAgentPackageInstallSurfaces,
  hasBundledAgentPackageConnectorsPayload,
} from '@/common/config/presets/bundledAgentPackageRegistry';

const REPO_ROOT = path.resolve(__dirname, '../../../..');

function readManifest(resourceDir: string): AgentPackageManifest {
  const manifestPath = path.join(REPO_ROOT, resourceDir, AGENT_PACKAGE_MANIFEST_FILE_NAME);
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const parsed = parseAgentPackageManifest(JSON.parse(raw));

  expect(parsed, `Invalid agent package manifest: ${manifestPath}`).not.toBeNull();
  return parsed!;
}

function expectSourceRootExists(resourceDir: string, source: AgentPackageSourceDescriptor): void {
  if (source.kind === 'workspace-automation-profile') {
    expect(source.root.length).toBeGreaterThan(0);
    return;
  }

  const absolutePath =
    source.kind === 'package-relative'
      ? path.join(REPO_ROOT, resourceDir, source.root)
      : path.join(REPO_ROOT, source.root);

  expect(fs.existsSync(absolutePath), `Missing source root for ${resourceDir}: ${absolutePath}`).toBe(true);
}

function findPackageRelativeSkillFile(
  resourceDir: string,
  sources: AgentPackageSourceDescriptor[] | undefined,
  skillName: string
): string | null {
  for (const source of sources ?? []) {
    if (source.kind !== 'package-relative') {
      continue;
    }

    const skillFile = path.join(REPO_ROOT, resourceDir, source.root, skillName, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      return skillFile;
    }

    const sourceRoot = path.join(REPO_ROOT, resourceDir, source.root);
    if (!fs.existsSync(sourceRoot)) {
      continue;
    }

    for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const nestedSkillFile = path.join(sourceRoot, entry.name, 'SKILL.md');
      if (!fs.existsSync(nestedSkillFile)) {
        continue;
      }

      const skillContent = fs.readFileSync(nestedSkillFile, 'utf-8');
      if (new RegExp(`^name:\\s*${skillName}\\s*$`, 'm').test(skillContent)) {
        return nestedSkillFile;
      }
    }
  }

  return null;
}

describe('agent-package manifests', () => {
  it('keeps bundled package facts out of assistant preset metadata', () => {
    for (const preset of ASSISTANT_PRESETS) {
      expect(preset).not.toHaveProperty('resourceDir');
      expect(preset).not.toHaveProperty('ruleFiles');
      expect(preset).not.toHaveProperty('skillFiles');
      expect(preset).not.toHaveProperty('packagedSkillNames');
      expect(preset).not.toHaveProperty('defaultEnabledSkills');
      expect(preset).not.toHaveProperty('defaultEnabledHooks');
      expect(preset).not.toHaveProperty('workspaceAutomationProfile');
      expect(preset).not.toHaveProperty('workspaceSkillBootstrapStrategy');
      expect(preset).not.toHaveProperty('hideDefaultSkillsFromLibrary');
    }
  });

  it('exists and parses for every bundled assistant package', () => {
    for (const descriptor of BUNDLED_AGENT_PACKAGE_DESCRIPTORS) {
      const manifestPath = path.join(REPO_ROOT, descriptor.resourceDir, AGENT_PACKAGE_MANIFEST_FILE_NAME);
      expect(fs.existsSync(manifestPath), `Missing agent-package.json for ${descriptor.manifest.packageId}`).toBe(true);

      const manifest = readManifest(descriptor.resourceDir);
      expect(manifest.packageId).toBe(descriptor.manifest.packageId);
      expect(manifest.assistantPresetId).toBe(descriptor.manifest.assistantPresetId);
      expect(manifest.runtimeNeutral).toBe(true);
    }
  });

  it('exposes a bundled manifest for every builtin preset id', () => {
    for (const preset of ASSISTANT_PRESETS) {
      const descriptor = findBundledAgentPackageDescriptorByPackageId(preset.id);
      expect(descriptor, `Missing bundled manifest descriptor for ${preset.id}`).toBeTruthy();
      expect(descriptor?.manifest.assistantPresetId).toBe(`builtin-${preset.id}`);
    }
  });

  it('keeps bundled manifests self-contained and structurally valid', () => {
    for (const descriptor of BUNDLED_AGENT_PACKAGE_DESCRIPTORS) {
      const { manifest, resourceDir } = descriptor;

      expect(manifest.entryDocument.file).toBe('AGENTS.md');
      expect(manifest.docsDirectory?.root).toBe('docs');
      expect(manifest.payloads.workspaceScaffold).toBeDefined();
      expect(fs.existsSync(path.join(REPO_ROOT, resourceDir, manifest.entryDocument.file))).toBe(true);

      for (const payload of Object.values(manifest.payloads)) {
        if (!payload) {
          continue;
        }

        for (const source of payload.sources) {
          expectSourceRootExists(resourceDir, source);
        }
      }

      if (manifest.payloads.skills) {
        expect(manifest.payloads.skills.packagedSkillNames.length).toBeGreaterThan(0);
        expect(new Set(manifest.payloads.skills.packagedSkillNames).size).toBe(
          manifest.payloads.skills.packagedSkillNames.length
        );
      }

      if (manifest.payloads.connectors) {
        expect(manifest.payloads.connectors.connectorTypes.length).toBeGreaterThan(0);
        expect(new Set(manifest.payloads.connectors.connectorTypes).size).toBe(
          manifest.payloads.connectors.connectorTypes.length
        );
      }

      if (manifest.payloads.workspaceScaffold) {
        expect(manifest.payloads.workspaceScaffold.focusAreas.length).toBeGreaterThan(0);
        expect(manifest.payloads.workspaceScaffold.suggestedArtifacts.length).toBeGreaterThan(0);
        expect(manifest.entryDocument.runtimeEntryProjections?.map((projection) => projection.runtime)).toEqual([
          'claude',
          'gemini',
        ]);

        for (const template of manifest.payloads.workspaceScaffold.templates ?? []) {
          expect(fs.existsSync(path.join(REPO_ROOT, resourceDir, template.source))).toBe(true);
          expect(template.target.length).toBeGreaterThan(0);
        }
      }

      if (manifest.payloads.commands && manifest.payloads.schedules) {
        expect(manifest.payloads.commands.workspaceAutomationProfile).toBe(
          manifest.payloads.schedules.workspaceAutomationProfile
        );
      }
    }
  });

  it('ships richer workspace scaffold templates for the superpowers harness', () => {
    const manifest = readManifest('src/process/resources/assistant/engineering/superpowers');
    const scaffold = manifest.payloads.workspaceScaffold;

    expect(scaffold).toBeDefined();
    expect(scaffold?.templates?.some((template) => template.target === 'docs/testing.md')).toBe(true);
    expect(scaffold?.templates?.some((template) => template.target === 'docs/reviews/README.md')).toBe(true);
  });

  it('ships a lightweight engineering scaffold for karpathy coding guard without automation payloads', () => {
    const manifest = readManifest('src/process/resources/assistant/engineering/karpathy-coding-guard');
    const scaffold = manifest.payloads.workspaceScaffold;

    expect(scaffold).toBeDefined();
    expect(scaffold?.templates?.some((template) => template.target === 'docs/assumptions/README.md')).toBe(true);
    expect(scaffold?.templates?.some((template) => template.target === 'docs/changes/README.md')).toBe(true);
    expect(scaffold?.templates?.some((template) => template.target === 'docs/verification/README.md')).toBe(true);
    expect(manifest.payloads.commands).toBeUndefined();
    expect(manifest.payloads.hooks).toBeUndefined();
    expect(manifest.payloads.schedules).toBeUndefined();
  });

  it('ships a marketing creative package with campaign automation and brand-oriented workspace scaffold', () => {
    const manifest = readManifest('src/process/resources/assistant/creative/marketing-creative-studio');

    expect(manifest.payloads.skills?.packagedSkillNames).toEqual([
      'marketing-context-normalizer',
      'brand-theme-pack',
      'ad-creative-builder',
      'social-asset-batch',
      'visual-copy-pairing',
      'campaign-variant-generator',
    ]);
    expect(manifest.payloads.commands?.workspaceAutomationProfile).toBe('marketing-creative-studio');
    expect(manifest.payloads.schedules?.workspaceAutomationProfile).toBe('marketing-creative-studio');
    expect(
      manifest.payloads.workspaceScaffold?.templates?.some((template) => template.target === 'docs/brand/README.md')
    ).toBe(true);
    expect(
      manifest.payloads.workspaceScaffold?.templates?.some((template) => template.target === 'docs/campaigns/README.md')
    ).toBe(true);
    expect(
      manifest.payloads.workspaceScaffold?.templates?.some((template) => template.target === 'docs/assets/README.md')
    ).toBe(true);
  });

  it('ships a HyperFrames video package with local skills, CLI requirements, and video workspace scaffold', () => {
    const manifest = readManifest('src/process/resources/assistant/creative/hyperframes-video-studio');

    expect(manifest.payloads.skills?.sources).toEqual([
      { kind: 'package-relative', root: 'official-skills/core/skills' },
      { kind: 'package-relative', root: 'official-skills/adapters/skills' },
      { kind: 'package-relative', root: 'official-skills/migration/skills' },
      { kind: 'package-relative', root: 'contextgo-skills/skills' },
    ]);
    expect(manifest.payloads.skills?.bootstrapStrategy).toBe('packaged-skills');
    expect(manifest.payloads.skills?.defaultEnabledSkillNames).toEqual([
      'hyperframes',
      'hyperframes-composition',
      'hyperframes-cli',
      'hyperframes-media',
      'hyperframes-registry',
      'website-to-hyperframes',
      'website-to-video',
      'article-to-video',
      'data-to-video',
      'hyperframes-qc',
    ]);
    expect(manifest.payloads.skills?.packagedSkillNames).toEqual([
      'hyperframes',
      'hyperframes-cli',
      'hyperframes-media',
      'hyperframes-registry',
      'website-to-hyperframes',
      'animejs',
      'css-animations',
      'gsap',
      'lottie',
      'tailwind',
      'three',
      'waapi',
      'remotion-to-hyperframes',
      'hyperframes-composition',
      'website-to-video',
      'article-to-video',
      'data-to-video',
      'ai-media-to-hyperframes',
      'hyperframes-qc',
    ]);
    expect(manifest.payloads.requirements?.tools?.map((tool) => tool.id)).toEqual([
      'nodejs-22',
      'ffmpeg',
      'hyperframes-cli',
      'docker',
    ]);
    expect(manifest.payloads.commands?.workspaceAutomationProfile).toBe('hyperframes-video-studio');
    expect(manifest.payloads.schedules?.workspaceAutomationProfile).toBe('hyperframes-video-studio');
    expect(
      manifest.payloads.workspaceScaffold?.templates?.some((template) => template.target === 'docs/videos/README.md')
    ).toBe(true);
    expect(
      manifest.payloads.workspaceScaffold?.templates?.some(
        (template) => template.target === 'docs/videos/manifests/README.md'
      )
    ).toBe(true);

    for (const skillName of manifest.payloads.skills?.packagedSkillNames ?? []) {
      const skillFile = findPackageRelativeSkillFile(
        'src/process/resources/assistant/creative/hyperframes-video-studio',
        manifest.payloads.skills?.sources,
        skillName
      );
      expect(skillFile, `Missing packaged HyperFrames skill: ${skillName}`).not.toBeNull();
    }
  });

  it('ships the complete upstream Remotion skill tree plus ContextGo workflow wrappers', () => {
    const resourceDir = 'src/process/resources/assistant/creative/remotion-video-studio';
    const manifest = readManifest(resourceDir);
    const upstreamFiles = [
      'SKILL.md',
      'rules/visual/3d.md',
      'rules/visual/audio-visualization.md',
      'rules/media/audio.md',
      'rules/core/calculate-metadata.md',
      'rules/core/compositions.md',
      'rules/captions/display-captions.md',
      'rules/tools/ffmpeg.md',
      'rules/tools/get-audio-duration.md',
      'rules/tools/get-video-dimensions.md',
      'rules/tools/get-video-duration.md',
      'rules/media/gifs.md',
      'rules/fonts/google-fonts.md',
      'rules/visual/html-in-canvas.md',
      'rules/media/images.md',
      'rules/captions/import-srt-captions.md',
      'rules/visual/light-leaks.md',
      'rules/fonts/local-fonts.md',
      'rules/media/lottie.md',
      'rules/visual/mapbox.md',
      'rules/visual/measuring-dom-nodes.md',
      'rules/visual/measuring-text.md',
      'rules/core/parameters.md',
      'rules/core/sequencing.md',
      'rules/visual/sfx.md',
      'rules/tools/silence-detection.md',
      'rules/captions/subtitles.md',
      'rules/visual/tailwind.md',
      'rules/visual/text-animations.md',
      'rules/core/timing.md',
      'rules/captions/transcribe-captions.md',
      'rules/core/transitions.md',
      'rules/media/transparent-videos.md',
      'rules/core/trimming.md',
      'rules/media/videos.md',
      'rules/captions/voiceover.md',
      'rules/assets/charts-bar-chart.tsx',
      'rules/assets/text-animations-typewriter.tsx',
      'rules/assets/text-animations-word-highlight.tsx',
    ];

    expect(manifest.payloads.skills?.sources).toEqual([
      { kind: 'package-relative', root: 'official-skills/skills' },
      { kind: 'package-relative', root: 'contextgo-skills/skills' },
    ]);
    expect(manifest.payloads.skills?.bootstrapStrategy).toBe('packaged-skills');
    expect(manifest.payloads.skills?.packagedSkillNames).toEqual([
      'remotion-best-practices',
      'remotion-project-bootstrap',
      'remotion-composition',
      'remotion-render-ops',
      'remotion-player-app',
      'remotion-captions',
      'remotion-ai-media',
      'remotion-lambda',
      'remotion-qc',
    ]);
    expect(manifest.payloads.skills?.defaultEnabledSkillNames).toEqual([
      'remotion-best-practices',
      'remotion-project-bootstrap',
      'remotion-composition',
      'remotion-render-ops',
      'remotion-player-app',
      'remotion-captions',
      'remotion-ai-media',
      'remotion-qc',
    ]);
    expect(manifest.payloads.commands?.workspaceAutomationProfile).toBe('remotion-video-studio');
    expect(manifest.payloads.schedules?.workspaceAutomationProfile).toBe('remotion-video-studio');
    expect(manifest.payloads.requirements?.tools?.map((tool) => tool.id)).toEqual(
      expect.arrayContaining(['nodejs-modern', 'package-manager', 'create-video', 'remotion-cli', 'ffmpeg', 'aws-cli'])
    );
    expect(manifest.payloads.workspaceScaffold?.templates?.map((template) => template.target)).toEqual(
      expect.arrayContaining([
        'docs/videos/remotion/README.md',
        'docs/videos/remotion/projects/README.md',
        'docs/videos/remotion/assets/README.md',
        'docs/videos/remotion/manifests/README.md',
        'docs/videos/remotion/qc/README.md',
      ])
    );

    for (const skillName of manifest.payloads.skills?.packagedSkillNames ?? []) {
      const skillFile = findPackageRelativeSkillFile(resourceDir, manifest.payloads.skills?.sources, skillName);
      expect(skillFile, `Missing packaged Remotion skill: ${skillName}`).not.toBeNull();
    }

    for (const file of upstreamFiles) {
      expect(
        fs.existsSync(path.join(REPO_ROOT, resourceDir, 'official-skills/skills/remotion', file)),
        `Missing vendored upstream Remotion file: ${file}`
      ).toBe(true);
    }
  });

  it('ships a Figma round-trip skill set and figma-closed-loop automation profile', () => {
    const manifest = readManifest('src/process/resources/assistant/design/figma-closed-loop');

    expect(manifest.payloads.skills?.packagedSkillNames).toEqual([
      'figma-file-bootstrap',
      'figma-screen-generate',
      'figma-library-sync',
      'figma-design-system-rules-sync',
      'figma-implementation-handoff',
      'figma-drift-audit',
    ]);
    expect(manifest.payloads.connectors?.connectorTypes).toEqual(['figma']);
    expect(manifest.payloads.skills?.hidePackageOwnedSkillsFromLibrary).toBe(true);
    expect(manifest.payloads.commands?.workspaceAutomationProfile).toBe('figma-closed-loop');
    expect(manifest.payloads.schedules?.workspaceAutomationProfile).toBe('figma-closed-loop');
  });

  it('parses a connectors payload as a first-class package surface', () => {
    const manifest = parseAgentPackageManifest({
      protocolVersion: 'agent-package.v1',
      packageId: 'test-package',
      assistantPresetId: 'builtin-test-package',
      displayName: 'Test Package',
      runtimeNeutral: true,
      entryDocument: {
        file: 'AGENTS.md',
      },
      payloads: {
        connectors: {
          logicalId: 'connectors',
          sources: [{ kind: 'package-relative', root: 'docs' }],
          installSurface: '.contextgo/connectors/',
          runtimeProjection: 'none',
          connectorTypes: ['figma', 'github'],
        },
      },
    });

    expect(manifest?.payloads.connectors).toEqual({
      logicalId: 'connectors',
      sources: [{ kind: 'package-relative', root: 'docs' }],
      installSurface: '.contextgo/connectors/',
      runtimeProjection: 'none',
      connectorTypes: ['figma', 'github'],
    });
  });

  it('parses a requirements payload as a first-class package surface', () => {
    const manifest = parseAgentPackageManifest({
      protocolVersion: 'agent-package.v1',
      packageId: 'test-package',
      assistantPresetId: 'builtin-test-package',
      displayName: 'Test Package',
      runtimeNeutral: true,
      entryDocument: {
        file: 'AGENTS.md',
      },
      payloads: {
        requirements: {
          logicalId: 'requirements',
          sources: [{ kind: 'package-relative', root: 'docs' }],
          installSurface: '.contextgo/requirements/',
          runtimeProjection: 'none',
          tools: [
            {
              id: 'figma-mcp',
              kind: 'mcp',
              required: true,
              label: 'Figma MCP server',
              ownerSkillNames: ['figma-screen-generate'],
              mcp: {
                serverId: 'figma',
                transport: 'streamable_http',
                url: 'https://mcp.figma.com/mcp',
              },
            },
          ],
          credentials: [
            {
              id: 'fal-key',
              kind: 'api_key',
              required: true,
              label: 'fal.ai API key',
              provider: 'fal-ai',
              env: 'FAL_KEY',
              fields: [{ key: 'apiKey', label: 'API key', secret: true, required: true }],
            },
          ],
          connectors: [
            {
              id: 'figma-connector',
              connectorType: 'figma',
              required: true,
              label: 'Figma connector',
              capabilities: ['files.read'],
            },
          ],
        },
      },
    });

    expect(manifest?.payloads.requirements).toEqual({
      logicalId: 'requirements',
      sources: [{ kind: 'package-relative', root: 'docs' }],
      installSurface: '.contextgo/requirements/',
      runtimeProjection: 'none',
      tools: [
        {
          id: 'figma-mcp',
          kind: 'mcp',
          required: true,
          label: 'Figma MCP server',
          ownerSkillNames: ['figma-screen-generate'],
          mcp: {
            serverId: 'figma',
            transport: 'streamable_http',
            url: 'https://mcp.figma.com/mcp',
          },
        },
      ],
      credentials: [
        {
          id: 'fal-key',
          kind: 'api_key',
          required: true,
          label: 'fal.ai API key',
          provider: 'fal-ai',
          env: 'FAL_KEY',
          fields: [{ key: 'apiKey', label: 'API key', secret: true, required: true }],
        },
      ],
      connectors: [
        {
          id: 'figma-connector',
          connectorType: 'figma',
          required: true,
          label: 'Figma connector',
          capabilities: ['files.read'],
        },
      ],
    });
  });

  it('rejects a connectors payload when connector types are missing', () => {
    const manifest = parseAgentPackageManifest({
      protocolVersion: 'agent-package.v1',
      packageId: 'test-package',
      assistantPresetId: 'builtin-test-package',
      displayName: 'Test Package',
      runtimeNeutral: true,
      entryDocument: {
        file: 'AGENTS.md',
      },
      payloads: {
        connectors: {
          logicalId: 'connectors',
          sources: [{ kind: 'package-relative', root: 'docs' }],
          installSurface: '.contextgo/connectors/',
          runtimeProjection: 'none',
          connectorTypes: [],
        },
      },
    });

    expect(manifest).toBeNull();
  });

  it('exposes bundled connector requirements and install surfaces through the registry', () => {
    expect(hasBundledAgentPackageConnectorsPayload('builtin-figma-closed-loop')).toBe(true);
    expect(getBundledAgentPackageConnectorTypes('builtin-figma-closed-loop')).toEqual(['figma']);
    expect(getBundledAgentPackageInstallSurfaces('builtin-figma-closed-loop')).toEqual([
      '.contextgo/skills',
      '.contextgo/connectors/',
      '.contextgo/requirements/',
      '.contextgo/commands.json',
      '.contextgo/schedules.json',
    ]);
  });

  it('ships specialized workspace scaffold templates for non-engineering builtin assistants', () => {
    const cases = [
      {
        resourceDir: 'src/process/resources/assistant/creative/marketing-creative-studio',
        expectedTargets: ['AGENTS.md', 'docs/brand/README.md', 'docs/campaigns/README.md', 'docs/assets/README.md'],
      },
      {
        resourceDir: 'src/process/resources/assistant/creative/motion-studio',
        expectedTargets: [
          'AGENTS.md',
          'docs/storyboards/README.md',
          'docs/scenes/README.md',
          'docs/renders/README.md',
          'docs/qc/README.md',
        ],
      },
      {
        resourceDir: 'src/process/resources/assistant/creative/hyperframes-video-studio',
        expectedTargets: [
          'AGENTS.md',
          'docs/videos/README.md',
          'docs/videos/briefs/README.md',
          'docs/videos/projects/README.md',
          'docs/videos/renders/README.md',
          'docs/videos/assets/README.md',
          'docs/videos/qc/README.md',
          'docs/videos/manifests/README.md',
        ],
      },
      {
        resourceDir: 'src/process/resources/assistant/creative/visual-artifact-runner',
        expectedTargets: ['AGENTS.md', 'docs/inputs/README.md', 'docs/recipes/README.md', 'docs/exports/README.md'],
      },
      {
        resourceDir: 'src/process/resources/assistant/startup/startup-strategist',
        expectedTargets: ['AGENTS.md', 'docs/ideas/README.md', 'docs/market/README.md', 'docs/strategy/README.md'],
      },
      {
        resourceDir: 'src/process/resources/assistant/design/design-director',
        expectedTargets: [
          'AGENTS.md',
          'docs/direction/README.md',
          'docs/references/README.md',
          'docs/handoff/README.md',
        ],
      },
      {
        resourceDir: 'src/process/resources/assistant/design/figma-closed-loop',
        expectedTargets: [
          'AGENTS.md',
          'docs/files/README.md',
          'docs/sync/README.md',
          'docs/handoff/README.md',
          'docs/drift/README.md',
        ],
      },
      {
        resourceDir: 'src/process/resources/assistant/product/pm-workbench',
        expectedTargets: ['AGENTS.md', 'docs/discovery/README.md', 'docs/prds/README.md', 'docs/roadmap/README.md'],
      },
      {
        resourceDir: 'src/process/resources/assistant/office/office-analyst',
        expectedTargets: ['AGENTS.md', 'docs/sources/README.md', 'docs/analysis/README.md', 'docs/reports/README.md'],
      },
      {
        resourceDir: 'src/process/resources/assistant/finance/finance-analyst',
        expectedTargets: [
          'AGENTS.md',
          'docs/analysis/README.md',
          'docs/valuation/README.md',
          'docs/scenarios/README.md',
        ],
      },
      {
        resourceDir: 'src/process/resources/assistant/engineering/karpathy-coding-guard',
        expectedTargets: [
          'AGENTS.md',
          'docs/assumptions/README.md',
          'docs/changes/README.md',
          'docs/verification/README.md',
        ],
      },
    ];

    for (const testCase of cases) {
      const manifest = readManifest(testCase.resourceDir);
      const scaffold = manifest.payloads.workspaceScaffold;

      expect(scaffold).toBeDefined();
      for (const expectedTarget of testCase.expectedTargets) {
        expect(scaffold?.templates?.some((template) => template.target === expectedTarget)).toBe(true);
      }
    }
  });

  it('keeps visual artifact runner skill payload package-local and complete', () => {
    const manifest = readManifest('src/process/resources/assistant/creative/visual-artifact-runner');
    const skillsPayload = manifest.payloads.skills;

    expect(skillsPayload).toBeDefined();
    expect(skillsPayload?.sources).toEqual([{ kind: 'package-relative', root: 'skills' }]);
    expect(skillsPayload?.packagedSkillNames).toEqual([
      'deck-from-brief',
      'deck-from-report',
      'pdf-to-deck',
      'report-to-infographic',
      'deck-theme-apply',
      'artifact-qc',
    ]);

    for (const skillName of skillsPayload?.packagedSkillNames ?? []) {
      const skillFile = path.join(
        REPO_ROOT,
        'src/process/resources/assistant/creative/visual-artifact-runner/skills',
        skillName,
        'SKILL.md'
      );
      expect(fs.existsSync(skillFile), `Missing packaged visual artifact skill: ${skillFile}`).toBe(true);
    }
  });
});
