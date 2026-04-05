import { ipcBridge, type IContextMemoryView, type IContextProfileView } from '@/common';
import type { TChatConversation, TSpace } from '@/common/config/storage';
import { Button, Empty, Spin, Tag } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AffineCanvasSurface from './affine/AffineCanvasSurface';
import { projectSpaceToEdgeless } from './affine/projectSpaceToEdgeless';
import type { SpaceAffineCanvasLabels } from './affine/types';
import { DEFAULT_SPACE_SHELL_VIEW, resolveSpaceShellView } from './constants';
import type { SpaceShellView } from './types';
import { buildSpaceProjectGroups } from './utils/spaceCanvasBoard';

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

const heroStyle: React.CSSProperties = {
  ...surfaceStyle,
  background:
    'radial-gradient(circle at top left, color-mix(in srgb, rgb(var(--primary-6)) 12%, var(--bg-1) 88%), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--bg-1) 96%, var(--fill-2) 4%), var(--bg-1))',
};

const SpacePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { spaceId = '' } = useParams<{ spaceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [space, setSpace] = useState<TSpace | null>(null);
  const [contextState, setContextState] = useState<SpaceContextState>({ memories: [], profiles: [] });
  const [conversations, setConversations] = useState<TChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const activeView = useMemo<SpaceShellView>(() => resolveSpaceShellView(searchParams.get('view')), [searchParams]);

  useEffect(() => {
    if (!spaceId) {
      setSpace(null);
      setContextState({ memories: [], profiles: [] });
      setConversations([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void Promise.all([
      ipcBridge.space.get.invoke({ id: spaceId }),
      ipcBridge.space.getContext.invoke({ spaceId }),
      ipcBridge.database.getUserConversations.invoke({ page: 0, pageSize: 10000 }),
    ])
      .then(([nextSpace, nextContext, nextConversations]) => {
        if (cancelled) {
          return;
        }

        setSpace(nextSpace ?? null);
        setContextState(nextContext);
        setConversations(nextConversations);
      })
      .catch((error) => {
        console.error('[SpacePage] Failed to load space shell:', error);
        if (!cancelled) {
          setSpace(null);
          setContextState({ memories: [], profiles: [] });
          setConversations([]);
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

  const spaceConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) => conversation.extra?.spaceId === spaceId && conversation.extra?.archived !== true
      ),
    [conversations, spaceId]
  );

  const projectGroups = useMemo(() => buildSpaceProjectGroups({ spaceId, conversations }), [conversations, spaceId]);

  const runningSessions = useMemo(
    () =>
      [...spaceConversations]
        .filter((conversation) => conversation.status === 'running')
        .sort((left, right) => (right.modifyTime || 0) - (left.modifyTime || 0)),
    [spaceConversations]
  );

  const projectTitleByConversationId = useMemo(() => {
    const titleMap = new Map<string, string>();
    projectGroups.forEach((group) => {
      group.sessions.forEach((session) => {
        titleMap.set(session.id, group.title);
      });
    });
    return titleMap;
  }, [projectGroups]);

  const stats = useMemo(
    () => [
      { key: 'projects', label: t('space.overview.projects'), value: String(projectGroups.length) },
      { key: 'sessions', label: t('space.overview.sessions'), value: String(spaceConversations.length) },
      { key: 'running', label: t('space.overview.running'), value: String(runningSessions.length) },
      { key: 'memory', label: t('space.shell.memory'), value: String(contextState.memories.length) },
    ],
    [contextState.memories.length, projectGroups.length, runningSessions.length, spaceConversations.length, t]
  );

  const canvasLabels = useMemo<SpaceAffineCanvasLabels>(
    () => ({
      backendLabel: (backend) => t(`space.canvas.backends.${backend}` as const),
      memorySummary: (count) => t('space.canvas.memorySummary', { count }),
      memoryTitle: t('space.canvas.memory'),
      profileSummary: (count) => t('space.canvas.profileSummary', { count }),
      profileTitle: t('space.canvas.profile'),
      projectSummary: (sessionCount, runningCount) =>
        t(runningCount > 0 ? 'space.canvas.projectSummaryRunning' : 'space.canvas.projectSummary', {
          runningCount,
          sessionCount,
        }),
      sessionSummary: (backendLabel, statusLabel) => `${backendLabel} · ${statusLabel}`,
      statusLabels: {
        ready: t('space.canvas.status.ready'),
        running: t('space.canvas.status.running'),
      },
    }),
    [t]
  );

  const projection = useMemo(
    () =>
      projectSpaceToEdgeless({
        spaceId,
        conversations,
        memories: contextState.memories,
        profiles: contextState.profiles,
        labels: canvasLabels,
      }),
    [canvasLabels, contextState.memories, contextState.profiles, conversations, spaceId]
  );

  const openView = (view: SpaceShellView) => {
    setSearchParams({ view });
  };

  const openConversation = (conversationId: string) => {
    void navigate(`/conversation/${conversationId}`);
  };

  const renderOverview = () => {
    if (!space) {
      return null;
    }

    return (
      <div className='flex flex-col gap-16px'>
        <div className='rounded-20px p-24px' style={heroStyle}>
          <div className='flex flex-col gap-12px lg:flex-row lg:items-start lg:justify-between'>
            <div className='max-w-760px'>
              <div className='text-12px font-700 uppercase tracking-[0.08em] text-t-secondary'>
                {t('space.overview.title')}
              </div>
              <h1 className='m-0 mt-8px text-28px font-700 text-t-primary'>{space.name}</h1>
              <p className='m-0 mt-10px text-14px leading-24px text-t-secondary'>
                {space.description || t('space.shell.description')}
              </p>
            </div>
            <div className='flex flex-wrap gap-10px'>
              <Button type='primary' onClick={() => openView('canvas')}>
                {t('space.overview.openCanvas')}
              </Button>
              <Button type='outline' onClick={() => openView('context')}>
                {t('space.overview.openContext')}
              </Button>
              <Button type='outline' onClick={() => void navigate('/guid')}>
                {t('common.returnToWorkbench')}
              </Button>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-12px md:grid-cols-2 xl:grid-cols-4'>
          {stats.map((item) => (
            <div key={item.key} className='rounded-16px p-16px' style={mutedSurfaceStyle}>
              <div className='text-12px font-600 uppercase tracking-[0.08em] text-t-secondary'>{item.label}</div>
              <div className='mt-10px text-24px font-700 text-t-primary'>{item.value}</div>
            </div>
          ))}
        </div>

        <div className='grid grid-cols-1 gap-16px xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]'>
          <div className='rounded-16px p-20px' style={surfaceStyle}>
            <div className='mb-14px flex items-start justify-between gap-12px'>
              <div>
                <div className='text-18px font-600 text-t-primary'>{t('space.overview.projectsTitle')}</div>
                <div className='mt-6px text-14px leading-22px text-t-secondary'>
                  {t('space.overview.projectsDescription')}
                </div>
              </div>
              <Tag color='arcoblue'>{t('space.overview.projectCount', { count: projectGroups.length })}</Tag>
            </div>
            <div className='grid grid-cols-1 gap-12px md:grid-cols-2'>
              {projectGroups.length === 0 ? (
                <div className='rounded-14px p-16px text-14px text-t-secondary' style={mutedSurfaceStyle}>
                  {t('space.overview.projectsEmpty')}
                </div>
              ) : (
                projectGroups.slice(0, 6).map((project) => {
                  const latestSession = project.sessions[0];
                  return (
                    <div key={project.projectKey} className='rounded-14px p-16px' style={mutedSurfaceStyle}>
                      <div className='flex items-start justify-between gap-10px'>
                        <div className='min-w-0'>
                          <div className='truncate text-16px font-600 text-t-primary'>{project.title}</div>
                          <div className='mt-6px text-13px leading-20px text-t-secondary'>
                            {t(
                              project.runningCount > 0
                                ? 'space.canvas.projectSummaryRunning'
                                : 'space.canvas.projectSummary',
                              {
                                sessionCount: project.sessions.length,
                                runningCount: project.runningCount,
                              }
                            )}
                          </div>
                        </div>
                        {project.runningCount > 0 ? <Tag color='green'>{t('space.canvas.status.running')}</Tag> : null}
                      </div>
                      {project.workingDirectory ? (
                        <div className='mt-10px truncate text-12px text-t-secondary'>{project.workingDirectory}</div>
                      ) : null}
                      {latestSession ? (
                        <Button className='mt-14px !px-0' type='text' onClick={() => openConversation(latestSession.id)}>
                          {t('space.overview.openSession')}
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className='flex flex-col gap-16px'>
            <div className='rounded-16px p-20px' style={surfaceStyle}>
              <div className='mb-14px flex items-start justify-between gap-12px'>
                <div>
                  <div className='text-18px font-600 text-t-primary'>{t('space.overview.runningTitle')}</div>
                  <div className='mt-6px text-14px leading-22px text-t-secondary'>
                    {t('space.overview.runningDescription')}
                  </div>
                </div>
                <Tag color='orange'>{t('space.overview.runningCount', { count: runningSessions.length })}</Tag>
              </div>
              <div className='flex flex-col gap-10px'>
                {runningSessions.length === 0 ? (
                  <div className='rounded-14px p-16px text-14px text-t-secondary' style={mutedSurfaceStyle}>
                    {t('space.overview.runningEmpty')}
                  </div>
                ) : (
                  runningSessions.slice(0, 5).map((conversation) => (
                    <div key={conversation.id} className='rounded-14px p-14px' style={mutedSurfaceStyle}>
                      <div className='flex items-start justify-between gap-12px'>
                        <div className='min-w-0'>
                          <div className='truncate text-15px font-600 text-t-primary'>
                            {conversation.name || conversation.id}
                          </div>
                          <div className='mt-6px text-13px leading-20px text-t-secondary'>
                            {projectTitleByConversationId.get(conversation.id) || t('space.canvas.project')}
                          </div>
                        </div>
                        <div className='flex gap-8px'>
                          <Tag color='arcoblue'>{t(`space.canvas.backends.${conversation.type}`)}</Tag>
                          <Tag color='green'>{t('space.canvas.status.running')}</Tag>
                        </div>
                      </div>
                      <Button className='mt-12px !px-0' type='text' onClick={() => openConversation(conversation.id)}>
                        {t('space.overview.openSession')}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className='rounded-16px p-20px' style={surfaceStyle}>
              <div className='mb-14px flex items-start justify-between gap-12px'>
                <div>
                  <div className='text-18px font-600 text-t-primary'>{t('space.overview.contextTitle')}</div>
                  <div className='mt-6px text-14px leading-22px text-t-secondary'>
                    {t('space.overview.contextDescription')}
                  </div>
                </div>
                <Button type='outline' onClick={() => openView('context')}>
                  {t('space.overview.openContext')}
                </Button>
              </div>
              <div className='grid grid-cols-1 gap-12px md:grid-cols-2'>
                <div className='rounded-14px p-16px' style={mutedSurfaceStyle}>
                  <div className='text-12px font-600 uppercase tracking-[0.08em] text-t-secondary'>
                    {t('space.shell.memory')}
                  </div>
                  <div className='mt-8px text-14px leading-22px text-t-primary'>
                    {contextState.memories[0]?.summary || t('space.context.memoryEmpty')}
                  </div>
                </div>
                <div className='rounded-14px p-16px' style={mutedSurfaceStyle}>
                  <div className='text-12px font-600 uppercase tracking-[0.08em] text-t-secondary'>
                    {t('space.shell.profiles')}
                  </div>
                  <div className='mt-8px text-14px leading-22px text-t-primary'>
                    {contextState.profiles[0]?.summary || t('space.context.profileEmpty')}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
            <div className='text-14px text-t-secondary'>{t('space.context.memoryEmpty')}</div>
          ) : (
            contextState.memories.map((memory) => (
              <div key={memory.id} className='rounded-12px p-12px' style={mutedSurfaceStyle}>
                <div className='text-14px font-600 text-t-primary'>{memory.summary}</div>
                {memory.detail ? (
                  <div className='mt-6px text-13px leading-20px text-t-secondary'>{memory.detail}</div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
      <div className='rounded-16px p-20px' style={surfaceStyle}>
        <div className='mb-12px text-16px font-600 text-t-primary'>{t('space.shell.profiles')}</div>
        <div className='flex flex-col gap-10px'>
          {contextState.profiles.length === 0 ? (
            <div className='text-14px text-t-secondary'>{t('space.context.profileEmpty')}</div>
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

  const renderCanvas = () => {
    return (
      <AffineCanvasSurface
        projection={projection}
        onOpenSession={openConversation}
        projectCount={projectGroups.length}
        runningCount={runningSessions.length}
        sessionCount={spaceConversations.length}
      />
    );
  };

  const renderPreparedView = () => (
    <div className='rounded-16px p-20px' style={surfaceStyle}>
      <div className='text-18px font-600 text-t-primary'>
        {t(`space.views.${activeView}` as const, {
          defaultValue: t(`space.views.${DEFAULT_SPACE_SHELL_VIEW}` as const),
        })}
      </div>
      <div className='mt-10px text-14px leading-22px text-t-secondary'>{t('space.shell.comingSoon')}</div>
      <div className='mt-10px text-14px leading-22px text-t-secondary'>{t('space.shell.preparedDescription')}</div>
      <div className='mt-16px flex flex-wrap gap-10px'>
        <Button type='primary' onClick={() => openView('overview')}>
          {t('space.views.overview')}
        </Button>
        <Button type='outline' onClick={() => openView('canvas')}>
          {t('space.views.canvas')}
        </Button>
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

    if (activeView === 'canvas') {
      return renderCanvas();
    }

    return renderPreparedView();
  };

  return (
    <div className='secondary-page-frame'>
      <div className='secondary-page-inner'>{renderMain()}</div>
    </div>
  );
};

export default SpacePage;
