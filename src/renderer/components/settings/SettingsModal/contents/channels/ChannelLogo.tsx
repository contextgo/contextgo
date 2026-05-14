/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { isBuiltinChannelType, type BuiltinChannelType } from '@/common/config/builtinChannels';
import ChannelDingTalkLogo from '@/renderer/assets/channel-logos/dingtalk.svg?url';
import ChannelDiscordLogo from '@/renderer/assets/channel-logos/discord.svg?url';
import ChannelLarkLogo from '@/renderer/assets/channel-logos/lark.svg?url';
import ChannelSlackLogo from '@/renderer/assets/channel-logos/slack.svg?url';
import ChannelTelegramLogo from '@/renderer/assets/channel-logos/telegram.svg?url';
import ChannelWeixinLogo from '@/renderer/assets/channel-logos/weixin.svg?url';
import { resolveExtensionAssetUrl } from '@/renderer/utils/platform';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import styles from './ChannelModalContent.module.css';

type ChannelLogoProps = {
  title: string;
  channelId?: string;
  familyId?: string;
  icon?: string;
  size?: 'small' | 'large';
};

const BUILTIN_CHANNEL_LOGOS: Record<BuiltinChannelType, { src: string; alt: string }> = {
  telegram: { src: ChannelTelegramLogo, alt: 'Telegram' },
  slack: { src: ChannelSlackLogo, alt: 'Slack' },
  discord: { src: ChannelDiscordLogo, alt: 'Discord' },
  lark: { src: ChannelLarkLogo, alt: 'Lark / Feishu' },
  dingtalk: { src: ChannelDingTalkLogo, alt: 'DingTalk' },
  weixin: { src: ChannelWeixinLogo, alt: 'WeChat' },
};

const getInitials = (title: string): string =>
  title
    .split(/[\s/&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

const resolveBuiltinLogo = (_channelId?: string, familyId?: string) => {
  if (familyId && isBuiltinChannelType(familyId)) {
    return BUILTIN_CHANNEL_LOGOS[familyId];
  }

  return undefined;
};

const ChannelLogo: React.FC<ChannelLogoProps> = ({ title, channelId, familyId, icon, size = 'small' }) => {
  const builtinLogo = useMemo(() => resolveBuiltinLogo(channelId, familyId), [channelId, familyId]);
  const logoCandidates = useMemo(() => {
    const builtinSrc = builtinLogo?.src;
    const extensionSrc = resolveExtensionAssetUrl(icon);
    return [builtinSrc, extensionSrc].filter((value): value is string => Boolean(value));
  }, [builtinLogo?.src, icon]);
  const [logoIndex, setLogoIndex] = useState(0);
  const logoSrc = logoCandidates[logoIndex];
  const logoAlt = builtinLogo?.alt || title;
  const initials = useMemo(() => getInitials(title), [title]);

  useEffect(() => {
    setLogoIndex(0);
  }, [logoCandidates]);

  return (
    <div
      className={classNames(
        styles.logoBase,
        size === 'large' ? styles.logoLarge : styles.logoSmall,
        !logoSrc && styles.logoFallback
      )}
      aria-hidden='true'
    >
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={logoAlt}
          className={styles.logoImage}
          onError={() => {
            setLogoIndex((currentIndex) => currentIndex + 1);
          }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

export default ChannelLogo;
