/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkflowGroupTemplateDefinition } from '../group';
import type { WorkflowGroupTemplate } from '../storage';

export type WorkflowTemplatePackageManifest = {
  id: WorkflowGroupTemplate;
  definition: WorkflowGroupTemplateDefinition;
};
