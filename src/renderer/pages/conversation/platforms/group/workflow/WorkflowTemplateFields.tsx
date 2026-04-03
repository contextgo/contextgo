/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkflowGroupTemplateDefinition, WorkflowTemplateFieldDefinition } from '@/common/config/group';
import type { WorkflowGroupReviewMode } from '@/common/config/storage';
import { Input, InputNumber, Select, Typography } from '@arco-design/web-react';
import React from 'react';
import type { TFunction } from 'i18next';
import { GROUP_MODAL_FIELD_CLASS_NAME, GROUP_MODAL_SELECT_CLASS_NAME } from '../GroupModalShared';

export type WorkflowTemplateFieldValues = {
  maxIterations: number;
  scoreTarget: number;
  artifactPath: string;
  reviewMode: WorkflowGroupReviewMode;
};

type WorkflowTemplateFieldsProps = {
  templateDefinition: WorkflowGroupTemplateDefinition;
  values: WorkflowTemplateFieldValues;
  onChange: (key: keyof WorkflowTemplateFieldValues, value: string | number) => void;
  t: TFunction<'translation', undefined>;
};

const renderFieldHint = (field: WorkflowTemplateFieldDefinition, t: TFunction<'translation', undefined>): string => {
  if (field.type === 'number') {
    return t(field.hintKey, {
      min: field.constraint.min,
      max: field.constraint.max,
    });
  }

  return t(field.hintKey);
};

const WorkflowTemplateFields: React.FC<WorkflowTemplateFieldsProps> = ({ templateDefinition, values, onChange, t }) => {
  return (
    <div className='flex flex-col gap-10px'>
      {templateDefinition.fields.map((field) => {
        if (field.type === 'number') {
          const value = values[field.key];
          return (
            <div key={field.key} className='flex flex-col gap-6px'>
              <Typography.Text>{t(field.labelKey)}</Typography.Text>
              <InputNumber
                value={typeof value === 'number' ? value : templateDefinition.defaults[field.key]}
                min={field.constraint.min}
                max={field.constraint.max}
                step={field.constraint.step}
                precision={field.key === 'scoreTarget' ? 1 : 0}
                className={GROUP_MODAL_FIELD_CLASS_NAME}
                onChange={(nextValue) => {
                  onChange(
                    field.key,
                    typeof nextValue === 'number' ? nextValue : templateDefinition.defaults[field.key]
                  );
                }}
              />
              <Typography.Text type='secondary'>{renderFieldHint(field, t)}</Typography.Text>
            </div>
          );
        }

        if (field.type === 'string') {
          return (
            <div key={field.key} className='flex flex-col gap-6px'>
              <Typography.Text>{t(field.labelKey)}</Typography.Text>
              <Input
                value={values[field.key]}
                onChange={(nextValue) => onChange(field.key, nextValue)}
                placeholder={field.placeholder || templateDefinition.defaults.artifactPath}
                className={GROUP_MODAL_FIELD_CLASS_NAME}
              />
              <Typography.Text type='secondary'>{renderFieldHint(field, t)}</Typography.Text>
            </div>
          );
        }

        return (
          <div key={field.key} className='flex flex-col gap-6px'>
            <Typography.Text>{t(field.labelKey)}</Typography.Text>
            <Select
              value={values.reviewMode}
              onChange={(nextValue) => onChange(field.key, nextValue as WorkflowGroupReviewMode)}
              className={`${GROUP_MODAL_SELECT_CLASS_NAME} ${GROUP_MODAL_FIELD_CLASS_NAME}`}
            >
              {field.options.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </Select.Option>
              ))}
            </Select>
            <Typography.Text type='secondary'>{renderFieldHint(field, t)}</Typography.Text>
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowTemplateFields;
