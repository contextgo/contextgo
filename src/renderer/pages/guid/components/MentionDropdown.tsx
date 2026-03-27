/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MentionOption } from '../types';
import { resolveExtensionAssetUrl } from '@/renderer/utils/platform';
import { Dropdown, Menu } from '@arco-design/web-react';
import { Down, Robot } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type MentionDropdownProps = {
  menuRef: React.RefObject<HTMLDivElement>;
  options: MentionOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
};

const MentionDropdown: React.FC<MentionDropdownProps> = ({ menuRef, options, selectedKey, onSelect }) => {
  const { t } = useTranslation();

  return (
    <div
      ref={menuRef}
      className='bg-bg-2 border border-[var(--color-border-2)] rd-12px shadow-lg overflow-hidden'
      style={{ boxShadow: '0 0 0 1px var(--color-border-2), 0 12px 24px rgba(0, 0, 0, 0.12)' }}
    >
      <Menu
        selectedKeys={[selectedKey]}
        onClickMenuItem={(key) => onSelect(String(key))}
        className='min-w-180px max-h-200px overflow-auto'
      >
        {options.length > 0 ? (
          options.map((option, index) => (
            <Menu.Item key={option.key} data-mention-index={index}>
              <div className='flex items-start gap-8px py-2px'>
                <div className='pt-2px'>
                  {option.avatarImage ? (
                    <img
                      src={resolveExtensionAssetUrl(option.avatarImage)}
                      alt=''
                      width={16}
                      height={16}
                      style={{ objectFit: 'contain' }}
                    />
                  ) : option.avatar ? (
                    <span style={{ fontSize: 14, lineHeight: '16px' }}>{option.avatar}</span>
                  ) : option.logo ? (
                    <img src={option.logo} alt={option.label} width={16} height={16} style={{ objectFit: 'contain' }} />
                  ) : (
                    <Robot theme='outline' size={16} />
                  )}
                </div>
                <div className='min-w-0 flex-1 flex flex-col gap-2px'>
                  <div className='flex items-center gap-6px min-w-0'>
                    <span className='truncate'>{option.label}</span>
                    {option.isDefault ? (
                      <span className='shrink-0 text-11px lh-16px px-6px rd-999px bg-fill-2 text-t-secondary'>
                        {t('guid.openclaw.defaultAgent')}
                      </span>
                    ) : null}
                  </div>
                  {option.description ? (
                    <span className='text-12px text-t-secondary truncate' title={option.description}>
                      {option.description}
                    </span>
                  ) : null}
                </div>
              </div>
            </Menu.Item>
          ))
        ) : (
          <Menu.Item key='empty' disabled>
            {t('conversation.welcome.none', { defaultValue: 'None' })}
          </Menu.Item>
        )}
      </Menu>
    </div>
  );
};

export default MentionDropdown;

// MentionSelectorBadge component
type MentionSelectorBadgeProps = {
  visible: boolean;
  open: boolean;
  onOpenChange: (visible: boolean) => void;
  agentLabel: string;
  agentDescription?: string | null;
  isDefault?: boolean;
  mentionMenu: React.ReactNode;
  onResetQuery: () => void;
};

export const MentionSelectorBadge: React.FC<MentionSelectorBadgeProps> = ({
  visible,
  open,
  onOpenChange,
  agentLabel,
  agentDescription,
  isDefault,
  mentionMenu,
  onResetQuery,
}) => {
  const { t } = useTranslation();
  if (!visible) return null;

  const helperParts = [isDefault ? t('guid.openclaw.defaultAgent') : null, agentDescription || null].filter(
    (part): part is string => Boolean(part)
  );

  return (
    <div className='flex flex-col gap-4px mb-8px'>
      <Dropdown
        trigger='click'
        popupVisible={open}
        onVisibleChange={(v) => {
          onOpenChange(v);
          if (v) {
            onResetQuery();
          }
        }}
        droplist={mentionMenu}
      >
        <div className='flex items-center gap-6px bg-fill-2 px-10px py-4px rd-16px cursor-pointer select-none'>
          <span className='text-14px font-medium text-t-primary'>@{agentLabel}</span>
          <Down theme='outline' size={12} />
        </div>
      </Dropdown>
      {helperParts.length > 0 ? (
        <div className='text-12px text-t-secondary truncate px-4px' title={helperParts.join(' · ')}>
          {helperParts.join(' · ')}
        </div>
      ) : null}
    </div>
  );
};
