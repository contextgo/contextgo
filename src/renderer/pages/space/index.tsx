import { ipcBridge, type IContextMemoryView, type IContextProfileView } from '@/common';
import type { TSpace } from '@/common/config/storage';
import { Button, Empty, Spin } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DEFAULT_SPACE_SHELL_VIEW, resolveSpaceShellView } from './constants';
import type { SpaceShellView } from './types';

type SpaceContextState = {
  memories: IContextMemoryView[];
  profiles: IContextProfileView[];
};

const surfaceStyle: React.CSSProperties = {
  border: '1px solid var(--border-base)',
  background: 'var(--bg-1)',
};

const mutedSurfaceStyle: React.CSSProperties = {
  border: '1px solid var(--border-base)',
  background: 'color-mix(in srgb, var(--bg-1) 92%, var(--fill-2) 8%)',
};

const SpacePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { spaceId = '' } = useParams<{ spaceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [space, setSpace] = useState<TSpace | null>(null);
  const [contextState, setContextState] = useState<SpaceContextState>({ memories: [], profiles: [] });
  const [loading, setLoading] = useState(true);

  const activeView = useMemo<SpaceShellView>(
    () => resolveSpaceShellView(searchParams.get('view')),
    [searchParams]
  );

  useEffect(() => {
    if (!spaceId) {
      setSpace(null);
      setContextState({ memories: [], profiles: [] });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void Promise.all([ipcBridge.space.get.invoke({ id: spaceId }), ipcBridge.space.getContext.invoke({ spaceId })])
      .then(([nextSpace, nextContext]) => {
        if (cancelled) {
          return;
        }

        setSpace(nextSpace ?? null);
        setContextState(nextContext);
      })
      .catch((error) => {
        console.error('[SpacePage] Failed to load space shell:', error);
        if (!cancelled) {
          setSpace(null);
          setContextState({ memories: [], profiles: [] });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const renderOverview = () => {
    if (!space) {
      return null;
    }

    const stats = [
      { key: 'members', label: t('space.shell.members'), value: String(space.members?.length ?? 0) },
      { key: 'memory', label: t('space.shell.memory'), value: String(contextState.memories.length) },
      { key: 'profiles', label: t('space.shell.profiles'), value: String(contextState.profiles.length) },
    ];

    return (
      <div className='flex flex-col gap-16px'>
        <div className='rounded-16px p-20px' style={surfaceStyle}>
          <h1 className='m-0 text-24px font-700 text-t-primary'>{space.name}</h1>
          <p className='m-0 max-w-720px text-14px leading-22px text-t-secondary'>
            {space.description || t('space.shell.description')}
          </p>
        </div>
        <div className='grid grid-cols-1 gap-12px md:grid-cols-3 xl:grid-cols-3'>
          {stats.map((item) => (
            <div key={item.key} className='rounded-14px p-16px' style={mutedSurfaceStyle}>
              <div className='text-12px font-600 uppercase tracking-[0.08em] text-t-secondary'>{item.label}</div>
              <div className='mt-10px text-22px font-700 text-t-primary'>{item.value}</div>
            </div>
          ))}
        </div>
        <div className='rounded-16px p-20px' style={surfaceStyle}>
          <div className='mb-8px text-16px font-600 text-t-primary'>{t('common.returnToWorkbench')}</div>
          <div className='text-14px leading-22px text-t-secondary'>{t('space.shell.workbenchHint')}</div>
          <Button className='mt-16px' type='primary' onClick={() => void navigate('/guid')}>
            {t('common.returnToWorkbench')}
          </Button>
        </div>
      </div>
    );
  };

  const renderContext = () => (
    <div className='grid grid-cols-1 gap-16px xl:grid-cols-2'>
      <div className='rounded-16px p-20px' style={surfaceStyle}>
        <div className='mb-12px text-16px font-600 text-t-primary'>{t('space.shell.memory')}</div>
        <div className='flex flex-col gap-10px'>
          {contextState.memories.length === 0 ? (
            <div className='text-14px text-t-secondary'>{t('space.shell.comingSoon')}</div>
          ) : (
            contextState.memories.map((memory) => (
              <div key={memory.id} className='rounded-12px p-12px' style={mutedSurfaceStyle}>
                <div className='text-14px font-600 text-t-primary'>{memory.summary}</div>
                {memory.detail ? <div className='mt-6px text-13px leading-20px text-t-secondary'>{memory.detail}</div> : null}
              </div>
            ))
          )}
        </div>
      </div>
      <div className='rounded-16px p-20px' style={surfaceStyle}>
        <div className='mb-12px text-16px font-600 text-t-primary'>{t('space.shell.profiles')}</div>
        <div className='flex flex-col gap-10px'>
          {contextState.profiles.length === 0 ? (
            <div className='text-14px text-t-secondary'>{t('space.shell.comingSoon')}</div>
          ) : (
            contextState.profiles.map((profile) => (
              <div key={profile.id} className='rounded-12px p-12px' style={mutedSurfaceStyle}>
                <div className='text-13px font-600 uppercase tracking-[0.08em] text-t-secondary'>{profile.key}</div>
                <div className='mt-6px text-14px text-t-primary'>{profile.summary}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderMain = () => {
    if (loading) {
      return (
        <div className='flex min-h-320px items-center justify-center'>
          <Spin size={28} />
        </div>
      );
    }

    if (!space) {
      return <Empty description={t('space.shell.emptyDescription')} />;
    }

    if (activeView === 'overview') {
      return renderOverview();
    }

    if (activeView === 'context') {
      return renderContext();
    }

    return (
      <div className='rounded-16px p-20px' style={surfaceStyle}>
        <div className='text-18px font-600 text-t-primary'>
          {t(`space.views.${activeView}` as const, {
            defaultValue: t(`space.views.${DEFAULT_SPACE_SHELL_VIEW}` as const),
          })}
        </div>
        <div className='mt-10px text-14px leading-22px text-t-secondary'>{t('space.shell.comingSoon')}</div>
        <Button
          className='mt-16px'
          type='outline'
          onClick={() => {
            setSearchParams({ view: 'overview' });
          }}
        >
          {t('space.views.overview')}
        </Button>
      </div>
    );
  };

  return (
    <div className='secondary-page-frame'>
      <div className='secondary-page-inner'>{renderMain()}</div>
    </div>
  );
};

export default SpacePage;
