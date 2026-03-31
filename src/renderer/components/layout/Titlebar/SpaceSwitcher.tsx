import React from 'react';
import { Dropdown, Menu, Message } from '@arco-design/web-react';
import { Down, Plus } from '@icon-park/react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ipcBridge } from '@/common';
import type { TSpace } from '@/common/config/storage';

type SpaceSwitcherProps = {
  compact?: boolean;
};

const DEFAULT_LABEL = 'My Space';

export default function SpaceSwitcher(props: SpaceSwitcherProps) {
  const [messageApi, holder] = Message.useMessage();
  const location = useLocation();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<TSpace[]>([]);
  const [currentSpaceId, setCurrentSpaceId] = useState<string | undefined>();

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

    const match = location.pathname.match(/^\/conversation\/([^/]+)/);
    const conversationId = match?.[1];
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

  const handleCreateSpace = async () => {
    const nextName = `Space ${spaces.length + 1}`;
    const space = await ipcBridge.space.create.invoke({ name: nextName });
    setSpaces((prev) => [space, ...prev]);
    setCurrentSpaceId(space.id);
    await messageApi.success(`Created ${space.name}`);
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
          <span>New Space</span>
        </div>
      </Menu.Item>
    </Menu>
  );

  return (
    <>
      {holder}
      <Dropdown droplist={menu} trigger='click' position='bl'>
        <button type='button' className='app-titlebar__button' aria-label='Switch space'>
          <span className={props.compact ? 'hidden' : 'mr-4px'}>{currentSpace?.name || DEFAULT_LABEL}</span>
          <Down theme='outline' size={14} />
        </button>
      </Dropdown>
    </>
  );
}
