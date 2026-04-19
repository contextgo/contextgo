/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import type { ProjectRuntimeBackend } from '@/common/types/projectRuntime';

export const getProjectRuntimeRoot = (workspace: string): string => path.join(workspace, '.contextgo');

export const getProjectRuntimeCompatibilityDir = (workspace: string, backend: ProjectRuntimeBackend): string =>
  path.join(getProjectRuntimeRoot(workspace), `.${backend}`);

export const getProjectRuntimePolicyPath = (workspace: string): string =>
  path.join(getProjectRuntimeRoot(workspace), 'runtime.json');

export const getProjectRuntimeSkillsDir = (workspace: string): string =>
  path.join(getProjectRuntimeRoot(workspace), 'skills');

export const getProjectRuntimeConfigDir = (workspace: string, backend: ProjectRuntimeBackend): string =>
  path.join(getProjectRuntimeRoot(workspace), backend);
