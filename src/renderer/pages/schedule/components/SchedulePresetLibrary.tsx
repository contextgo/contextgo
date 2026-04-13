/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Tag, Typography } from '@arco-design/web-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CRON_PRESET_CATEGORY_ORDER,
  DEFAULT_CRON_PRESET_PACK,
  DEFAULT_CRON_PRESET_HERO_IDS,
  CRON_PRESET_PACK_ORDER,
  filterCronPresetsByPack,
  type CronPreset,
  type CronPresetCategory,
  type SchedulePresetId,
  type CronPresetPack,
} from '../schedulePresetUtils';

const categoryColorMap: Record<CronPresetCategory, 'arcoblue' | 'green' | 'orange' | 'purple' | 'gray'> = {
  research: 'arcoblue',
  planning: 'green',
  review: 'orange',
  reporting: 'purple',
  operations: 'gray',
};

interface SchedulePresetLibraryProps {
  presets: CronPreset[];
  previewOnly?: boolean;
  creatingPresetId?: SchedulePresetId | null;
  helperText?: string;
  onCreatePreset?: (preset: CronPreset) => void;
  onFillPreset?: (preset: CronPreset) => void;
}

const SchedulePresetLibrary: React.FC<SchedulePresetLibraryProps> = ({
  presets,
  previewOnly = false,
  creatingPresetId = null,
  helperText,
  onCreatePreset,
  onFillPreset,
}) => {
  const { t } = useTranslation();
  const [activePack, setActivePack] = useState<CronPresetPack | 'all'>(DEFAULT_CRON_PRESET_PACK);
  const [showAllInPack, setShowAllInPack] = useState(false);
  const packFilteredPresets = useMemo(() => filterCronPresetsByPack(presets, activePack), [activePack, presets]);
  const activePackDetailKey = activePack === 'all' ? 'all' : activePack;
  const activePackPresetCount = activePack === 'all' ? presets.length : packFilteredPresets.length;
  const isRecommendedPack = activePack === DEFAULT_CRON_PRESET_PACK;
  const shouldCondenseDefaultPack = activePack === DEFAULT_CRON_PRESET_PACK;
  const condensedDefaultPresets = useMemo(
    () =>
      packFilteredPresets
        .filter((preset) => DEFAULT_CRON_PRESET_HERO_IDS.includes(preset.id))
        .sort((left, right) => {
          return DEFAULT_CRON_PRESET_HERO_IDS.indexOf(left.id) - DEFAULT_CRON_PRESET_HERO_IDS.indexOf(right.id);
        }),
    [packFilteredPresets]
  );
  const visiblePresets = shouldCondenseDefaultPack && !showAllInPack ? condensedDefaultPresets : packFilteredPresets;
  const hiddenPresetCount = shouldCondenseDefaultPack
    ? Math.max(packFilteredPresets.length - condensedDefaultPresets.length, 0)
    : 0;
  const packOptions = useMemo(
    () =>
      CRON_PRESET_PACK_ORDER.map((pack) => ({
        value: pack,
        count: presets.filter((preset) => preset.packs.includes(pack)).length,
      })),
    [presets]
  );
  const groupedPresets = useMemo(
    () =>
      CRON_PRESET_CATEGORY_ORDER.map((category) => ({
        category,
        presets: visiblePresets.filter((preset) => preset.category === category),
      })).filter((group) => group.presets.length > 0),
    [visiblePresets]
  );

  const handlePackChange = (pack: CronPresetPack | 'all') => {
    setActivePack(pack);
    setShowAllInPack(false);
  };

  return (
    <div className='flex flex-col gap-12px'>
      <div className='flex flex-col gap-4px'>
        <Typography.Text className='text-14px font-semibold text-t-primary'>
          {t('schedule.presets.title')}
        </Typography.Text>
        <Typography.Text className='text-12px leading-6 text-t-secondary'>
          {t('schedule.presets.description')}
        </Typography.Text>
      </div>

      <div className='flex flex-col gap-8px'>
        <Typography.Text className='text-11px font-semibold tracking-[0.04em] text-t-secondary uppercase'>
          {t('schedule.presets.packPacksTitle')}
        </Typography.Text>
        <div className='border border-solid border-[var(--color-neutral-3)] bg-[var(--color-fill-1)] px-12px py-12px rd-18px'>
          <div className='flex flex-col gap-10px'>
            <div className='flex items-start justify-between gap-10px flex-wrap'>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-8px flex-wrap'>
                  <Typography.Text className='text-13px font-semibold text-t-primary'>
                    {t(
                      activePack === 'all'
                        ? 'schedule.presets.packDetails.all.title'
                        : `schedule.presets.packs.${activePackDetailKey}`
                    )}
                  </Typography.Text>
                  {isRecommendedPack ? (
                    <Tag size='small' color='green'>
                      {t('schedule.presets.recommended')}
                    </Tag>
                  ) : null}
                </div>
                <Typography.Text className='mt-4px block text-12px leading-6 text-t-secondary'>
                  {t(`schedule.presets.packDetails.${activePackDetailKey}.description`)}
                </Typography.Text>
              </div>
              <span className='inline-flex items-center rounded-full bg-[var(--color-fill-2)] px-8px py-2px text-11px font-semibold text-t-tertiary'>
                {activePackPresetCount} {t('schedule.presets.packDetails.presetCount')}
              </span>
            </div>

            <div className='grid grid-cols-1 gap-8px md:grid-cols-2'>
              <div className='bg-[var(--bg-1)] px-10px py-8px rd-12px'>
                <Typography.Text className='text-11px font-medium text-t-tertiary'>
                  {t('schedule.presets.packDetails.bestForLabel')}
                </Typography.Text>
                <Typography.Text className='mt-4px block text-12px leading-6 text-t-secondary'>
                  {t(`schedule.presets.packDetails.${activePackDetailKey}.bestFor`)}
                </Typography.Text>
              </div>
              <div className='bg-[var(--bg-1)] px-10px py-8px rd-12px'>
                <Typography.Text className='text-11px font-medium text-t-tertiary'>
                  {t('schedule.presets.packDetails.outcomeLabel')}
                </Typography.Text>
                <Typography.Text className='mt-4px block text-12px leading-6 text-t-secondary'>
                  {t(`schedule.presets.packDetails.${activePackDetailKey}.outcome`)}
                </Typography.Text>
              </div>
            </div>
          </div>
        </div>
        <div className='flex flex-wrap gap-8px'>
          {packOptions.map((option) => (
            <Button
              key={option.value}
              size='mini'
              type={activePack === option.value ? 'primary' : 'outline'}
              onClick={() => handlePackChange(option.value)}
            >
              {t(`schedule.presets.packs.${option.value}`)} {option.count}
            </Button>
          ))}
          <Button size='mini' type={activePack === 'all' ? 'outline' : 'text'} onClick={() => handlePackChange('all')}>
            {t('schedule.presets.actions.browseAllPacks')}
          </Button>
        </div>
      </div>

      <div className='flex flex-col gap-14px'>
        {groupedPresets.map((group) => (
          <div key={group.category} className='flex flex-col gap-10px'>
            <div className='flex items-center justify-between gap-10px'>
              <Typography.Text className='text-12px font-semibold tracking-[0.04em] text-t-secondary uppercase'>
                {t(`schedule.presets.categories.${group.category}`)}
              </Typography.Text>
              <span className='inline-flex min-w-22px items-center justify-center rounded-full bg-fill-2 px-8px py-2px text-11px font-semibold text-t-tertiary'>
                {group.presets.length}
              </span>
            </div>

            <div className='flex flex-col gap-10px'>
              {group.presets.map((preset) => (
                <div
                  key={preset.id}
                  className='border border-solid border-[var(--border-base)] bg-2 px-12px py-12px rd-18px shadow-sm'
                >
                  <div className='flex items-start justify-between gap-10px'>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-6px flex-wrap'>
                        <Typography.Text className='text-13px font-medium text-t-primary'>
                          {preset.name}
                        </Typography.Text>
                        <Tag size='small' color={categoryColorMap[preset.category]}>
                          {t(`schedule.presets.categories.${preset.category}`)}
                        </Tag>
                        {preset.packs.map((pack) => (
                          <Tag key={`${preset.id}-${pack}`} size='small' color='arcoblue'>
                            {t(`schedule.presets.packs.${pack}`)}
                          </Tag>
                        ))}
                      </div>
                      <Typography.Text className='mt-4px block text-12px leading-6 text-t-secondary'>
                        {preset.description}
                      </Typography.Text>
                    </div>

                    <Typography.Text className='shrink-0 text-right text-11px leading-5 text-t-tertiary'>
                      {preset.schedule.description}
                    </Typography.Text>
                  </div>

                  <div className='mt-10px flex flex-col gap-4px'>
                    <Typography.Text className='text-11px font-medium text-t-tertiary'>
                      {t('schedule.message')}
                    </Typography.Text>
                    <div className='bg-[var(--bg-1)] px-10px py-8px rd-12px text-12px leading-6 text-t-secondary'>
                      {preset.message}
                    </div>
                  </div>

                  {!previewOnly && (onCreatePreset || onFillPreset) && (
                    <div className='mt-12px flex flex-wrap gap-8px'>
                      {onCreatePreset && (
                        <Button
                          type='primary'
                          size='mini'
                          loading={creatingPresetId === preset.id}
                          onClick={() => onCreatePreset(preset)}
                        >
                          {t('schedule.presets.actions.useNow')}
                        </Button>
                      )}
                      {onFillPreset && (
                        <Button size='mini' onClick={() => onFillPreset(preset)}>
                          {t('schedule.presets.actions.fillPrompt')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {shouldCondenseDefaultPack && hiddenPresetCount > 0 ? (
        <div className='flex justify-center'>
          <Button size='mini' type='outline' onClick={() => setShowAllInPack((value) => !value)}>
            {showAllInPack
              ? t('schedule.presets.actions.showLessInPack')
              : t('schedule.presets.actions.viewAllInPack', { count: packFilteredPresets.length })}
          </Button>
        </div>
      ) : null}

      {helperText ? (
        <Typography.Text className='text-12px leading-6 text-t-tertiary'>{helperText}</Typography.Text>
      ) : null}
    </div>
  );
};

export default SchedulePresetLibrary;
