/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConversationContextPreview } from '@/common/chat/chatLib';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { Button, Drawer, Tag, Tooltip } from '@arco-design/web-react';
import { FileText } from '@icon-park/react';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';

type ContextMetricItem = {
  key: string;
  label: string;
  value: string | number;
};

type SendContextPreviewProps = {
  preview?: ConversationContextPreview;
  active?: boolean;
};

type ContextPreviewDrawerProps = {
  preview?: ConversationContextPreview;
  visible: boolean;
  onClose: () => void;
};

const getContextPreviewSectionKindLabel = (
  kind: ConversationContextPreview['sections'][number]['kind'],
  t: TFunction<'translation', undefined>
): string => {
  switch (kind) {
    case 'thread-state':
      return t('messages.contextPreview.sectionKind.threadState');
    case 'source':
      return t('messages.contextPreview.sectionKind.source');
    case 'artifact':
      return t('messages.contextPreview.sectionKind.artifact');
    case 'memory':
      return t('messages.contextPreview.sectionKind.memory');
    case 'profile':
      return t('messages.contextPreview.sectionKind.profile');
    case 'instruction':
      return t('messages.contextPreview.sectionKind.instruction');
    case 'compaction':
    default:
      return t('messages.contextPreview.sectionKind.compaction');
  }
};

const getContextPreviewSourceLabel = (
  source: ConversationContextPreview['sections'][number]['source'],
  t: TFunction<'translation', undefined>
): string => {
  switch (source) {
    case 'mounted':
      return t('messages.contextPreview.sectionSource.mounted');
    case 'instruction':
      return t('messages.contextPreview.sectionSource.instruction');
    case 'retrieved':
    default:
      return t('messages.contextPreview.sectionSource.retrieved');
  }
};

const getContextPreviewSearchModeLabel = (
  mode: ConversationContextPreview['searchMode'],
  t: TFunction<'translation', undefined>
): string => {
  switch (mode) {
    case 'lexical':
      return t('messages.contextPreview.searchMode.lexical');
    case 'vector':
      return t('messages.contextPreview.searchMode.vector');
    case 'hybrid':
    default:
      return t('messages.contextPreview.searchMode.hybrid');
  }
};

export const ContextPreviewDrawer: React.FC<ContextPreviewDrawerProps> = ({ preview, visible, onClose }) => {
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;

  const contextMetrics = React.useMemo<ContextMetricItem[]>(() => {
    if (!preview) {
      return [];
    }

    return [
      {
        key: 'sections',
        label: t('messages.contextPreview.metrics.sections'),
        value: preview.sectionCount,
      },
      {
        key: 'memoryRefs',
        label: t('messages.contextPreview.metrics.memoryRefs'),
        value: preview.memoryRefCount,
      },
      {
        key: 'sourceRefs',
        label: t('messages.contextPreview.metrics.sourceRefs'),
        value: preview.sourceRefCount,
      },
      {
        key: 'profileRefs',
        label: t('messages.contextPreview.metrics.profileRefs'),
        value: preview.profileRefCount,
      },
      {
        key: 'omitted',
        label: t('messages.contextPreview.metrics.omitted'),
        value: preview.omittedCount,
      },
      {
        key: 'tokens',
        label: t('messages.contextPreview.metrics.tokenBudget'),
        value: `${preview.spentTokens} / ${preview.budgetTokens}`,
      },
    ];
  }, [preview, t]);

  const contextMountedMetrics = React.useMemo<ContextMetricItem[]>(() => {
    if (!preview) {
      return [];
    }

    return [
      {
        key: 'threadSummary',
        label: t('messages.contextPreview.metrics.threadSummary'),
        value: preview.threadSummaryIncluded
          ? t('messages.contextPreview.boolean.yes')
          : t('messages.contextPreview.boolean.no'),
      },
      {
        key: 'mountedSections',
        label: t('messages.contextPreview.metrics.mountedSections'),
        value: preview.mountedSectionCount,
      },
      {
        key: 'mountedProfiles',
        label: t('messages.contextPreview.metrics.mountedProfiles'),
        value: preview.mountedProfileCount,
      },
      {
        key: 'pinnedInstructions',
        label: t('messages.contextPreview.metrics.pinnedInstructions'),
        value: preview.pinnedInstructionCount,
      },
    ];
  }, [preview, t]);

  const contextReferenceChips = React.useMemo(() => {
    if (!preview) {
      return [] as Array<{ key: string; label: string }>;
    }

    return [
      preview.memoryRefCount > 0
        ? {
            key: 'memory',
            label: t('messages.contextPreview.short.memoryRefs', { count: preview.memoryRefCount }),
          }
        : null,
      preview.sourceRefCount > 0
        ? {
            key: 'source',
            label: t('messages.contextPreview.short.sourceRefs', { count: preview.sourceRefCount }),
          }
        : null,
      preview.profileRefCount > 0
        ? {
            key: 'profile',
            label: t('messages.contextPreview.short.profileRefs', { count: preview.profileRefCount }),
          }
        : null,
      preview.omittedCount > 0
        ? {
            key: 'omitted',
            label: `${t('messages.contextPreview.metrics.omitted')}: ${preview.omittedCount}`,
          }
        : null,
    ].filter((item): item is { key: string; label: string } => item !== null);
  }, [preview, t]);

  if (!preview) {
    return null;
  }

  const contextMetricGridClassName = isMobile ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <Drawer
      placement={isMobile ? 'bottom' : 'right'}
      width={isMobile ? 'calc(100vw - 12px)' : 420}
      height={isMobile ? 'min(84vh, 760px)' : undefined}
      visible={visible}
      onCancel={onClose}
      title={t('messages.contextPreview.title')}
      bodyStyle={{
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: isMobile ? '14px 14px 18px' : undefined,
      }}
      footer={null}
    >
      <div className='flex flex-col gap-12px'>
        <div
          className='rounded-20px border border-solid px-16px py-16px'
          style={{
            borderColor: 'color-mix(in srgb, rgb(var(--primary-6)) 12%, var(--color-border-2) 88%)',
            background:
              'linear-gradient(180deg, color-mix(in srgb, rgb(var(--primary-6)) 5%, var(--color-bg-1) 95%) 0%, color-mix(in srgb, var(--color-fill-1) 72%, var(--color-bg-1) 28%) 100%)',
            boxShadow: '0 12px 30px color-mix(in srgb, rgb(var(--primary-6)) 8%, transparent)',
          }}
        >
          <div className='flex flex-wrap items-start justify-between gap-10px'>
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-center gap-6px'>
                <Tag color='arcoblue'>{t('messages.contextPreview.pill', { count: preview.sectionCount })}</Tag>
                <Tag color='gray'>{getContextPreviewSearchModeLabel(preview.searchMode, t)}</Tag>
              </div>
              <div className='mt-8px text-13px leading-20px text-t-secondary'>
                {t('messages.contextPreview.subtitle')}
              </div>
            </div>
            <div className='rounded-14px bg-[var(--color-bg-1)] px-12px py-10px shadow-sm'>
              <div className='text-11px font-600 leading-16px text-t-secondary'>
                {t('messages.contextPreview.metrics.tokenBudget')}
              </div>
              <div className='mt-4px text-15px font-600 leading-20px text-t-primary'>
                {preview.spentTokens} / {preview.budgetTokens}
              </div>
            </div>
          </div>
          {contextReferenceChips.length > 0 && (
            <div className='mt-12px flex flex-wrap gap-8px'>
              {contextReferenceChips.map((chip) => (
                <span
                  key={chip.key}
                  className='inline-flex max-w-full items-center rounded-full bg-[var(--color-bg-1)] px-9px py-4px text-11px leading-16px text-t-secondary'
                >
                  {chip.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className='rounded-18px border border-solid bg-bg-2 px-14px py-14px shadow-sm border-[color:var(--color-border-2)]'>
          <div className='text-13px font-600 leading-18px text-t-primary'>{t('messages.contextPreview.title')}</div>
          <div className={classNames('mt-10px grid gap-8px', contextMetricGridClassName)}>
            {contextMetrics.map((metric) => (
              <div
                key={metric.key}
                className='rounded-14px border border-solid bg-[var(--color-bg-1)] px-12px py-10px'
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-border-2) 88%, transparent)',
                }}
              >
                <div className='text-11px font-600 leading-16px text-t-secondary'>{metric.label}</div>
                <div className='mt-4px text-15px font-600 leading-20px text-t-primary'>{metric.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className='rounded-18px border border-solid bg-bg-2 px-14px py-14px shadow-sm border-[color:var(--color-border-2)]'>
          <div className='text-13px font-600 leading-18px text-t-primary'>
            {t('messages.contextPreview.mountedTitle')}
          </div>
          <div className={classNames('mt-10px grid gap-8px', contextMetricGridClassName)}>
            {contextMountedMetrics.map((metric) => (
              <div
                key={metric.key}
                className='rounded-14px border border-solid bg-[var(--color-bg-1)] px-12px py-10px'
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-border-2) 88%, transparent)',
                }}
              >
                <div className='text-11px font-600 leading-16px text-t-secondary'>{metric.label}</div>
                <div className='mt-4px text-15px font-600 leading-20px text-t-primary'>{metric.value}</div>
              </div>
            ))}
          </div>
        </div>

        {preview.queryTerms.length > 0 && (
          <div className='rounded-18px border border-solid bg-bg-2 px-14px py-14px shadow-sm border-[color:var(--color-border-2)]'>
            <div className='text-13px font-600 leading-18px text-t-primary'>
              {t('messages.contextPreview.queryTermsTitle')}
            </div>
            <div className='mt-10px flex flex-wrap gap-8px'>
              {preview.queryTerms.map((term) => (
                <span
                  key={term}
                  className='inline-flex max-w-full items-center rounded-full border border-solid bg-[var(--color-bg-1)] px-10px py-4px text-12px leading-18px text-t-primary'
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-border-2) 88%, transparent)',
                  }}
                >
                  {term}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className='rounded-18px border border-solid bg-bg-2 px-14px py-14px shadow-sm border-[color:var(--color-border-2)]'>
          <div className='flex items-center justify-between gap-8px'>
            <div className='text-13px font-600 leading-18px text-t-primary'>
              {t('messages.contextPreview.sectionsTitle')}
            </div>
            <span className='rounded-full bg-[var(--color-bg-1)] px-8px py-3px text-11px font-600 leading-16px text-t-secondary'>
              {preview.sectionCount}
            </span>
          </div>
          <div className='mt-10px flex flex-col gap-10px'>
            {preview.sections.map((section) => (
              <div
                key={section.id}
                className='rounded-14px border border-solid bg-[var(--color-bg-1)] px-12px py-12px'
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-border-2) 88%, transparent)',
                }}
              >
                <div className='flex flex-wrap items-start justify-between gap-8px'>
                  <div className='flex min-w-0 flex-wrap items-center gap-6px'>
                    <Tag color='blue'>{getContextPreviewSectionKindLabel(section.kind, t)}</Tag>
                    <Tag color='gray'>{getContextPreviewSourceLabel(section.source, t)}</Tag>
                  </div>
                  <span className='shrink-0 rounded-full bg-bg-2 px-8px py-3px font-mono text-10px leading-14px text-t-tertiary'>
                    {t('messages.contextPreview.sectionTokens', { count: section.tokenCount })}
                  </span>
                </div>
                <div className='mt-10px rounded-12px bg-bg-2 px-12px py-10px whitespace-pre-wrap break-words text-13px leading-20px text-t-primary'>
                  {section.summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
};

const SendContextPreview: React.FC<SendContextPreviewProps> = ({ preview, active = false }) => {
  const { t } = useTranslation();
  const [contextPreviewVisible, setContextPreviewVisible] = React.useState(false);

  if (!preview || !active) {
    return null;
  }

  const buttonLabel = t('messages.contextPreview.composerTag');

  return (
    <>
      <Tooltip content={buttonLabel} position='top'>
        <Button
          size='mini'
          type='text'
          className='sendbox-context-preview-button'
          aria-label={buttonLabel}
          icon={<FileText theme='outline' size='14' />}
          onClick={() => setContextPreviewVisible(true)}
        >
          <span className='sendbox-context-preview-button__count'>{preview.sectionCount}</span>
        </Button>
      </Tooltip>
      <ContextPreviewDrawer
        preview={preview}
        visible={contextPreviewVisible}
        onClose={() => setContextPreviewVisible(false)}
      />
    </>
  );
};

export default SendContextPreview;
