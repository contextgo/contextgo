import { describe, expect, it } from 'vitest';
import {
  getProjectRuntimeConfigDir,
  getProjectRuntimePolicyPath,
  getProjectRuntimeRoot,
  getProjectRuntimeSkillsDir,
} from '@process/services/runtime/ProjectRuntimePaths';

describe('ProjectRuntimePaths', () => {
  it('resolves the project runtime root under .contextgo/runtime', () => {
    expect(getProjectRuntimeRoot('/workspace/app')).toBe('/workspace/app/.contextgo/runtime');
    expect(getProjectRuntimePolicyPath('/workspace/app')).toBe('/workspace/app/.contextgo/runtime/runtime.json');
    expect(getProjectRuntimeSkillsDir('/workspace/app')).toBe('/workspace/app/.contextgo/runtime/skills');
    expect(getProjectRuntimeConfigDir('/workspace/app', 'codex')).toBe('/workspace/app/.contextgo/runtime/codex');
  });
});
