import React from 'react';
import { Message, Spin } from '@arco-design/web-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ipcBridge } from '@/common';
import SpaceShell from './SpaceShell';

type SpacePageProps = {
  spaceId?: string;
  spaceName?: string;
};

export default function SpacePage(props: SpacePageProps) {
  const params = useParams<{ spaceId: string }>();
  const [messageApi, holder] = Message.useMessage();
  const [resolvedName, setResolvedName] = useState(props.spaceName || 'My Space');
  const [loading, setLoading] = useState(true);
  const resolvedSpaceId = useMemo(() => props.spaceId || params.spaceId, [params.spaceId, props.spaceId]);

  useEffect(() => {
    let cancelled = false;

    if (!resolvedSpaceId) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    void ipcBridge.space.list
      .invoke()
      .then((spaces) => {
        if (cancelled) {
          return;
        }
        const matched = spaces.find((space) => space.id === resolvedSpaceId);
        setResolvedName(matched?.name || props.spaceName || 'My Space');
      })
      .catch(async () => {
        if (cancelled) {
          return;
        }
        await messageApi.error('Failed to load space info');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [messageApi, props.spaceName, resolvedSpaceId]);

  if (!resolvedSpaceId) {
    return (
      <>
        {holder}
        <div className='flex h-full items-center justify-center'>Space not found</div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        {holder}
        <div className='flex h-full items-center justify-center'>
          <Spin />
        </div>
      </>
    );
  }

  return (
    <>
      {holder}
      <SpaceShell spaceId={resolvedSpaceId} spaceName={resolvedName} />
    </>
  );
}
