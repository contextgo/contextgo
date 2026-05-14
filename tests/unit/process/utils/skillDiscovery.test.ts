/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverSkillDirectories, resolveSkillDirectory } from '../../../../src/process/utils/skillDiscovery';

describe('skillDiscovery', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('discovers skills nested inside a child pack of a skill pack', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-skill-discovery-'));
    tempDirs.push(rootDir);

    const skillDir = path.join(
      rootDir,
      'engineering-pack',
      'skills',
      'workflow-foundations-pack',
      'skills',
      'brainstorming'
    );
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      `---\nname: brainstorming\ndescription: Deeply nested workflow skill\n---\n`,
      'utf-8'
    );

    const discovered = await discoverSkillDirectories(rootDir);
    expect(discovered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'brainstorming',
          description: 'Deeply nested workflow skill',
          dirPath: skillDir,
        }),
      ])
    );

    const resolved = await resolveSkillDirectory(rootDir, 'brainstorming');
    expect(resolved).toEqual(
      expect.objectContaining({
        name: 'brainstorming',
        dirPath: skillDir,
      })
    );
  });
});
