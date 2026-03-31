/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageTips } from '@/common/chat/chatLib';
import { ipcBridge } from '@/common';
import { Button, Message } from '@arco-design/web-react';
import { Attention, CheckOne } from '@icon-park/react';
import { theme } from '@office-ai/platform';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import MarkdownView from '@renderer/components/Markdown';
import CollapsibleContent from '@renderer/components/chat/CollapsibleContent';
import { useTranslation } from 'react-i18next';

const icon = {
  success: <CheckOne theme='filled' size='16' fill={theme.Color.FunctionalColor.success} className='m-t-2px' />,
  warning: (
    <Attention
      theme='filled'
      size='16'
      strokeLinejoin='bevel'
      className='m-t-2px'
      fill={theme.Color.FunctionalColor.warn}
    />
  ),
  error: (
    <Attention
      theme='filled'
      size='16'
      strokeLinejoin='bevel'
      className='m-t-2px'
      fill={theme.Color.FunctionalColor.error}
    />
  ),
};

const useFormatContent = (content: string) => {
  return useMemo(() => {
    try {
      const json = JSON.parse(content);
      return {
        json: true,
        data: json,
      };
    } catch {
      return { data: content };
    }
  }, [content]);
};

const MessageTips: React.FC<{ message: IMessageTips }> = ({ message }) => {
  const { t } = useTranslation();
  const { content, type, actions } = message.content;
  const { json, data } = useFormatContent(content);
  const tipActions = useMemo(
    () =>
      (actions || []).filter(
        (action) =>
          typeof action.label === 'string' &&
          action.label.trim() &&
          (action.action === 'open-file' || action.action === 'show-item-in-folder') &&
          typeof action.path === 'string' &&
          action.path.trim()
      ),
    [actions]
  );

  const displayContent = json ? '' : content;

  const handleTipAction = async (action: NonNullable<IMessageTips['content']['actions']>[number]): Promise<void> => {
    try {
      if (action.action === 'open-file') {
        await ipcBridge.shell.openFile.invoke(action.path);
        return;
      }

      await ipcBridge.shell.showItemInFolder.invoke(action.path);
    } catch (error) {
      console.error('[MessageTips] Failed to execute tip action:', action, error);
      Message.error(
        error instanceof Error
          ? error.message
          : t('agent.hooks.sidecarActionFailed', {
              defaultValue: 'Failed to open exported sidecar output.',
            })
      );
    }
  };

  const renderActions = () =>
    tipActions.length > 0 ? (
      <div className='mt-8px flex flex-wrap gap-8px'>
        {tipActions.map((action) => (
          <Button
            key={`${message.id}-${action.action}-${action.path}`}
            type='outline'
            size='mini'
            onClick={() => void handleTipAction(action)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    ) : null;

  if (json)
    return (
      <div className='w-full'>
        <div className={classNames('bg-message-tips rd-8px p-x-12px p-y-8px flex items-start gap-4px')}>
          {icon[type] || icon.warning}
          <div className='flex-1'>
            <MarkdownView>{`\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``}</MarkdownView>
            {renderActions()}
          </div>
        </div>
      </div>
    );
  return (
    <div className='w-full'>
      <div className={classNames('bg-message-tips rd-8px  p-x-12px p-y-8px flex items-start gap-4px')}>
        {icon[type] || icon.warning}
        <div className='flex-1'>
          <CollapsibleContent maxHeight={48} defaultCollapsed={true} className='flex-1' useMask={true}>
            <span
              className='whitespace-break-spaces text-t-primary [word-break:break-word]'
              dangerouslySetInnerHTML={{
                __html: displayContent,
              }}
            ></span>
          </CollapsibleContent>
          {renderActions()}
        </div>
      </div>
    </div>
  );
};

export default MessageTips;
