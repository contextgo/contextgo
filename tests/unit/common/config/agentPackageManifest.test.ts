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

      expect(manifest.payloads.rules.installSurface).toBe('assistant-rules-cache');
      expect(manifest.payloads.docs.installSurface).toBe('package-docs');

      for (const filePath of Object.values(manifest.payloads.rules.files)) {
        expect(fs.existsSync(path.join(REPO_ROOT, resourceDir, filePath))).toBe(true);
      }

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

      if (manifest.payloads.commands && manifest.payloads.schedules) {
        expect(manifest.payloads.commands.workspaceAutomationProfile).toBe(
          manifest.payloads.schedules.workspaceAutomationProfile
        );
      }
    }
  });
});
