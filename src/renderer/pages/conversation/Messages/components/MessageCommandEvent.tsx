/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageCommandEvent } from '@/common/chat/chatLib';
import type { CommandEventScope } from '@/common/chat/command/events';
import { Tag } from '@arco-design/web-react';
import { Command } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type MessageCommandEventProps = {
  message: IMessageCommandEvent;
};

const resolveScopeLabel = (scope: CommandEventScope | undefined, t: ReturnType<typeof useTranslation>['t']): string => {
  if (scope === 'space') {
    return t('conversation.workspace.automation.commandEvent.scope.space');
  }

  return t('conversation.workspace.automation.commandEvent.scope.project');
};

const resolveHeader = (
  message: IMessageCommandEvent,
  t: ReturnType<typeof useTranslation>['t']
): { title: string; description: string } => {
  switch (message.content.action) {
    case 'create':
      return {
        title: t('conversation.workspace.automation.commandEvent.createTitle'),
        description: t('conversation.workspace.automation.commandEvent.createDescription'),
      };
    case 'update':
      return {
        title: t('conversation.workspace.automation.commandEvent.updateTitle'),
        description: t('conversation.workspace.automation.commandEvent.updateDescription'),
      };
    case 'delete':
      return {
        title: t('conversation.workspace.automation.commandEvent.deleteTitle'),
        description: t('conversation.workspace.automation.commandEvent.deleteDescription'),
      };
    case 'list':
      return {
        title: t('conversation.workspace.automation.commandEvent.listTitle'),
        description: t('conversation.workspace.automation.commandEvent.listDescription', {
          count: message.content.commands?.length ?? 0,
          scope: message.content.scope ?? 'project',
        }),
      };
    case 'error':
    default:
      return {
        title: t('conversation.workspace.automation.commandEvent.errorTitle'),
        description: t('conversation.workspace.automation.commandEvent.errorDescription'),
      };
  }
};

const CommandField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className='min-w-0 rounded-10px bg-[var(--color-fill-2)] px-10px py-8px'>
    <div className='text-11px font-medium uppercase tracking-[0.04em] text-t-tertiary'>{label}</div>
    <div className='mt-4px break-words text-13px leading-6 text-t-primary'>{value}</div>
  </div>
);

const CommandSummaryCard: React.FC<{
  name: string;
  description?: string;
  template?: string;
  enabled?: boolean;
  scope?: CommandEventScope;
}> = ({ name, description, template, enabled, scope }) => {
  const { t } = useTranslation();

  return (
    <div className='rounded-14px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] px-12px py-12px'>
      <div className='flex flex-wrap items-center justify-between gap-8px'>
        <div className='min-w-0 flex-1'>
          <div className='truncate text-14px font-semibold text-t-primary'>{`/${name}`}</div>
          {description ? <div className='mt-2px text-12px text-t-secondary'>{description}</div> : null}
        </div>
        <div className='flex items-center gap-8px'>
          <Tag color='arcoblue'>{resolveScopeLabel(scope, t)}</Tag>
          {typeof enabled === 'boolean' ? (
            <Tag color={enabled ? 'green' : 'orange'}>
              {enabled
                ? t('conversation.workspace.automation.commandEvent.enabled')
                : t('conversation.workspace.automation.commandEvent.disabled')}
            </Tag>
          ) : null}
        </div>
      </div>

      {template ? (
        <div className='mt-10px grid gap-8px'>
          <CommandField label={t('conversation.workspace.automation.commandEvent.templateLabel')} value={template} />
        </div>
      ) : null}
    </div>
  );
};

const MessageCommandEvent: React.FC<MessageCommandEventProps> = ({ message }) => {
  const { t } = useTranslation();
  const header = resolveHeader(message, t);
  const commands = message.content.commands ?? (message.content.command ? [message.content.command] : []);

  return (
    <div className='w-full min-w-0'>
      <div className='w-full max-w-720px rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] px-14px py-12px shadow-[0_8px_24px_rgba(15,23,42,0.04)]'>
        <div className='flex items-start justify-between gap-12px'>
          <div className='min-w-0 flex items-start gap-10px'>
            <div className='mt-1px inline-flex h-30px w-30px shrink-0 items-center justify-center rounded-full bg-[var(--color-fill-2)] text-[var(--color-text-2)]'>
              <Command theme='outline' size={16} />
            </div>
            <div className='min-w-0'>
              <div className='text-14px font-semibold text-t-primary'>{header.title}</div>
              <div className='mt-2px text-12px leading-5 text-t-secondary'>{header.description}</div>
            </div>
          </div>
        </div>

        {message.content.action === 'delete' && message.content.commandName ? (
          <div className='mt-12px rounded-12px bg-[var(--color-fill-2)] px-12px py-10px text-13px text-t-primary'>
            <span className='font-mono'>{`/${message.content.commandName}`}</span>
            <span className='ml-8px text-t-secondary'>{resolveScopeLabel(message.content.scope, t)}</span>
          </div>
        ) : null}

        {message.content.action === 'error' ? (
          <div className='mt-12px rounded-12px border border-solid border-[var(--color-danger-light)] bg-[var(--color-danger-light)]/30 px-12px py-10px text-13px text-[var(--color-danger)]'>
            {message.content.error || t('common.unknownError')}
          </div>
        ) : null}

        {message.content.action === 'list' && commands.length === 0 ? (
          <div className='mt-12px rounded-12px bg-[var(--color-fill-2)] px-12px py-10px text-13px text-t-secondary'>
            {t('conversation.workspace.automation.commandEvent.empty')}
          </div>
        ) : null}

        {commands.length > 0 ? (
          <div className='mt-12px flex flex-col gap-10px'>
            {commands.map((command) => (
              <CommandSummaryCard
                key={command.id}
                name={command.name}
                description={command.description}
                template={command.template}
                enabled={command.enabled}
                scope={message.content.scope}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MessageCommandEvent;
