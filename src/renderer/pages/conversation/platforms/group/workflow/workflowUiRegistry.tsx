/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkflowTemplatePackageManifest } from '@/common/config/workflowTemplates';
import type { WorkflowGroupTemplateDefinition } from '@/common/config/group';
import type { TChatConversation, WorkflowGroupTemplate } from '@/common/config/storage';
import React from 'react';
import type { TFunction } from 'i18next';
import WorkflowTemplateFields, { type WorkflowTemplateFieldValues } from './WorkflowTemplateFields';
import { BUILT_IN_WORKFLOW_TEMPLATE_UI_PACKAGES } from './builtInPackages';

type WorkflowConversation = Extract<TChatConversation, { type: 'group' }>;

export type WorkflowTemplateUiDefinition = {
  id: WorkflowGroupTemplate;
  HeaderAddon: React.ComponentType<{ conversation: WorkflowConversation }>;
  ConfigFields?: React.ComponentType<{
    templateDefinition: WorkflowGroupTemplateDefinition;
    values: WorkflowTemplateFieldValues;
    onChange: (key: keyof WorkflowTemplateFieldValues, value: string | number) => void;
    t: TFunction<'translation', undefined>;
  }>;
};

export type WorkflowTemplateUiPackage = {
  manifest: WorkflowTemplatePackageManifest;
  ui: WorkflowTemplateUiDefinition;
};

const workflowUiRegistry = new Map<WorkflowGroupTemplate, WorkflowTemplateUiDefinition>();

export const registerWorkflowTemplateUi = (definition: WorkflowTemplateUiDefinition): void => {
  workflowUiRegistry.set(definition.id, definition);
};

export const registerWorkflowTemplateUiPackage = (templatePackage: WorkflowTemplateUiPackage): void => {
  if (templatePackage.manifest.id !== templatePackage.ui.id) {
    throw new Error(
      `Workflow template UI package id mismatch: ${templatePackage.manifest.id} !== ${templatePackage.ui.id}`
    );
  }

  registerWorkflowTemplateUi(templatePackage.ui);
};

for (const templatePackage of BUILT_IN_WORKFLOW_TEMPLATE_UI_PACKAGES) {
  registerWorkflowTemplateUiPackage(templatePackage);
}

export const renderWorkflowHeaderAddon = (conversation: TChatConversation): React.ReactNode => {
  if (conversation.type !== 'group' || conversation.extra.orchestration.kind !== 'workflow') {
    return null;
  }

  const Component = workflowUiRegistry.get(conversation.extra.orchestration.template)?.HeaderAddon;
  if (!Component) {
    return null;
  }

  return <Component conversation={conversation} />;
};

export const renderWorkflowTemplateConfigFields = (options: {
  template: WorkflowGroupTemplate;
  templateDefinition: WorkflowGroupTemplateDefinition;
  values: WorkflowTemplateFieldValues;
  onChange: (key: keyof WorkflowTemplateFieldValues, value: string | number) => void;
  t: TFunction<'translation', undefined>;
}): React.ReactNode => {
  const Component = workflowUiRegistry.get(options.template)?.ConfigFields || WorkflowTemplateFields;
  return (
    <Component
      templateDefinition={options.templateDefinition}
      values={options.values}
      onChange={options.onChange}
      t={options.t}
    />
  );
};
