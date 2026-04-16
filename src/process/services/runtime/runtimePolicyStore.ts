/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectRuntimePolicy } from '@/common/types/projectRuntime';
import { getProjectRuntimePolicyPath } from './ProjectRuntimePaths';

export async function readProjectRuntimePolicy(workspace: string): Promise<ProjectRuntimePolicy | null> {
  try {
    const content = await fs.readFile(getProjectRuntimePolicyPath(workspace), 'utf-8');
    return JSON.parse(content) as ProjectRuntimePolicy;
  } catch {
    return null;
  }
}

export async function writeProjectRuntimePolicy(workspace: string, policy: ProjectRuntimePolicy): Promise<void> {
  const targetPath = getProjectRuntimePolicyPath(workspace);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(policy, null, 2) + '\n', 'utf-8');
}
