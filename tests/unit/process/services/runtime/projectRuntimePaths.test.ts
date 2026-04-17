import { describe, expect, it } from 'vitest';
import {
  getProjectRuntimeConfigDir,
  getProjectRuntimePolicyPath,
  getProjectRuntimeRoot,
  getProjectRuntimeSkillsDir,
} from '@process/services/runtime/ProjectRuntimePaths';

describe('ProjectRuntimePaths', () => {
  it('resolves the project runtime root under .contextgo', () => {
    expect(getProjectRuntimeRoot('/workspace/app')).toBe('/workspace/app/.contextgo');
    expect(getProjectRuntimePolicyPath('/workspace/app')).toBe('/workspace/app/.contextgo/runtime.json');
    expect(getProjectRuntimeSkillsDir('/workspace/app')).toBe('/workspace/app/.contextgo/skills');
    expect(getProjectRuntimeConfigDir('/workspace/app', 'codex')).toBe('/workspace/app/.contextgo/codex');
  });
});
