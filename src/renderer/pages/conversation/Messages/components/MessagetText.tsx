/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageText } from '@/common/chat/chatLib';
import { CONTEXTGO_FILES_MARKER } from '@/common/config/constants';
import { formatWorkflowRoleLabel, isBuiltInWorkflowRole } from '@/common/config/group';
import { ContextPreviewDrawer } from '@/renderer/components/chat/SendContextPreview';
import { iconColors } from '@/renderer/styles/colors';
import { Alert, Button, Message } from '@arco-design/web-react';
import { DeleteOne, FileText, PreviewOpen, Write } from '@icon-park/react';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { copyText } from '@/renderer/utils/ui/clipboard';
import CollapsibleContent from '@renderer/components/chat/CollapsibleContent';
import FilePreview from '@renderer/components/media/FilePreview';
import HorizontalFileList from '@renderer/components/media/HorizontalFileList';
import MarkdownView from '@renderer/components/Markdown';
import { stripThinkTags, hasThinkTags } from '@renderer/utils/chat/thinkTagFilter';
import MessageScheduleBadge from './MessageScheduleBadge';
import { CUSTOM_AVATAR_IMAGE_MAP } from '@/renderer/pages/guid/constants';

const resolveGroupParticipantRoleLabel = (
  role: string | undefined,
  t: TFunction<'translation', undefined>
): string | null => {
  if (!role) {
    return null;
  }

  return isBuiltInWorkflowRole(role) ? t(`conversation.group.role.${role}`) : formatWorkflowRoleLabel(role);
};

const parseFileMarker = (content: string) => {
  const markerIndex = content.indexOf(CONTEXTGO_FILES_MARKER);
  if (markerIndex === -1) {
    return { text: content, files: [] as string[] };
  }
  const text = content.slice(0, markerIndex).trimEnd();
  const afterMarker = content.slice(markerIndex + CONTEXTGO_FILES_MARKER.length).trim();
  const files = afterMarker
    ? afterMarker
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  return { text, files };
};

export type FileOperationKind = 'written' | 'read' | 'deleted' | 'operation';

export type ParsedFileOperationMessage = {
  kind: FileOperationKind;
  path: string;
  preview?: string;
  previewLanguage?: string;
  method?: string;
};

type JsonRecord = Record<string, unknown>;

type JsonDisplaySection = {
  summaryFields: Array<{ key: string; label: string; value: string }>;
  detailFields: Array<{ key: string; label: string; value: unknown; isProminent: boolean }>;
};

const JSON_SUMMARY_FIELD_KEYS = ['model', 'size'] as const;
const JSON_PROMINENT_FIELD_KEYS = new Set([
  'prompt',
  'negativePrompt',
  'negative_prompt',
  'instructions',
  'description',
]);

const isJsonRecord = (value: unknown): value is JsonRecord => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const formatJsonFieldKey = (key: string): string => {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const stringifyJsonFieldValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
};

const getJsonFieldLabel = (key: string, t: TFunction<'translation', undefined>): string => {
  switch (key) {
    case 'model':
      return t('messages.jsonCard.model');
    case 'prompt':
      return t('messages.jsonCard.prompt');
    case 'size':
      return t('messages.jsonCard.size');
    default:
      return formatJsonFieldKey(key);
  }
};

export const parseFileOperationMessage = (content: string): ParsedFileOperationMessage | null => {
  const trimmedContent = content.trim();
  const previewMatch = /\n\n```([\w#+-]+)?\n([\s\S]*?)\n```\s*$/.exec(trimmedContent);
  const previewLanguage = previewMatch?.[1]?.trim().toLowerCase();
  const preview = previewMatch?.[2];
  const headerText = previewMatch ? trimmedContent.slice(0, previewMatch.index).trimEnd() : trimmedContent;
  const headerMatch =
    /^(?:\S+\s+)?(?:\*\*)?File (written|read|deleted|operation):(?:\*\*)?\s*`([^`]+)`(?:\s*\(([^)]+)\))?\s*$/.exec(
      headerText
    );

  if (!headerMatch) {
    return null;
  }

  const [, kind, rawPath, method] = headerMatch;
  const path = rawPath?.trim();

  if (!path) {
    return null;
  }

  return {
    kind: kind as FileOperationKind,
    path,
    preview,
    previewLanguage,
    method: method?.trim(),
  };
};

export const getFileNameFromPath = (path: string): string => {
  return path.split(/[\\/]/).pop() || path;
};

const getFilePreviewLabel = (operation: ParsedFileOperationMessage): string => {
  if (operation.previewLanguage) {
    return operation.previewLanguage.toUpperCase();
  }

  const fileName = getFileNameFromPath(operation.path);
  const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
  return extension ? extension.toUpperCase() : 'TEXT';
};

const useFormatContent = (content: string) => {
  return useMemo(() => {
    try {
      const json = JSON.parse(content);
      const isJson = json !== null && typeof json === 'object';
      return {
        json: isJson,
        jsonObject: isJsonRecord(json),
        data: isJson ? json : content,
      };
    } catch {
      return { data: content, json: false, jsonObject: false };
    }
  }, [content]);
};

const MessageText: React.FC<{ message: IMessageText }> = ({ message }) => {
  // Filter think tags from content before rendering
  // 在渲染前过滤 think 标签
  const contentToRender = useMemo(() => {
    const rawContent = message.content.content;
    if (typeof rawContent === 'string' && hasThinkTags(rawContent)) {
      return stripThinkTags(rawContent);
    }
    return rawContent;
  }, [message.content.content]);

  const { text, files } = parseFileMarker(contentToRender);
  const { data, json, jsonObject } = useFormatContent(text);
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const [showCopyAlert, setShowCopyAlert] = useState(false);
  const [contextPreviewVisible, setContextPreviewVisible] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressReadyRef = useRef(false);
  const isUserMessage = message.position === 'right';
  const hasTextBody = json || Boolean(text.trim());
  const contextPreview = message.content.contextPreview;
  const fileOperation = useMemo(() => parseFileOperationMessage(text), [text]);
  const jsonObjectSections = useMemo<JsonDisplaySection | null>(() => {
    if (!jsonObject || !isJsonRecord(data)) {
      return null;
    }

    const entries = Object.entries(data);
    const summaryFields = JSON_SUMMARY_FIELD_KEYS.flatMap((key) => {
      const value = data[key];
      if (value === undefined || typeof value === 'object') {
        return [];
      }

      return [
        {
          key,
          label: getJsonFieldLabel(key, t),
          value: stringifyJsonFieldValue(value),
        },
      ];
    });

    const detailFields = entries
      .filter(([key]) => !summaryFields.some((field) => field.key === key))
      .map(([key, value]) => ({
        key,
        label: getJsonFieldLabel(key, t),
        value,
        isProminent: JSON_PROMINENT_FIELD_KEYS.has(key),
      }));

    return {
      summaryFields,
      detailFields,
    };
  }, [data, jsonObject, t]);
  const rawJsonText = useMemo(() => (json ? JSON.stringify(data, null, 2) : ''), [data, json]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        clearTimeout(longPressTimerRef.current);
      }
      longPressReadyRef.current = false;
    };
  }, []);

  // 过滤空内容，避免渲染空DOM
  if (!message.content.content || (typeof message.content.content === 'string' && !message.content.content.trim())) {
    return null;
  }

  const handleCopy = () => {
    const baseText = json ? JSON.stringify(data, null, 2) : text;
    const fileList = files.length ? `Files:\n${files.map((path) => `- ${path}`).join('\n')}\n\n` : '';
    const textToCopy = fileList + baseText;
    copyText(textToCopy)
      .then(() => {
        setShowCopyAlert(true);
        setTimeout(() => setShowCopyAlert(false), 2000);
      })
      .catch(() => {
        Message.error(t('common.copyFailed'));
      });
  };
  const clearLongPressCopy = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressReadyRef.current = false;
  };
  const canUseLongPressCopy = isMobile && hasTextBody;

  const handleLongPressStart = () => {
    if (!canUseLongPressCopy) {
      return;
    }

    clearLongPressCopy();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressReadyRef.current = true;
    }, 450);
  };
  const handleLongPressEnd = () => {
    if (!canUseLongPressCopy) {
      return;
    }

    const shouldCopy = longPressReadyRef.current;
    clearLongPressCopy();

    if (shouldCopy) {
      handleCopy();
    }
  };

  const scheduleMeta = message.content.scheduleMeta;
  const groupMeta = message.content.groupMeta;
  const isResultCardMessage = !isUserMessage && !scheduleMeta;
  const groupAvatarImage = groupMeta?.participantAvatar
    ? CUSTOM_AVATAR_IMAGE_MAP[groupMeta.participantAvatar]
    : undefined;
  const groupMetaLabels = groupMeta
    ? groupMeta.kind === 'workflow'
      ? [
          resolveGroupParticipantRoleLabel(groupMeta.participantRole, t),
          t(`conversation.group.workflow.stage.${groupMeta.stage}`),
          groupMeta.iteration > 0
            ? t('conversation.group.workflow.iterationLabel', { iteration: groupMeta.iteration })
            : null,
        ].filter(Boolean)
      : [
          resolveGroupParticipantRoleLabel(groupMeta.participantRole, t),
          groupMeta.round > 0 ? t('conversation.group.roundLabel', { round: groupMeta.round }) : null,
        ].filter(Boolean)
    : [];

  const fileOperationTone = useMemo(() => {
    if (!fileOperation) {
      return null;
    }

    switch (fileOperation.kind) {
      case 'written':
        return {
          title: t('messages.fileOperation.written'),
          icon: <Write theme='outline' size='16' fill='var(--color-success)' className='app-icon' />,
          accentColor: 'var(--color-success)',
          iconBg: 'var(--color-bg-2)',
        };
      case 'read':
        return {
          title: t('messages.fileOperation.read'),
          icon: <PreviewOpen theme='outline' size='16' fill='var(--color-primary)' className='app-icon' />,
          accentColor: 'var(--color-primary)',
          iconBg: 'var(--color-bg-2)',
        };
      case 'deleted':
        return {
          title: t('messages.fileOperation.deleted'),
          icon: <DeleteOne theme='outline' size='16' fill='var(--color-danger)' className='app-icon' />,
          accentColor: 'var(--color-danger)',
          iconBg: 'var(--color-bg-2)',
        };
      case 'operation':
      default:
        return {
          title: t('messages.fileOperation.operation'),
          icon: <FileText theme='outline' size='16' fill='var(--color-text-2)' className='app-icon' />,
          accentColor: 'var(--color-text-2)',
          iconBg: 'var(--color-bg-2)',
        };
    }
  }, [fileOperation, t]);

  const fileOperationFileName = fileOperation ? getFileNameFromPath(fileOperation.path) : '';
  const fileOperationPreviewLabel = fileOperation ? getFilePreviewLabel(fileOperation) : '';
  const fileOperationPreviewLines = useMemo(() => {
    if (!fileOperation?.preview) {
      return [] as string[];
    }

    return fileOperation.preview.split('\n');
  }, [fileOperation?.preview]);
  const bubbleClassName = classNames(
    'relative min-w-0 max-w-full [&>p:first-child]:mt-0px [&>p:last-child]:mb-0px md:max-w-780px',
    {
      'bg-aou-2 p-8px': isUserMessage || scheduleMeta,
      'w-full': !(isUserMessage || scheduleMeta),
    }
  );

  return (
    <>
      <div
        className={classNames(
          'min-w-0 max-w-full flex flex-col group',
          isMobile && 'overflow-x-hidden',
          isUserMessage ? 'items-end' : 'items-start'
        )}
      >
        {scheduleMeta && <MessageScheduleBadge meta={scheduleMeta} />}
        {groupMeta && !isUserMessage && (
          <div className='mb-6px inline-flex items-center gap-6px text-12px text-[var(--color-text-3)]'>
            {groupAvatarImage ? (
              <img
                src={groupAvatarImage}
                alt={groupMeta.participantName}
                className='w-18px h-18px rd-9px object-cover shrink-0'
              />
            ) : groupMeta.participantAvatar ? (
              <span className='text-14px leading-18px'>{groupMeta.participantAvatar}</span>
            ) : null}
            <span className='font-medium text-[var(--color-text-2)]'>{groupMeta.participantName}</span>
            {groupMetaLabels.map((label) => (
              <span key={String(label)}>{label}</span>
            ))}
          </div>
        )}
        {files.length > 0 && (
          <div className={classNames('mt-6px', { 'self-end': isUserMessage })}>
            {files.length === 1 ? (
              <div className='flex items-center'>
                <FilePreview path={files[0]} onRemove={() => undefined} readonly />
              </div>
            ) : (
              <HorizontalFileList>
                {files.map((path) => (
                  <FilePreview key={path} path={path} onRemove={() => undefined} readonly />
                ))}
              </HorizontalFileList>
            )}
          </div>
        )}
        {isUserMessage && contextPreview && (
          <div className='mb-6px flex max-w-full items-center gap-6px self-end'>
            <Button
              type='secondary'
              size='mini'
              shape='round'
              icon={<PreviewOpen theme='outline' size='14' className='app-icon' />}
              onClick={() => setContextPreviewVisible(true)}
            >
              {t('messages.contextPreview.pill', { count: contextPreview.sectionCount })}
            </Button>
            <div className='flex min-w-0 flex-wrap items-center gap-4px text-11px leading-16px text-t-secondary'>
              {contextPreview.memoryRefCount > 0 && (
                <span className='rounded-full bg-bg-2 px-7px py-2px'>
                  {t('messages.contextPreview.short.memoryRefs', { count: contextPreview.memoryRefCount })}
                </span>
              )}
              {contextPreview.sourceRefCount > 0 && (
                <span className='rounded-full bg-bg-2 px-7px py-2px'>
                  {t('messages.contextPreview.short.sourceRefs', { count: contextPreview.sourceRefCount })}
                </span>
              )}
              {contextPreview.profileRefCount > 0 && (
                <span className='rounded-full bg-bg-2 px-7px py-2px'>
                  {t('messages.contextPreview.short.profileRefs', { count: contextPreview.profileRefCount })}
                </span>
              )}
            </div>
          </div>
        )}
        {hasTextBody && (
          <div
            className={bubbleClassName}
            style={isUserMessage || scheduleMeta ? { borderRadius: '8px 0 8px 8px' } : undefined}
            onTouchStart={canUseLongPressCopy ? handleLongPressStart : undefined}
            onTouchEnd={canUseLongPressCopy ? handleLongPressEnd : undefined}
            onTouchCancel={canUseLongPressCopy ? clearLongPressCopy : undefined}
            onTouchMove={canUseLongPressCopy ? clearLongPressCopy : undefined}
            onContextMenu={canUseLongPressCopy ? (event) => event.preventDefault() : undefined}
          >
            {fileOperation && fileOperationTone ? (
              <div
                className='min-w-0 rounded-16px border border-solid bg-bg-1 p-14px'
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-border-2) 82%, transparent)',
                  boxShadow: '0 8px 24px color-mix(in srgb, var(--color-text-1) 5%, transparent)',
                }}
              >
                <div className='flex min-w-0 items-start gap-10px'>
                  <div
                    className='flex h-30px w-30px shrink-0 items-center justify-center rounded-full'
                    style={{ backgroundColor: fileOperationTone.iconBg }}
                  >
                    {fileOperationTone.icon}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='flex min-w-0 flex-wrap items-center gap-8px'>
                      <span
                        className='text-13px font-600 leading-18px'
                        style={{ color: fileOperationTone.accentColor }}
                      >
                        {fileOperationTone.title}
                      </span>
                      {fileOperation.method && (
                        <span className='rounded-full bg-bg-2 px-8px py-2px font-mono text-11px leading-16px text-t-secondary'>
                          {fileOperation.method}
                        </span>
                      )}
                    </div>
                    <div className='mt-6px flex min-w-0 items-center gap-8px'>
                      <FileText theme='outline' size='14' fill={iconColors.secondary} className='app-icon shrink-0' />
                      <span className='min-w-0 break-all text-14px font-600 leading-20px text-t-primary'>
                        {fileOperationFileName}
                      </span>
                    </div>
                    <div className='mt-4px font-mono text-12px leading-18px text-t-secondary break-all'>
                      {fileOperation.path}
                    </div>
                  </div>
                </div>

                {fileOperation.preview &&
                  (fileOperation.kind === 'written' ? (
                    <div className='mt-12px'>
                      <CollapsibleContent maxHeight={280} defaultCollapsed={true}>
                        <div
                          className='overflow-hidden rounded-12px border'
                          style={{
                            borderColor: 'color-mix(in srgb, var(--color-border-2) 90%, rgb(var(--success-6)) 10%)',
                            boxShadow: '0 10px 24px color-mix(in srgb, var(--color-text-1) 4%, transparent)',
                          }}
                        >
                          <div
                            className='flex items-end gap-8px border-b px-10px pt-8px'
                            style={{
                              borderColor: 'color-mix(in srgb, var(--color-border-2) 92%, rgb(var(--success-6)) 8%)',
                              background:
                                'linear-gradient(180deg, color-mix(in srgb, var(--color-bg-2) 97%, white 3%) 0%, color-mix(in srgb, var(--color-fill-1) 95%, var(--color-bg-1) 5%) 100%)',
                            }}
                          >
                            <div className='flex shrink-0 items-center gap-4px pb-8px opacity-80'>
                              <span className='h-5px w-5px rounded-full bg-fill-4' />
                              <span className='h-5px w-5px rounded-full bg-fill-4' />
                              <span className='h-5px w-5px rounded-full bg-[color:color-mix(in_srgb,rgb(var(--success-6))_30%,var(--color-fill-4)_70%)]' />
                            </div>
                            <div className='min-w-0 flex flex-1 items-end gap-6px overflow-hidden'>
                              <div
                                className='inline-flex min-w-0 items-center gap-6px rounded-t-9px border border-b-0 px-10px py-6px'
                                style={{
                                  borderColor:
                                    'color-mix(in srgb, var(--color-border-2) 86%, rgb(var(--success-6)) 14%)',
                                  background:
                                    'linear-gradient(180deg, color-mix(in srgb, var(--color-bg-1) 96%, white 4%) 0%, color-mix(in srgb, var(--color-fill-1) 90%, var(--color-bg-1) 10%) 100%)',
                                  boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 42%, transparent)',
                                }}
                              >
                                <Write
                                  theme='outline'
                                  size='13'
                                  fill='rgb(var(--success-6))'
                                  className='app-icon shrink-0'
                                />
                                <span className='min-w-0 truncate font-mono text-11px font-600 leading-16px text-t-primary'>
                                  {fileOperationFileName}
                                </span>
                              </div>
                              <span className='mb-7px shrink-0 rounded-7px border border-[color:var(--color-border-2)] bg-[color:color-mix(in_srgb,var(--color-bg-1)_94%,transparent)] px-6px py-2px font-mono text-10px leading-14px text-t-tertiary'>
                                {fileOperationPreviewLabel}
                              </span>
                            </div>
                          </div>

                          <div className='max-h-320px overflow-auto bg-[color:var(--color-bg-1)]'>
                            <div className='min-w-max'>
                              {fileOperationPreviewLines.map((line, index) => (
                                <div
                                  key={`line-row-${index + 1}`}
                                  className='grid grid-cols-[42px,16px,1fr]'
                                  style={{
                                    background:
                                      index % 2 === 0
                                        ? 'color-mix(in srgb, var(--color-bg-1) 97%, transparent)'
                                        : 'color-mix(in srgb, var(--color-fill-1) 36%, var(--color-bg-1) 64%)',
                                  }}
                                >
                                  <div
                                    className='select-none border-r px-8px py-1px text-right font-mono text-11px leading-20px text-t-tertiary'
                                    style={{
                                      borderColor:
                                        'color-mix(in srgb, var(--color-border-2) 92%, rgb(var(--success-6)) 8%)',
                                      background: 'color-mix(in srgb, var(--color-fill-1) 86%, var(--color-bg-1) 14%)',
                                    }}
                                  >
                                    {index + 1}
                                  </div>
                                  <div
                                    className='select-none border-r py-1px text-center font-mono text-10px leading-20px text-[rgb(var(--success-6))]'
                                    style={{
                                      borderColor:
                                        'color-mix(in srgb, var(--color-border-2) 92%, rgb(var(--success-6)) 8%)',
                                      background: 'color-mix(in srgb, rgb(var(--success-6)) 6%, var(--color-bg-1) 94%)',
                                    }}
                                  >
                                    +
                                  </div>
                                  <div
                                    className='min-w-0 px-12px py-1px font-mono text-12px leading-20px text-t-primary whitespace-pre'
                                    style={{
                                      background:
                                        'color-mix(in srgb, rgb(var(--success-6)) 13%, var(--color-bg-1) 87%)',
                                    }}
                                  >
                                    {line || ' '}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  ) : (
                    <div className='mt-12px'>
                      <CollapsibleContent maxHeight={240} defaultCollapsed={true}>
                        <pre className='m-0 overflow-auto rounded-12px bg-bg-2 px-12px py-12px font-mono text-12px leading-18px text-t-primary whitespace-pre-wrap break-words'>
                          {fileOperation.preview}
                        </pre>
                      </CollapsibleContent>
                    </div>
                  ))}
              </div>
            ) : jsonObject && jsonObjectSections && isResultCardMessage ? (
              <div
                className='min-w-0 rounded-16px border border-solid bg-bg-1 p-14px'
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-border-2) 82%, transparent)',
                  boxShadow: '0 8px 24px color-mix(in srgb, var(--color-text-1) 5%, transparent)',
                }}
              >
                <div className='flex min-w-0 items-center justify-between gap-12px'>
                  <div className='flex min-w-0 items-center gap-8px'>
                    <span className='inline-flex h-22px items-center rounded-full bg-primary-light-1 px-8px text-11px font-600 uppercase text-primary'>
                      JSON
                    </span>
                    <span className='truncate text-13px font-600 leading-18px text-t-primary'>
                      {t('messages.jsonCard.parameters')}
                    </span>
                  </div>
                  <span className='shrink-0 rounded-full bg-bg-2 px-8px py-2px font-mono text-11px leading-16px text-t-secondary'>
                    {Object.keys(data).length}
                  </span>
                </div>

                {jsonObjectSections.summaryFields.length > 0 && (
                  <div className='mt-12px grid gap-8px md:grid-cols-2'>
                    {jsonObjectSections.summaryFields.map((field) => (
                      <div
                        key={field.key}
                        className='rounded-12px border border-solid px-12px py-10px'
                        style={{
                          borderColor: 'color-mix(in srgb, var(--color-border-2) 86%, transparent)',
                          background:
                            'linear-gradient(180deg, color-mix(in srgb, var(--color-bg-1) 97%, white 3%) 0%, color-mix(in srgb, var(--color-fill-1) 92%, var(--color-bg-1) 8%) 100%)',
                        }}
                      >
                        <div className='text-11px font-600 leading-16px text-t-secondary uppercase'>{field.label}</div>
                        <div className='mt-4px break-all text-14px font-600 leading-20px text-t-primary'>
                          {field.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {jsonObjectSections.detailFields.length > 0 && (
                  <div className='mt-12px flex flex-col gap-10px'>
                    {jsonObjectSections.detailFields.map((field) => (
                      <div
                        key={field.key}
                        className='rounded-12px border border-solid px-12px py-12px'
                        style={{
                          borderColor: 'color-mix(in srgb, var(--color-border-2) 88%, transparent)',
                          background: 'color-mix(in srgb, var(--color-fill-1) 62%, var(--color-bg-1) 38%)',
                        }}
                      >
                        <div className='flex min-w-0 items-center justify-between gap-8px'>
                          <span className='min-w-0 truncate text-12px font-600 leading-18px text-t-primary'>
                            {field.label}
                          </span>
                          <span className='shrink-0 rounded-full bg-bg-1 px-8px py-2px font-mono text-10px leading-14px text-t-tertiary'>
                            {field.key}
                          </span>
                        </div>
                        <div
                          className={classNames('mt-8px text-13px leading-20px text-t-primary break-words', {
                            'rounded-10px bg-bg-1 px-10px py-10px whitespace-pre-wrap': field.isProminent,
                            'font-mono text-12px whitespace-pre-wrap rounded-10px bg-bg-1 px-10px py-10px':
                              typeof field.value !== 'string',
                          })}
                        >
                          {typeof field.value === 'string' ? field.value : stringifyJsonFieldValue(field.value)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  className='mt-14px border-t border-solid pt-12px'
                  style={{ borderColor: 'color-mix(in srgb, var(--color-border-2) 90%, transparent)' }}
                >
                  <div className='mb-8px text-12px font-600 leading-18px text-t-secondary'>
                    {t('messages.jsonCard.rawJson')}
                  </div>
                  <CollapsibleContent maxHeight={220} defaultCollapsed={true}>
                    <pre className='m-0 overflow-auto rounded-12px bg-bg-2 px-12px py-12px font-mono text-12px leading-18px text-t-primary whitespace-pre-wrap break-words'>
                      {rawJsonText}
                    </pre>
                  </CollapsibleContent>
                </div>
              </div>
            ) : json ? (
              /* JSON 内容使用折叠组件 Use CollapsibleContent for JSON content */
              <CollapsibleContent maxHeight={200} defaultCollapsed={true}>
                <MarkdownView
                  codeStyle={{ marginTop: 4, marginBlock: 4 }}
                  codeVariant={isResultCardMessage ? 'result-card' : undefined}
                >{`\`\`\`json\n${rawJsonText}\n\`\`\``}</MarkdownView>
              </CollapsibleContent>
            ) : (
              <MarkdownView
                codeStyle={{ marginTop: 4, marginBlock: 4 }}
                codeVariant={isResultCardMessage ? 'result-card' : undefined}
              >
                {data}
              </MarkdownView>
            )}
          </div>
        )}
      </div>
      <ContextPreviewDrawer
        preview={contextPreview}
        visible={contextPreviewVisible}
        onClose={() => setContextPreviewVisible(false)}
      />
      {showCopyAlert && (
        <Alert
          type='success'
          content={t('messages.copySuccess')}
          showIcon
          className='fixed top-20px left-50% transform -translate-x-50% z-9999 w-max max-w-[80%]'
          style={{ boxShadow: '0px 2px 12px rgba(0,0,0,0.12)' }}
          closable={false}
        />
      )}
    </>
  );
};

export default MessageText;
