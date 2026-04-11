/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tooltip } from '@arco-design/web-react';
import { DeleteOne, Down, FileText, PreviewOpen, Right, Write } from '@icon-park/react';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { iconColors } from '@/renderer/styles/colors';
import {
  getFileNameFromPath,
  type FileOperationKind,
  type ParsedFileOperationMessage,
} from './MessagetText';

type MessageFileOperationSummaryProps = {
  operations: ParsedFileOperationMessage[];
};

type GroupedFileOperation = {
  kind: FileOperationKind;
  operations: ParsedFileOperationMessage[];
};

const FILE_OPERATION_ORDER: FileOperationKind[] = ['read', 'written', 'deleted', 'operation'];

const MessageFileOperationSummary: React.FC<MessageFileOperationSummaryProps> = ({ operations }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const groupedOperations = useMemo(() => {
    const groups = new Map<FileOperationKind, ParsedFileOperationMessage[]>();

    operations.forEach((operation) => {
      const existing = groups.get(operation.kind);
      if (existing) {
        existing.push(operation);
        return;
      }
      groups.set(operation.kind, [operation]);
    });

    return FILE_OPERATION_ORDER.filter((kind) => groups.has(kind)).map((kind) => ({
      kind,
      operations: groups.get(kind) || [],
    }));
  }, [operations]);

  const getGroupMeta = (group: GroupedFileOperation) => {
    const count = group.operations.length;

    switch (group.kind) {
      case 'read':
        return {
          label: t('messages.fileOperation.summary.read', { count }),
          icon: <PreviewOpen theme='outline' size='14' fill='var(--color-primary)' className='app-icon' />,
          chipClassName: 'text-primary bg-primary-light-1',
        };
      case 'written':
        return {
          label: t('messages.fileOperation.summary.written', { count }),
          icon: <Write theme='outline' size='14' fill='var(--color-success)' className='app-icon' />,
          chipClassName: 'text-success bg-success-light-1',
        };
      case 'deleted':
        return {
          label: t('messages.fileOperation.summary.deleted', { count }),
          icon: <DeleteOne theme='outline' size='14' fill='var(--color-danger)' className='app-icon' />,
          chipClassName: 'text-danger bg-danger-light-1',
        };
      case 'operation':
      default:
        return {
          label: t('messages.fileOperation.summary.operation', { count }),
          icon: <FileText theme='outline' size='14' fill={iconColors.secondary} className='app-icon' />,
          chipClassName: 'text-t-secondary bg-bg-2',
        };
    }
  };

  if (!groupedOperations.length) {
    return null;
  }

  return (
    <div
      className='w-full min-w-0 rounded-12px border border-solid bg-bg-1 px-12px py-10px'
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className='flex min-w-0 cursor-pointer items-center gap-8px' onClick={() => setExpanded((value) => !value)}>
        <span className='shrink-0 text-12px font-600 leading-18px text-t-secondary'>
          {t('messages.stepSummary.viewSteps')}
        </span>
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-6px'>
          {groupedOperations.map((group) => {
            const meta = getGroupMeta(group);
            return (
              <span
                key={group.kind}
                className={classNames(
                  'inline-flex items-center gap-6px rounded-full px-10px py-4px text-12px font-500 leading-16px',
                  meta.chipClassName
                )}
              >
                {meta.icon}
                <span>{meta.label}</span>
              </span>
            );
          })}
        </div>
        <span className='shrink-0'>
          {expanded ? (
            <Down theme='outline' size='14' fill={iconColors.secondary} className='app-icon' />
          ) : (
            <Right theme='outline' size='14' fill={iconColors.secondary} className='app-icon' />
          )}
        </span>
      </div>

      {expanded && (
        <div
          className='mt-10px flex flex-col gap-10px border-t border-solid pt-10px'
          style={{ borderColor: 'var(--color-border)' }}
        >
          {groupedOperations.map((group) => {
            const meta = getGroupMeta(group);

            return (
              <div key={group.kind} className='min-w-0'>
                <div className='mb-6px flex min-w-0 items-center gap-8px text-12px font-600 leading-18px text-t-primary'>
                  {meta.icon}
                  <span>{meta.label}</span>
                </div>
                <div className='flex flex-col gap-4px'>
                  {group.operations.map((operation, index) => (
                    <Tooltip key={`${operation.kind}-${operation.path}-${index}`} content={operation.path}>
                      <div className='flex min-w-0 items-center gap-8px rounded-8px bg-bg-2 px-10px py-8px'>
                        <FileText theme='outline' size='14' fill={iconColors.secondary} className='app-icon shrink-0' />
                        <span className='min-w-0 flex-1 truncate text-13px leading-18px text-t-primary'>
                          {getFileNameFromPath(operation.path)}
                        </span>
                        {operation.method && (
                          <span className='shrink-0 rounded-full bg-bg-3 px-8px py-2px font-mono text-11px leading-16px text-t-secondary'>
                            {operation.method}
                          </span>
                        )}
                      </div>
                    </Tooltip>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageFileOperationSummary);
