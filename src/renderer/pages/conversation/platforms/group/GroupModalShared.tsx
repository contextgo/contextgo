/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Typography } from '@arco-design/web-react';
import React from 'react';
import styles from './GroupModalShared.module.css';

export const GROUP_MODAL_STYLE = {
  width: 'min(720px, calc(100vw - 32px))',
  maxHeight: 'calc(100vh - 64px)',
} as const;

export const GROUP_MODAL_CONTENT_STYLE = {
  padding: '12px 20px 20px',
  overflow: 'auto',
  maxHeight: 'min(68vh, 620px)',
} as const;

export const GROUP_MODAL_FOOTER_BUTTON_CLASS_NAME = 'min-w-96px px-18px rd-12px';
export const GROUP_MODAL_SEGMENTED_GROUP_CLASS_NAME = styles.segmentedGroup;
export const GROUP_MODAL_SELECT_CLASS_NAME = styles.roundedSelect;
export const GROUP_MODAL_FIELD_CLASS_NAME = styles.roundedField;
export const GROUP_MODAL_PARTICIPANT_CARD_CLASS_NAME = styles.participantCard;
export const GROUP_MODAL_PARTICIPANT_CARD_SELECTED_CLASS_NAME = styles.participantCardSelected;
export const GROUP_MODAL_PARTICIPANT_CARD_DISABLED_CLASS_NAME = styles.participantCardDisabled;
export const GROUP_MODAL_PARTICIPANT_META_CLASS_NAME = styles.participantMeta;
export const GROUP_MODAL_INLINE_CONTROL_ROW_CLASS_NAME = styles.inlineControlRow;
export const GROUP_MODAL_INNER_PANEL_CLASS_NAME = styles.innerPanel;

export const GROUP_MODAL_PARTICIPANT_LIST_STYLE = {
  maxHeight: 'min(34vh, 320px)',
} as const;

const GROUP_MODAL_SECTION_CLASS_NAME =
  'flex flex-col gap-8px bg-2 border border-solid border-[var(--border-base)] px-16px py-12px rd-20px shadow-[0_10px_24px_rgba(15,23,42,0.06)]';

type GroupModalSectionProps = {
  children: React.ReactNode;
  title: React.ReactNode;
};

const GroupModalSection: React.FC<GroupModalSectionProps> = ({ children, title }) => {
  return (
    <div className={GROUP_MODAL_SECTION_CLASS_NAME}>
      <Typography.Text className='font-600'>{title}</Typography.Text>
      {children}
    </div>
  );
};

export default GroupModalSection;
