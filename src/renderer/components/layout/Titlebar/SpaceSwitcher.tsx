import React from 'react';
import { Dropdown, Menu, Message } from '@arco-design/web-react';
import { Down, Plus } from '@icon-park/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ipcBridge } from '@/common';
import type { TSpace } from '@/common/config/storage';

type SpaceSwitcherProps = {
  compact?: boolean;
  placement?: 'titlebar' | 'sider';
};

export default function SpaceSwitcher(props: SpaceSwitcherProps) {
  const [messageApi, holder] = Message.useMessage();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<TSpace[]>([]);
  const [currentSpaceId, setCurrentSpaceId] = useState<string | undefined>();
  const isSiderPlacement = props.placement === 'sider';

  useEffect(() => {
    let cancelled = false;
    void ipcBridge.space.list
      .invoke()
      .then((items) => {
        if (cancelled) return;
        setSpaces(items || []);
      })
      .catch(() => {
        if (cancelled) return;
        setSpaces([]);
      });

    const spaceMatch = location.pathname.match(/^\/space\/([^/]+)/);
    const routeSpaceId = spaceMatch?.[1];
    if (routeSpaceId) {
      setCurrentSpaceId(routeSpaceId);
      return () => {
        cancelled = true;
      };
    }

    const conversationMatch = location.pathname.match(/^\/conversation\/([^/]+)/);
    const conversationId = conversationMatch?.[1];
    if (!conversationId) {
      void ipcBridge.space.ensureDefault
        .invoke()
        .then((space) => {
          if (!cancelled) {
            setCurrentSpaceId(space.id);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCurrentSpaceId(undefined);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    void ipcBridge.conversation.get
      .invoke({ id: conversationId })
      .then((conversation) => {
        if (cancelled) return;
        setCurrentSpaceId(conversation?.extra?.spaceId);
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentSpaceId(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const currentSpace = useMemo(
    () => spaces.find((space) => space.id === currentSpaceId) || spaces.find((space) => space.isDefault),
    [spaces, currentSpaceId]
  );
  const currentSpaceLabel = currentSpace?.name || t('common.mySpace');
  const currentSpaceInitial = currentSpaceLabel.trim().charAt(0).toUpperCase() || 'S';

  const handleCreateSpace = async () => {
    const nextName = `${t('common.space')} ${spaces.length + 1}`;
    const space = await ipcBridge.space.create.invoke({ name: nextName });
    setSpaces((prev) => [space, ...prev]);
    setCurrentSpaceId(space.id);
    await messageApi.success(t('common.spaceCreated', { name: space.name }));
    void navigate(`/space/${space.id}`);
  };

  const menu = (
    <Menu
      onClickMenuItem={(key) => {
        if (key === '__create__') {
          void handleCreateSpace();
          return;
        }
        setCurrentSpaceId(String(key));
        void navigate(`/space/${key}`);
      }}
    >
      {spaces.map((space) => (
        <Menu.Item key={space.id}>{space.name}</Menu.Item>
      ))}
      <Menu.Item key='__create__'>
        <div className='flex items-center gap-8px'>
          <Plus theme='outline' size={14} />
          <span>{t('common.newSpace')}</span>
        </div>
      </Menu.Item>
    </Menu>
  );

  if (isSiderPlacement) {
    return (
      <>
        {holder}
        <Dropdown droplist={menu} trigger='click' position='tr'>
          <button
            type='button'
            className={`sider-space-trigger ${props.compact ? 'sider-space-trigger--compact' : ''}`}
            aria-label={t('common.switchSpace')}
            title={currentSpaceLabel}
          >
            <span className='sider-space-trigger__avatar'>{currentSpaceInitial}</span>
            {!props.compact ? (
              <span className='min-w-0 flex-1 text-left'>
                <span className='block truncate text-14px font-600 text-t-primary'>{currentSpaceLabel}</span>
                <span className='block truncate text-12px text-t-secondary'>{t('common.space')}</span>
              </span>
            ) : null}
            {!props.compact ? <Down theme='outline' size={16} className='sider-space-trigger__chevron' /> : null}
          </button>
        </Dropdown>
      </>
    );
  }

  return (
    <>
      {holder}
      <Dropdown droplist={menu} trigger='click' position='bl'>
        <button type='button' className='app-titlebar__button' aria-label={t('common.switchSpace')}>
          <span className={props.compact ? 'hidden' : 'mr-4px'}>{currentSpaceLabel}</span>
          <Down theme='outline' size={14} />
        </button>
      </Dropdown>
    </>
  );
}
