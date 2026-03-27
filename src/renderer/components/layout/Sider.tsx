import { ipcBridge } from '@/common';
import { changeLanguage } from '@/renderer/services/i18n';
import { Brain, Down, Earth, Lightning, Plus, Robot, SettingTwo } from '@icon-park/react';
import { Dropdown, Menu } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { iconColors } from '@renderer/styles/colors';
import { usePreviewContext } from '@renderer/pages/conversation/Preview/context/PreviewContext';
import { cleanupSiderTooltips } from '@renderer/utils/ui/siderTooltip';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { blurActiveElement } from '@renderer/utils/ui/focus';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import ConversationSearchPopover from '@renderer/pages/conversation/GroupedHistory/ConversationSearchPopover';
import { useConversationAgents } from '@renderer/pages/conversation/hooks/useConversationAgents';
import { useConversationTabs } from '@renderer/pages/conversation/hooks/ConversationTabsContext';
import CreateDiscussionGroupModal from '@renderer/pages/conversation/platforms/group/CreateDiscussionGroupModal';
import { emitter } from '@renderer/utils/emitter';

const WorkspaceGroupedHistory = React.lazy(() => import('@renderer/pages/conversation/GroupedHistory'));
const SettingsSider = React.lazy(() => import('@renderer/pages/settings/components/SettingsSider'));

interface SiderProps {
  onSessionClick?: () => void;
  collapsed?: boolean;
}

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'tr-TR', label: 'Türkçe' },
  { value: 'en-US', label: 'English' },
] as const;

const Sider: React.FC<SiderProps> = ({ onSessionClick, collapsed = false }) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const location = useLocation();
  const { pathname } = location;

  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { closePreview } = usePreviewContext();
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [desktopUsername, setDesktopUsername] = useState('');
  const [userPanelVisible, setUserPanelVisible] = useState(false);
  const isSettings = pathname.startsWith('/settings');
  const { cliAgents, presetAssistants } = useConversationAgents();
  const { activeTab, openTab } = useConversationTabs();
  const { user } = useAuth();
  const userCardRef = useRef<HTMLDivElement | null>(null);

  const handleNavigate = (target: string) => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate(target)).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleConversationSelect = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
  };
  const handleCreateConversation = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/guid')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };
  const handleCreateDiscussionGroup = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    setGroupModalVisible(true);
  };

  const handleToggleUserPanel = () => {
    setUserPanelVisible((visible) => !visible);
  };

  const handleOpenSettings = () => {
    setUserPanelVisible(false);
    handleNavigate('/settings/system');
  };

  const handleChangeLanguage = (language: (typeof LANGUAGE_OPTIONS)[number]['value']) => {
    changeLanguage(language).catch((error: Error) => {
      console.error('Failed to change language:', error);
    });
    setUserPanelVisible(false);
  };

  useEffect(() => {
    if (user?.username) {
      setDesktopUsername(user.username);
      return;
    }
    if (typeof window === 'undefined' || !window.electronAPI) {
      setDesktopUsername('');
      return;
    }

    let cancelled = false;
    ipcBridge.application.getPath
      .invoke({ name: 'home' })
      .then((homePath) => {
        if (cancelled) {
          return;
        }
        setDesktopUsername(homePath.split(/[\\/]/).filter(Boolean).pop() || '');
      })
      .catch(() => {
        if (!cancelled) {
          setDesktopUsername('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.username]);

  useEffect(() => {
    if (!userPanelVisible) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!userCardRef.current) {
        return;
      }

      if (event.target instanceof Node && userCardRef.current.contains(event.target)) {
        return;
      }

      setUserPanelVisible(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserPanelVisible(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleEscape, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [userPanelVisible]);

  useEffect(() => {
    setUserPanelVisible(false);
  }, [pathname]);

  const workspaceHistoryProps = {
    collapsed,
    tooltipEnabled: collapsed && !isMobile,
    onSessionClick,
    batchMode: isBatchMode,
    onBatchModeChange: setIsBatchMode,
  };
  const tooltipEnabled = collapsed && !isMobile;
  const activeWorkspace = activeTab?.workspace || '';
  const actionRowClassName = classNames(
    'sider-entry-row flex w-full min-w-0 items-center gap-10px rounded-10px px-12px py-9px text-left transition-colors',
    isMobile && 'sider-action-btn-mobile'
  );
  const actionRowActiveClassName = 'sider-entry-row--active';
  const userDisplayName = desktopUsername || user?.username || t('common.localUser');
  const userInitial = userDisplayName.trim().charAt(0).toUpperCase() || 'U';
  const currentLanguageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === i18n.language)?.label ||
    LANGUAGE_OPTIONS.find((option) => option.value === 'en-US')?.label ||
    'English';
  const createEntryMenu = (
    <Menu
      onClickMenuItem={(key) => {
        if (key === 'conversation') {
          handleCreateConversation();
          return;
        }

        if (key === 'group') {
          handleCreateDiscussionGroup();
        }
      }}
    >
      <Menu.Item key='conversation'>
        <div className='flex items-center gap-8px'>
          <Plus theme='outline' size='16' fill={iconColors.primary} />
          <span>{t('conversation.welcome.newConversation')}</span>
        </div>
      </Menu.Item>
      <Menu.Item key='group'>
        <div className='flex items-center gap-8px'>
          <Robot theme='outline' size='16' fill={iconColors.primary} />
          <span>{t('conversation.group.createEntry')}</span>
        </div>
      </Menu.Item>
    </Menu>
  );

  return (
    <div className='size-full w-full min-w-0 flex flex-col'>
      {/* Main content area */}
      <div className='flex-1 min-h-0 w-full min-w-0 overflow-hidden'>
        {isSettings ? (
          <Suspense fallback={<div className='size-full' />}>
            <SettingsSider collapsed={collapsed} tooltipEnabled={tooltipEnabled}></SettingsSider>
          </Suspense>
        ) : (
          <div className='size-full w-full min-w-0 flex flex-col'>
            <div className='mb-10px flex shrink-0 w-full min-w-0 flex-col gap-6px'>
              <Dropdown droplist={createEntryMenu} trigger='click' position='bl'>
                <button type='button' className={actionRowClassName}>
                  <Plus theme='outline' size='20' fill={iconColors.primary} className='block shrink-0 leading-none' />
                  <span className='min-w-0 flex-1 truncate text-14px font-600 text-t-primary'>
                    {t('conversation.entry.create')}
                  </span>
                  <Down theme='outline' size='14' fill={iconColors.secondary} className='block shrink-0 leading-none' />
                </button>
              </Dropdown>
              <ConversationSearchPopover
                onSessionClick={onSessionClick}
                onConversationSelect={handleConversationSelect}
                buttonLabel={t('conversation.historySearch.tooltip')}
                buttonClassName={classNames(actionRowClassName, '!justify-start !border-none')}
              />
              <button
                type='button'
                className={classNames(actionRowClassName, pathname === '/skills-hub' && actionRowActiveClassName)}
                onClick={() => handleNavigate('/skills-hub')}
              >
                <Lightning
                  theme='outline'
                  size='20'
                  fill={iconColors.primary}
                  className='block shrink-0 leading-none'
                />
                <span className='min-w-0 truncate text-14px font-600 text-t-primary'>
                  {t('settings.skillsHub.title')}
                </span>
              </button>
              <button
                type='button'
                className={classNames(actionRowClassName, pathname === '/agents' && actionRowActiveClassName)}
                onClick={() => handleNavigate('/agents')}
              >
                <Brain theme='outline' size='20' fill={iconColors.primary} className='block shrink-0 leading-none' />
                <span className='min-w-0 truncate text-14px font-600 text-t-primary'>{t('settings.assistants')}</span>
              </button>
            </div>
            <Suspense fallback={<div className='flex-1 min-h-0' />}>
              <WorkspaceGroupedHistory {...workspaceHistoryProps}></WorkspaceGroupedHistory>
            </Suspense>
            <CreateDiscussionGroupModal
              visible={groupModalVisible}
              workspace={activeWorkspace}
              cliAgents={cliAgents}
              presetAssistants={presetAssistants}
              onCancel={() => setGroupModalVisible(false)}
              onCreated={(conversation) => {
                setGroupModalVisible(false);
                openTab(conversation);
                void navigate(`/conversation/${conversation.id}`);
                emitter.emit('chat.history.refresh');
                if (onSessionClick) {
                  onSessionClick();
                }
              }}
            />
          </div>
        )}
      </div>
      <div className='sider-footer mt-auto shrink-0 pt-10px'>
        <div ref={userCardRef} className='sider-user-card-wrap'>
          {userPanelVisible ? (
            <div className='sider-user-panel'>
              <button type='button' className='sider-user-panel__action' onClick={handleOpenSettings}>
                <SettingTwo theme='outline' size='16' fill={iconColors.primary} className='shrink-0' />
                <span className='min-w-0 flex-1 truncate'>{t('common.settings')}</span>
              </button>
              <div className='sider-user-panel__section'>
                <div className='sider-user-panel__section-title'>
                  <Earth theme='outline' size='15' fill={iconColors.primary} className='shrink-0' />
                  <span>{t('settings.language')}</span>
                </div>
                <div className='sider-user-panel__language-list'>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type='button'
                      className={classNames('sider-user-panel__language-option', {
                        'sider-user-panel__language-option--active': option.value === i18n.language,
                      })}
                      onClick={() => handleChangeLanguage(option.value)}
                    >
                      <span className='min-w-0 flex-1 truncate'>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <button
            type='button'
            className={classNames(
              'sider-user-trigger',
              userPanelVisible && 'sider-user-trigger--active',
              isMobile && 'sider-footer-btn-mobile'
            )}
            onClick={handleToggleUserPanel}
            aria-expanded={userPanelVisible}
          >
            <span className='sider-user-trigger__avatar'>{userInitial}</span>
            <span className='min-w-0 flex-1 text-left'>
              <span className='block truncate text-14px font-600 text-t-primary'>{userDisplayName}</span>
              <span className='block truncate text-12px text-t-secondary'>{currentLanguageLabel}</span>
            </span>
            <Down
              theme='outline'
              size='16'
              fill={iconColors.secondary}
              className={classNames(
                'sider-user-trigger__chevron',
                userPanelVisible && 'sider-user-trigger__chevron--open'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sider;
