/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { usePresetAssistantInfo } from '@/renderer/hooks/agent/usePresetAssistantInfo';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { useSelectedSpaceId } from '@/renderer/hooks/context/useSelectedSpace';
import { CUSTOM_AVATAR_IMAGE_MAP } from '@/renderer/pages/guid/constants';
import { getAgentLogo } from '@/renderer/utils/model/agentLogo';
import { emitter } from '@/renderer/utils/emitter';
import { cleanupSiderTooltips } from '@/renderer/utils/ui/siderTooltip';
import { isMobileShellWebView } from '@/renderer/utils/platform';
import { updateWorkspaceTime } from '@/renderer/utils/workspace/workspaceHistory';
import { Dropdown, Menu, Message } from '@arco-design/web-react';
import { Close, MessageOne, Plus, Robot } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConversationTabs } from '../hooks/ConversationTabsContext';
import type { ConversationTab } from '../hooks/ConversationTabsContext';
import { useConversationAgents } from '../hooks/useConversationAgents';
import { applyDefaultConversationName } from '../utils/newConversationName';
import { buildCliAgentParams, buildPresetAssistantParams } from '../utils/createConversationParams';
import { iconColors } from '@/renderer/styles/colors';
import CreateGroupModal from '../platforms/group/CreateGroupModal';

const TAB_OVERFLOW_THRESHOLD = 10;
const ICON_ONLY_TAB_THRESHOLD = 10;
const COMPACT_TAB_THRESHOLD = 6;
const DESKTOP_TAB_GAP = 4;
const TAB_ACTIONS_RESERVED_WIDTH = 52;
const ICON_ONLY_TAB_MIN_WIDTH = 28;
const ICON_ONLY_TAB_MAX_WIDTH = 36;
const COMPACT_TAB_MIN_WIDTH = 68;
const COMPACT_TAB_MAX_WIDTH = 100;
const FULL_TAB_MIN_WIDTH = 108;
const FULL_TAB_MAX_WIDTH = 184;
const CONVERSATION_TAB_STRIP_BG = 'var(--app-conversation-strip-bg, var(--bg-1))';

interface TabFadeState {
  left: boolean;
  right: boolean;
}

export type ConversationTabDensity = 'full' | 'compact' | 'icon';

type TabDensityOptions = {
  isMobile: boolean;
  isMobileShell: boolean;
  openTabsCount: number;
  containerWidth: number;
  showHeaderActions: boolean;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const resolveConversationTabAvailableWidth = ({
  openTabsCount,
  containerWidth,
  showHeaderActions,
}: Omit<TabDensityOptions, 'isMobile' | 'isMobileShell'>) => {
  const reservedWidth = showHeaderActions ? TAB_ACTIONS_RESERVED_WIDTH : 0;
  const totalGapWidth = Math.max(openTabsCount - 1, 0) * DESKTOP_TAB_GAP;
  return Math.max(containerWidth - reservedWidth - totalGapWidth, 0);
};

export const resolveConversationTabDensity = ({
  isMobile,
  isMobileShell,
  openTabsCount,
  containerWidth,
  showHeaderActions,
}: TabDensityOptions): ConversationTabDensity => {
  if (isMobileShell) {
    if (containerWidth > 0) {
      const availableWidth = resolveConversationTabAvailableWidth({
        openTabsCount,
        containerWidth,
        showHeaderActions,
      });
      const widthPerTab = availableWidth / Math.max(openTabsCount, 1);

      if (widthPerTab <= 44) {
        return 'icon';
      }
    }

    return 'compact';
  }

  if (isMobile || openTabsCount <= 1) {
    return 'full';
  }

  if (containerWidth > 0) {
    const availableWidth = resolveConversationTabAvailableWidth({
      openTabsCount,
      containerWidth,
      showHeaderActions,
    });
    const widthPerTab = availableWidth / Math.max(openTabsCount, 1);

    if (widthPerTab <= 44) {
      return 'icon';
    }

    if (widthPerTab <= 100) {
      return 'compact';
    }

    return 'full';
  }

  if (openTabsCount >= ICON_ONLY_TAB_THRESHOLD) {
    return 'icon';
  }

  if (openTabsCount >= COMPACT_TAB_THRESHOLD) {
    return 'compact';
  }

  return 'full';
};

export const resolveConversationTabWidth = ({
  density,
  containerWidth,
  openTabsCount,
  showHeaderActions,
}: Omit<TabDensityOptions, 'isMobile' | 'isMobileShell'> & { density: ConversationTabDensity }): number | undefined => {
  if (containerWidth <= 0) {
    if (density === 'icon') {
      return ICON_ONLY_TAB_MAX_WIDTH;
    }

    return density === 'compact' ? 88 : 164;
  }

  const availableWidth = resolveConversationTabAvailableWidth({
    openTabsCount,
    containerWidth,
    showHeaderActions,
  });
  const widthPerTab = availableWidth / Math.max(openTabsCount, 1);

  if (density === 'icon') {
    return Math.floor(clamp(widthPerTab, ICON_ONLY_TAB_MIN_WIDTH, ICON_ONLY_TAB_MAX_WIDTH));
  }

  if (density === 'compact') {
    return Math.floor(clamp(widthPerTab, COMPACT_TAB_MIN_WIDTH, COMPACT_TAB_MAX_WIDTH));
  }

  return Math.floor(clamp(widthPerTab, FULL_TAB_MIN_WIDTH, FULL_TAB_MAX_WIDTH));
};

interface ConversationTabViewProps {
  tab: ConversationTab;
  isActive: boolean;
  isMobile: boolean;
  density: ConversationTabDensity;
  width?: number;
  contextMenu: React.ReactNode;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

const getConversationTabBackend = (tab: ConversationTab): string | undefined => {
  if (tab.type === 'acp') {
    const extra = tab.extra as { backend?: string } | undefined;
    return extra?.backend;
  }

  if (tab.type === 'codex' || tab.type === 'gemini') {
    return tab.type;
  }

  return undefined;
};

const ConversationTabIcon: React.FC<{ tab: ConversationTab }> = ({ tab }) => {
  const conversationForIcon = useMemo(
    () =>
      ({
        id: tab.id,
        name: tab.name,
        type: tab.type,
        extra: tab.extra ?? {},
      }) as TChatConversation,
    [tab.extra, tab.id, tab.name, tab.type]
  );
  const { info: presetAssistantInfo } = usePresetAssistantInfo(conversationForIcon);

  if (presetAssistantInfo) {
    if (presetAssistantInfo.isEmoji) {
      return (
        <span className='inline-flex h-16px w-16px items-center justify-center text-15px leading-none shrink-0'>
          {presetAssistantInfo.logo}
        </span>
      );
    }

    return (
      <span className='inline-flex h-16px w-16px items-center justify-center shrink-0 leading-none'>
        <img
          src={presetAssistantInfo.logo}
          alt={presetAssistantInfo.name}
          className='block h-16px w-16px shrink-0 rounded-50% object-contain'
        />
      </span>
    );
  }

  const backend = getConversationTabBackend(tab);
  const logo = backend ? getAgentLogo(backend) : undefined;
  if (logo) {
    return (
      <span className='inline-flex h-16px w-16px items-center justify-center shrink-0 leading-none'>
        <img
          src={logo}
          alt={`${backend || 'agent'} logo`}
          className='block h-16px w-16px shrink-0 rounded-50% object-contain'
        />
      </span>
    );
  }

  return (
    <span className='inline-flex h-16px w-16px items-center justify-center shrink-0 leading-none'>
      <MessageOne theme='outline' size='16' className='shrink-0 text-[var(--color-text-3)]' />
    </span>
  );
};

const ConversationTabView: React.FC<ConversationTabViewProps> = ({
  tab,
  isActive,
  isMobile,
  density,
  width,
  contextMenu,
  onSwitch,
  onClose,
}) => {
  const isIconOnly = density === 'icon';
  const isCompact = density === 'compact';
  const showLeadingCloseButton = isIconOnly && isActive;
  const showTrailingCloseButton = !isIconOnly && (density === 'full' || isActive);
  const tabClassName = `conversation-tab flex items-center h-34px min-w-0 cursor-pointer transition-[background-color,border-color,color,box-shadow] duration-180 shrink-0 rounded-12px border border-solid ${
    isActive
      ? 'bg-[color:color-mix(in_srgb,var(--bg-1)_96%,white_4%)] text-[color:var(--color-text-1)] border-[color:color-mix(in_srgb,var(--border-base)_86%,transparent)] shadow-[0_10px_24px_rgba(15,23,42,0.08)]'
      : 'bg-transparent text-[color:var(--color-text-3)] border-transparent hover:text-[color:var(--color-text-2)] hover:border-[color:color-mix(in_srgb,var(--border-base)_58%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--bg-1)_82%,white_18%)]'
  } ${isIconOnly ? 'justify-center px-0' : isCompact ? 'gap-6px px-7px' : 'gap-7px px-8px'}`;

  const tabStyle: React.CSSProperties | undefined = width
    ? {
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
      }
    : undefined;

  const tabNode = (
    <Dropdown droplist={contextMenu} trigger='contextMenu' position='bl'>
      <div
        className={tabClassName}
        style={tabStyle}
        onClick={() => onSwitch(tab.id)}
        data-density={density}
        aria-label={tab.name}
        title={tab.workspace ? `${tab.name}\n${tab.workspace}\n${tab.id}` : `${tab.name}\n${tab.id}`}
      >
        {showLeadingCloseButton ? (
          <span
            className='group flex h-18px w-18px shrink-0 items-center justify-center self-center rounded-full text-[var(--color-text-2)] transition-[background-color,color,transform] duration-180 hover:bg-[color:color-mix(in_srgb,var(--fill-2)_82%,var(--bg-1)_18%)] hover:text-[rgb(var(--danger-6))] active:scale-95'
            onClick={(event) => {
              event.stopPropagation();
              onClose(tab.id);
            }}
          >
            <Close
              theme='outline'
              size='12'
              fill='currentColor'
              className='block shrink-0 self-center leading-none transition-colors duration-180'
            />
          </span>
        ) : (
          <ConversationTabIcon tab={tab} />
        )}
        {!isIconOnly && (
          <span
            className={`min-w-0 flex-1 select-none overflow-hidden text-ellipsis whitespace-nowrap ${isCompact ? 'text-13px leading-18px' : 'text-14px leading-20px'}`}
          >
            {tab.name}
          </span>
        )}
        {showTrailingCloseButton && (
          <span
            className='group flex h-16px w-16px shrink-0 items-center justify-center self-center rounded-full text-[var(--color-text-3)] transition-[background-color,color,transform] duration-180 hover:bg-[color:color-mix(in_srgb,var(--fill-2)_82%,var(--bg-1)_18%)] hover:text-[rgb(var(--danger-6))] active:scale-95'
            onClick={(event) => {
              event.stopPropagation();
              onClose(tab.id);
            }}
          >
            <Close
              theme='outline'
              size='12'
              fill='currentColor'
              className='block shrink-0 self-center leading-none transition-colors duration-180'
            />
          </span>
        )}
      </div>
    </Dropdown>
  );

  if (isMobile) {
    return tabNode;
  }

  return tabNode;
};

interface CreateConversationTriggerProps {
  disabled: boolean;
  title: string;
  menu: React.ReactNode;
  compact?: boolean;
}

const CreateConversationTrigger: React.FC<CreateConversationTriggerProps> = ({
  disabled,
  title,
  menu,
  compact = false,
}) => (
  <Dropdown droplist={menu} trigger='click' position='bl' disabled={disabled}>
    <div
      className={`flex items-center justify-center shrink-0 border border-solid border-transparent transition-colors duration-200 ${
        compact ? 'w-32px h-32px rounded-9px' : 'w-34px h-34px rounded-10px'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-[var(--border-base)] hover:bg-[var(--fill-2)]'}`}
      title={title}
    >
      <Plus theme='outline' size='16' fill={iconColors.primary} strokeWidth={3} />
    </div>
  </Dropdown>
);

interface ConversationHeaderActionsProps {
  compact?: boolean;
}

export const ConversationHeaderActions: React.FC<ConversationHeaderActionsProps> = ({ compact = false }) => {
  const { openTabs, activeTabId, openTab } = useConversationTabs();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { cliAgents, presetAssistants, isLoading } = useConversationAgents();
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const selectedSpaceId = useSelectedSpaceId();
  const defaultConversationName = t('conversation.welcome.newConversation');
  const currentWorkspaceTab = openTabs.find((tab) => tab.id === activeTabId);

  const handleCreateConversation = useCallback(
    async (key: string) => {
      const currentTab = openTabs.find((tab) => tab.id === activeTabId);
      if (!currentTab?.workspace) {
        void navigate('/guid');
        return;
      }

      const workspace = currentTab.workspace;

      try {
        let params;

        if (key.startsWith('cli:')) {
          const backend = key.slice(4);
          const agent = cliAgents.find((a) => a.backend === backend);
          if (!agent) {
            Message.error(t('conversation.createFailed'));
            return;
          }
          params = await buildCliAgentParams(agent, workspace, selectedSpaceId ?? undefined);
        } else if (key.startsWith('preset:')) {
          const assistantId = key.slice(7);
          const agent = presetAssistants.find((a) => a.customAgentId === assistantId);
          if (!agent) {
            Message.error(t('conversation.createFailed'));
            return;
          }
          params = await buildPresetAssistantParams(agent, workspace, i18n.language, selectedSpaceId ?? undefined);
        } else {
          return;
        }

        const newConversation = await ipcBridge.conversation.create.invoke(
          applyDefaultConversationName(params, defaultConversationName)
        );

        updateWorkspaceTime(workspace);
        openTab(newConversation);
        void navigate(`/conversation/${newConversation.id}`);
        emitter.emit('chat.history.refresh');
      } catch (error) {
        console.error('Failed to create conversation:', error);
        Message.error(t('conversation.createFailed'));
      }
    },
    [
      activeTabId,
      cliAgents,
      defaultConversationName,
      i18n.language,
      navigate,
      openTab,
      openTabs,
      presetAssistants,
      selectedSpaceId,
      t,
    ]
  );

  const handleOpenGroupModal = useCallback(() => {
    setGroupModalVisible(true);
  }, []);

  const renderCreateMenu = useCallback(
    () => (
      <Menu
        onClickMenuItem={(key) => {
          if (key === 'group') {
            handleOpenGroupModal();
            return;
          }

          void handleCreateConversation(key);
        }}
      >
        <Menu.SubMenu
          key='conversation'
          title={
            <div className='flex items-center gap-8px'>
              <Plus theme='outline' size='16' fill={iconColors.primary} />
              <span>{t('conversation.entry.conversation')}</span>
            </div>
          }
        >
          {cliAgents.length > 0 && (
            <Menu.ItemGroup title={t('conversation.dropdown.cliAgents')}>
              {cliAgents.map((agent) => {
                const logo = getAgentLogo(agent.backend);
                return (
                  <Menu.Item key={`cli:${agent.backend}`}>
                    <div className='flex items-center gap-8px'>
                      {logo ? (
                        <img src={logo} alt={agent.name} style={{ width: 16, height: 16, objectFit: 'contain' }} />
                      ) : (
                        <Robot size='16' />
                      )}
                      <span>{agent.name}</span>
                    </div>
                  </Menu.Item>
                );
              })}
            </Menu.ItemGroup>
          )}
          {presetAssistants.length > 0 && (
            <Menu.ItemGroup title={t('conversation.dropdown.presetAssistants')}>
              {presetAssistants.map((agent) => {
                const avatarImage = agent.avatar ? CUSTOM_AVATAR_IMAGE_MAP[agent.avatar] : undefined;
                const isEmoji = agent.avatar && !avatarImage && !agent.avatar.endsWith('.svg');
                return (
                  <Menu.Item key={`preset:${agent.customAgentId}`}>
                    <div className='flex items-center gap-8px'>
                      {avatarImage ? (
                        <img
                          src={avatarImage}
                          alt={agent.name}
                          style={{ width: 16, height: 16, objectFit: 'contain' }}
                        />
                      ) : isEmoji ? (
                        <span style={{ fontSize: 14, lineHeight: '16px' }}>{agent.avatar}</span>
                      ) : (
                        <Robot size='16' />
                      )}
                      <span>{agent.name}</span>
                    </div>
                  </Menu.Item>
                );
              })}
            </Menu.ItemGroup>
          )}
        </Menu.SubMenu>
        <Menu.Item key='group'>
          <div className='flex items-center gap-8px'>
            <Robot size='16' fill={iconColors.primary} />
            <span>{t('conversation.entry.group')}</span>
          </div>
        </Menu.Item>
      </Menu>
    ),
    [cliAgents, handleCreateConversation, handleOpenGroupModal, presetAssistants, t]
  );

  const isDropdownDisabled = isLoading || !currentWorkspaceTab?.workspace;
  const actionShellClassName = compact
    ? 'flex shrink-0 items-center gap-6px rounded-12px border border-solid border-[color:color-mix(in_srgb,var(--border-base)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--bg-2)_84%,var(--fill-2)_16%)] p-1px'
    : 'flex shrink-0 items-center gap-6px rounded-14px border border-solid border-[color:color-mix(in_srgb,var(--border-base)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--bg-2)_84%,var(--fill-2)_16%)] p-2px';

  return (
    <div className={actionShellClassName}>
      <CreateConversationTrigger
        compact={compact}
        disabled={isDropdownDisabled}
        title={t('conversation.entry.create')}
        menu={renderCreateMenu()}
      />
      <CreateGroupModal
        visible={groupModalVisible}
        workspace={currentWorkspaceTab?.workspace}
        spaceId={selectedSpaceId ?? undefined}
        cliAgents={cliAgents}
        presetAssistants={presetAssistants}
        onCancel={() => setGroupModalVisible(false)}
        onCreated={(conversation) => {
          setGroupModalVisible(false);
          openTab(conversation);
          void navigate(`/conversation/${conversation.id}`);
          emitter.emit('chat.history.refresh');
        }}
      />
    </div>
  );
};

/**
 * 会话 Tabs 栏组件
 * Conversation tabs bar component
 *
 * 显示所有打开的会话 tabs，支持切换、关闭和新建会话
 * Displays all open conversation tabs, supports switching, closing, and creating new conversations
 */
const ConversationTabs: React.FC<{ showHeaderActions?: boolean; mobileEmbedded?: boolean }> = ({
  showHeaderActions = true,
  mobileEmbedded = false,
}) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const isMobileShellRuntime = isMobile && isMobileShellWebView();
  const {
    openTabs,
    activeTabId,
    switchTab,
    closeTab,
    closeAllTabs,
    closeTabsToLeft,
    closeTabsToRight,
    closeOtherTabs,
  } = useConversationTabs();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [tabFadeState, setTabFadeState] = useState<TabFadeState>({ left: false, right: false });
  const [tabsContainerWidth, setTabsContainerWidth] = useState(0);

  // 更新 Tab 溢出状态
  const updateTabOverflow = useCallback(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setTabsContainerWidth((prev) => (prev === clientWidth ? prev : clientWidth));
    const hasOverflow = scrollWidth > clientWidth + 1;

    const nextState: TabFadeState = {
      left: hasOverflow && scrollLeft > TAB_OVERFLOW_THRESHOLD,
      right: hasOverflow && scrollLeft + clientWidth < scrollWidth - TAB_OVERFLOW_THRESHOLD,
    };

    setTabFadeState((prev) => {
      if (prev.left === nextState.left && prev.right === nextState.right) return prev;
      return nextState;
    });
  }, []);

  // 当 tabs 变化时更新溢出状态
  useEffect(() => {
    updateTabOverflow();
  }, [updateTabOverflow, openTabs.length]);

  // 监听滚动和窗口大小变化
  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const handleScroll = () => updateTabOverflow();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateTabOverflow);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateTabOverflow());
      resizeObserver.observe(container);
    }

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateTabOverflow);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [updateTabOverflow]);

  // 切换 tab 并导航
  const handleSwitchTab = useCallback(
    (tabId: string) => {
      cleanupSiderTooltips();
      switchTab(tabId);
      void navigate(`/conversation/${tabId}`);
    },
    [switchTab, navigate]
  );

  // 关闭 tab
  const handleCloseTab = useCallback(
    (tabId: string) => {
      cleanupSiderTooltips();
      closeTab(tabId);
      // 如果关闭的是当前 tab，导航将由 context 自动处理（切换到最后一个）
      // 如果没有 tab 了，导航到欢迎页
      if (openTabs.length === 1 && tabId === activeTabId) {
        void navigate('/guid');
      }
    },
    [closeTab, openTabs.length, activeTabId, navigate]
  );

  // 生成右键菜单内容
  const getContextMenu = useCallback(
    (tabId: string) => {
      const tabIndex = openTabs.findIndex((tab) => tab.id === tabId);
      const hasLeftTabs = tabIndex > 0;
      const hasRightTabs = tabIndex < openTabs.length - 1;
      const hasOtherTabs = openTabs.length > 1;

      return (
        <Menu
          onClickMenuItem={(key) => {
            switch (key) {
              case 'close-all':
                closeAllTabs();
                void navigate('/guid');
                break;
              case 'close-left':
                closeTabsToLeft(tabId);
                break;
              case 'close-right':
                closeTabsToRight(tabId);
                break;
              case 'close-others':
                closeOtherTabs(tabId);
                void navigate(`/conversation/${tabId}`);
                break;
            }
          }}
        >
          <Menu.Item key='close-others' disabled={!hasOtherTabs}>
            {t('conversation.tabs.closeOthers')}
          </Menu.Item>
          <Menu.Item key='close-left' disabled={!hasLeftTabs}>
            {t('conversation.tabs.closeLeft')}
          </Menu.Item>
          <Menu.Item key='close-right' disabled={!hasRightTabs}>
            {t('conversation.tabs.closeRight')}
          </Menu.Item>
          <Menu.Item key='close-all'>{t('conversation.tabs.closeAll')}</Menu.Item>
        </Menu>
      );
    },
    [openTabs, closeAllTabs, closeTabsToLeft, closeTabsToRight, closeOtherTabs, navigate, t]
  );

  const { left: showLeftFade, right: showRightFade } = tabFadeState;
  // 检查当前激活的 tab 是否在 openTabs 中
  // Check if current active tab is in openTabs
  const isActiveTabInList = openTabs.some((tab) => tab.id === activeTabId);

  // 如果没有打开的 tabs，或者当前激活的会话不在 tabs 中（说明切换到了非工作空间会话），不显示此组件
  // If no open tabs, or active conversation is not in tabs (switched to non-workspace chat), hide component
  if (openTabs.length === 0 || !isActiveTabInList) {
    return null;
  }

  const tabsBackground = mobileEmbedded ? 'transparent' : CONVERSATION_TAB_STRIP_BG;
  const tabsRootClassName = isMobile
    ? mobileEmbedded
      ? 'relative flex min-w-0 flex-1 shrink items-center bg-transparent px-0 py-0'
      : 'relative w-full min-w-0 shrink-0 bg-1 min-h-42px px-8px py-4px'
    : 'relative flex h-full w-full min-w-0 max-w-full items-center overflow-hidden px-6px';
  const tabsInnerClassName = isMobile
    ? mobileEmbedded
      ? 'relative flex h-34px w-full min-w-0 items-center gap-6px'
      : 'relative flex h-32px w-full min-w-0 items-center gap-6px'
    : 'relative flex h-full w-full min-w-0 max-w-full items-center gap-6px overflow-hidden';
  const tabDensity = resolveConversationTabDensity({
    isMobile,
    isMobileShell: isMobileShellRuntime,
    openTabsCount: openTabs.length,
    containerWidth: tabsContainerWidth,
    showHeaderActions,
  });
  const tabWidth = resolveConversationTabWidth({
    density: tabDensity,
    openTabsCount: openTabs.length,
    containerWidth: tabsContainerWidth,
    showHeaderActions,
  });

  return (
    <div className={tabsRootClassName} style={{ background: tabsBackground }}>
      <div className={tabsInnerClassName}>
        {/* Tabs 滚动区域 */}
        <div
          ref={tabsContainerRef}
          className='flex h-full min-w-0 flex-1 items-center gap-4px overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
        >
          {openTabs.map((tab) => (
            <ConversationTabView
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              isMobile={isMobile}
              density={tabDensity}
              width={isMobile && !isMobileShellRuntime ? undefined : tabWidth}
              contextMenu={getContextMenu(tab.id)}
              onSwitch={handleSwitchTab}
              onClose={handleCloseTab}
            />
          ))}
        </div>
        {showHeaderActions && <ConversationHeaderActions compact />}

        {/* 左侧渐变指示器 */}
        {showLeftFade && (
          <div
            className='pointer-events-none absolute left-0 top-0 bottom-0 w-32px'
            style={{ background: `linear-gradient(90deg, ${tabsBackground} 16%, transparent 100%)` }}
          />
        )}

        {/* 右侧渐变指示器 */}
        {showRightFade && (
          <div
            className={`pointer-events-none absolute top-0 bottom-0 w-32px ${showHeaderActions ? 'right-56px' : 'right-0'}`}
            style={{ background: `linear-gradient(270deg, ${tabsBackground} 16%, transparent 100%)` }}
          />
        )}
      </div>
    </div>
  );
};

export default ConversationTabs;
