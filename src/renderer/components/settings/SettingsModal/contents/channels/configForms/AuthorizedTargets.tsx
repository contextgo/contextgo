/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelAuthorizedTarget } from '@process/channels/types';
import { Button, Empty, Spin, Tooltip } from '@arco-design/web-react';
import { Delete, Refresh } from '@icon-park/react';
import type { TFunction } from 'i18next';
import React from 'react';
import { FormSectionHeader, formLayoutStyles } from './FormLayout';

export type AuthorizedTargetKind = 'direct' | 'group' | 'channel' | 'topic' | 'thread' | 'chat';

type AuthorizedTargetListProps = {
  loading: boolean;
  targets: IChannelAuthorizedTarget[];
  onRefresh: () => void;
  onRevoke: (targetId: string) => void;
  t: TFunction;
  hideWhenEmpty?: boolean;
};

function looksLikeTechnicalIdentifier(value?: string): boolean {
  if (!value) {
    return false;
  }

  return value.includes('://') || value.startsWith('user:') || value.startsWith('group:') || value.includes(':thread:');
}

function toReadableIdentifier(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const threadMarker = ':thread:';
  if (value.includes(threadMarker)) {
    return value.slice(value.indexOf(threadMarker) + threadMarker.length) || undefined;
  }

  if (value.startsWith('user:')) {
    return value.slice(5) || undefined;
  }

  if (value.startsWith('group:')) {
    return value.slice(6) || undefined;
  }

  if (value.includes('://')) {
    const segments = value.split('/').filter(Boolean);
    return segments.at(-1) || undefined;
  }

  return value;
}

function getTargetKindLabel(kind: AuthorizedTargetKind, t: TFunction): string {
  switch (kind) {
    case 'direct':
      return t('settings.channels.publication.audienceKind.direct', { defaultValue: 'Direct chat' });
    case 'group':
      return t('settings.channels.publication.audienceKind.group', { defaultValue: 'Group' });
    case 'channel':
      return t('settings.channels.publication.audienceKind.channel', { defaultValue: 'Channel' });
    case 'topic':
      return t('settings.channels.publication.audienceKind.topic', { defaultValue: 'Topic' });
    case 'thread':
      return t('settings.channels.publication.audienceKind.thread', { defaultValue: 'Thread' });
    case 'chat':
    default:
      return t('settings.channels.publication.audienceKind.chat', { defaultValue: 'Chat target' });
  }
}

export function inferAuthorizedTargetKind(target: IChannelAuthorizedTarget): AuthorizedTargetKind {
  const normalizedType = target.targetType?.toLowerCase();
  const normalizedTargetId = target.targetId.toLowerCase();

  if (normalizedType === 'topic' || normalizedTargetId.includes('/topic/')) {
    return 'topic';
  }

  if (
    normalizedType === 'thread' ||
    target.threadId ||
    normalizedTargetId.includes('/thread/') ||
    normalizedTargetId.includes(':thread:')
  ) {
    return 'thread';
  }

  if (normalizedType === 'channel' || normalizedTargetId.includes('/channel/')) {
    return 'channel';
  }

  if (
    normalizedType === 'group' ||
    normalizedType === 'supergroup' ||
    normalizedTargetId.startsWith('group:') ||
    normalizedTargetId.includes('/group/')
  ) {
    return 'group';
  }

  if (
    normalizedType === 'direct' ||
    normalizedType === 'dm' ||
    normalizedType === 'private' ||
    normalizedType === 'p2p' ||
    normalizedType === 'user' ||
    normalizedType === 'friend' ||
    normalizedTargetId.startsWith('user:') ||
    normalizedTargetId.includes('/user/') ||
    normalizedTargetId.includes('/friend/') ||
    normalizedTargetId.includes('/dm/') ||
    normalizedTargetId.includes('/p2p/')
  ) {
    return 'direct';
  }

  return 'chat';
}

export function getAuthorizedTargetDisplayName(target: IChannelAuthorizedTarget, t: TFunction): string {
  const kind = inferAuthorizedTargetKind(target);
  if (target.displayName && !looksLikeTechnicalIdentifier(target.displayName)) {
    return target.displayName;
  }

  const preferredId =
    target.threadId ||
    target.platformChatId ||
    target.remoteUserId ||
    toReadableIdentifier(target.targetId) ||
    target.targetId;

  return getTargetKindLabel(kind, t) + ' ' + (preferredId || t('conversation.unknown', { defaultValue: 'Unknown' }));
}

export function getAuthorizedTargetMeta(target: IChannelAuthorizedTarget, t: TFunction): string {
  const kind = inferAuthorizedTargetKind(target);
  const parts = [getTargetKindLabel(kind, t)];
  const candidateParts = [
    kind === 'topic' || kind === 'thread' ? toReadableIdentifier(target.parentTargetId) : undefined,
    kind === 'direct' ? toReadableIdentifier(target.remoteUserId) : undefined,
    toReadableIdentifier(target.platformChatId),
    kind === 'topic' || kind === 'thread' ? toReadableIdentifier(target.threadId) : undefined,
    toReadableIdentifier(target.targetId),
  ].filter((value): value is string => Boolean(value));

  for (const value of candidateParts) {
    if (!parts.includes(value)) {
      parts.push(value);
    }
  }

  return parts.join(' · ');
}

export const AuthorizedTargetList: React.FC<AuthorizedTargetListProps> = ({
  loading,
  targets,
  onRefresh,
  onRevoke,
  t,
  hideWhenEmpty = false,
}) => {
  if (hideWhenEmpty && targets.length === 0 && !loading) {
    return null;
  }

  return (
    <div className={formLayoutStyles.sectionCard}>
      <FormSectionHeader
        title={t('settings.assistant.authorizedUsers', 'Authorized Targets')}
        action={
          <Button size='mini' type='text' icon={<Refresh size={14} />} loading={loading} onClick={onRefresh}>
            {t('common.refresh', 'Refresh')}
          </Button>
        }
      />

      {loading ? (
        <div className='flex justify-center py-24px'>
          <Spin />
        </div>
      ) : targets.length === 0 ? (
        <Empty description={t('settings.assistant.noAuthorizedUsers', 'No authorized targets yet')} />
      ) : (
        <div className={formLayoutStyles.statusList}>
          {targets.map((target) => (
            <div key={target.id} className={formLayoutStyles.statusItem}>
              <div className={formLayoutStyles.statusItemMain}>
                <div className='text-14px font-500 text-t-primary'>{getAuthorizedTargetDisplayName(target, t)}</div>
                <div className={formLayoutStyles.metaText}>{getAuthorizedTargetMeta(target, t)}</div>
                <div className={formLayoutStyles.metaText}>
                  {t('settings.assistant.authorizedAt', 'Authorized')}: {new Date(target.authorizedAt).toLocaleString()}
                </div>
              </div>
              <div className={formLayoutStyles.statusItemActions}>
                <Tooltip content={t('settings.assistant.revokeAccess', 'Revoke authorization')}>
                  <Button
                    type='text'
                    status='danger'
                    size='small'
                    icon={<Delete size={16} />}
                    onClick={() => onRevoke(target.id)}
                  />
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
