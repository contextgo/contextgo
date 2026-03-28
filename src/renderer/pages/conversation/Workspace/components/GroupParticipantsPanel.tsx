/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GroupParticipant } from '@/common/config/storage';
import { CUSTOM_AVATAR_IMAGE_MAP } from '@/renderer/pages/guid/constants';
import { resolveExtensionAssetUrl } from '@/renderer/utils/platform';
import { getAgentLogo } from '@/renderer/utils/model/agentLogo';
import { Typography } from '@arco-design/web-react';
import { Robot } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type GroupParticipantsPanelProps = {
  participants: GroupParticipant[];
};

const resolveParticipantTypeLabelKey = (participantType: GroupParticipant['participantType']) => {
  return participantType === 'preset-assistant'
    ? 'conversation.workspace.groupMembers.participantType.presetAssistant'
    : 'conversation.workspace.groupMembers.participantType.cliAgent';
};

const getCliAgentBackend = (participantKey: string): string | null => {
  const [backend] = participantKey.split(':');
  return backend?.trim() ? backend.trim() : null;
};

const isEmojiAvatar = (value: string): boolean => {
  return /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u.test(
    value
  );
};

const resolveAvatarImageSrc = (avatar: string | undefined): string | null => {
  const value = avatar?.trim();
  if (!value) {
    return null;
  }

  const mappedAvatarImage = CUSTOM_AVATAR_IMAGE_MAP[value];
  if (mappedAvatarImage) {
    return mappedAvatarImage;
  }

  const resolvedAvatar = resolveExtensionAssetUrl(value) || value;
  const isImageLike =
    /\.(svg|png|jpe?g|webp|gif)$/i.test(resolvedAvatar) ||
    /^(https?:|aion-asset:\/\/|file:\/\/|data:)/i.test(resolvedAvatar);
  return isImageLike ? resolvedAvatar : null;
};

const getParticipantFallbackText = (participant: GroupParticipant): string => {
  const avatarValue = participant.avatar?.trim();
  if (avatarValue && isEmojiAvatar(avatarValue)) {
    return avatarValue;
  }
  return participant.name.slice(0, 1).toUpperCase();
};

const resolveParticipantVisual = (
  participant: GroupParticipant
): { imageSrc: string | null; fallbackText: string } => {
  const avatarImageSrc = resolveAvatarImageSrc(participant.avatar);
  if (avatarImageSrc) {
    return {
      imageSrc: avatarImageSrc,
      fallbackText: getParticipantFallbackText(participant),
    };
  }

  const cliAgentBackend =
    participant.participantType === 'cli-agent' ? getCliAgentBackend(participant.participantKey) : null;
  const agentLogo = cliAgentBackend ? getAgentLogo(cliAgentBackend) : null;
  if (agentLogo) {
    return {
      imageSrc: agentLogo,
      fallbackText: getParticipantFallbackText(participant),
    };
  }

  return {
    imageSrc: null,
    fallbackText: getParticipantFallbackText(participant),
  };
};

const getParticipantMetaLabel = (participant: GroupParticipant, participantTypeLabel: string): string => {
  if (participant.participantType === 'cli-agent') {
    return getCliAgentBackend(participant.participantKey)?.toUpperCase() || participant.participantKey;
  }

  return participantTypeLabel;
};

const getParticipantRoleLabel = (participant: GroupParticipant, t: (key: string) => string): string | null => {
  return participant.role ? t(`conversation.group.role.${participant.role}`) : null;
};

const GroupParticipantsPanel: React.FC<GroupParticipantsPanelProps> = ({ participants }) => {
  const { t } = useTranslation();

  if (participants.length === 0) {
    return null;
  }

  return (
    <div
      className='overflow-hidden rounded-18px border border-border-2 bg-[var(--color-bg-1)] px-14px py-14px'
      style={{ boxShadow: '0 20px 48px rgba(15, 23, 42, 0.16)' }}
    >
      <div className='mb-12px flex items-center justify-between gap-12px'>
        <Typography.Text className='text-13px font-semibold text-t-primary'>
          {t('conversation.workspace.groupMembers.title')}
        </Typography.Text>
        <Typography.Text className='rounded-full bg-[var(--color-fill-2)] px-8px py-3px text-11px text-t-secondary'>
          {t('conversation.workspace.groupMembers.count', { count: participants.length })}
        </Typography.Text>
      </div>

      <div className='flex max-h-240px flex-col gap-8px overflow-y-auto pr-4px'>
        {participants.map((participant) => {
          const { imageSrc, fallbackText } = resolveParticipantVisual(participant);
          const participantTypeLabel = t(resolveParticipantTypeLabelKey(participant.participantType));
          const metaLabel = getParticipantMetaLabel(participant, participantTypeLabel);
          const roleLabel = getParticipantRoleLabel(participant, t);

          return (
            <div
              key={participant.id}
              className='flex items-center gap-12px rounded-16px border border-border-2 bg-[var(--color-fill-1)] px-12px py-12px'
            >
              <div className='flex h-38px w-38px shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-2 bg-[linear-gradient(180deg,var(--color-bg-2),var(--color-fill-2))]'>
                {imageSrc ? (
                  <img src={imageSrc} alt={participant.name} className='block h-24px w-24px object-contain' />
                ) : (
                  <span className='text-14px leading-18px'>{fallbackText}</span>
                )}
              </div>

              <div className='min-w-0 flex-1'>
                <div className='flex items-center justify-between gap-8px'>
                  <div className='min-w-0 flex-1'>
                    <Typography.Text className='block truncate text-13px font-semibold text-t-primary'>
                      {participant.name}
                    </Typography.Text>
                    <div className='mt-3px flex items-center gap-6px text-11px text-t-secondary'>
                      {roleLabel ? <span className='truncate'>{roleLabel}</span> : null}
                      {roleLabel ? <span className='h-3px w-3px shrink-0 rounded-full bg-[var(--color-fill-4)]'></span> : null}
                      <span className='truncate'>{participantTypeLabel}</span>
                      <span className='h-3px w-3px shrink-0 rounded-full bg-[var(--color-fill-4)]'></span>
                      <span className='truncate'>{metaLabel}</span>
                    </div>
                  </div>
                  <span className='inline-flex shrink-0 items-center gap-4px rounded-full bg-[var(--color-fill-2)] px-8px py-3px text-11px text-t-secondary'>
                    <Robot size={12} />
                    {metaLabel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GroupParticipantsPanel;
