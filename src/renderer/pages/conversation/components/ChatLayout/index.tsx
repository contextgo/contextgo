import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { useResizableSplit } from '@/renderer/hooks/ui/useResizableSplit';
import ConversationTabs from '@/renderer/pages/conversation/components/ConversationTabs';
import ChatTitleEditor from '@/renderer/pages/conversation/components/ChatTitleEditor';
import MobileWorkspaceOverlay from './MobileWorkspaceOverlay';
import WorkspacePanelHeader from './WorkspacePanelHeader';
import { useConversationTabs } from '@/renderer/pages/conversation/hooks/ConversationTabsContext';
import { useContainerWidth } from '@/renderer/pages/conversation/hooks/useContainerWidth';
import { useLayoutConstraints } from '@/renderer/pages/conversation/hooks/useLayoutConstraints';
import { usePreviewAutoCollapse } from '@/renderer/pages/conversation/hooks/usePreviewAutoCollapse';
import { useTitleRename } from '@/renderer/pages/conversation/hooks/useTitleRename';
import { useWorkspaceCollapse } from '@/renderer/pages/conversation/hooks/useWorkspaceCollapse';
import { PreviewPanel, usePreviewContext } from '@/renderer/pages/conversation/Preview';
import { dispatchWorkspaceToggleEvent } from '@/renderer/utils/workspace/workspaceEvents';
import {
  getWorkbenchTitlebarPrimarySlotId,
  getWorkbenchToolbarSlotId,
} from '@/renderer/pages/WorkbenchHost/slots';
import classNames from 'classnames';
import { isMacEnvironment, isWindowsEnvironment } from '@/renderer/pages/conversation/utils/detectPlatform';
import {
  MIN_WORKSPACE_RATIO,
  WORKSPACE_HEADER_HEIGHT,
  calcLayoutMetrics,
} from '@/renderer/pages/conversation/utils/layoutCalc';
import { Layout as ArcoLayout } from '@arco-design/web-react';
import { ExpandLeft, ExpandRight } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import './chat-layout.css';

// headerExtra allows injecting custom actions (e.g., model picker) into the header's right area
const ChatLayout: React.FC<{
  children: React.ReactNode;
  title?: React.ReactNode;
  sider: React.ReactNode;
  siderTitle?: React.ReactNode;
  backend?: string;
  agentName?: string;
  /** Custom agent logo (can be SVG path or emoji string) */
  agentLogo?: string;
  /** Whether the logo is an emoji */
  agentLogoIsEmoji?: boolean;
  headerExtra?: React.ReactNode;
  headerLeft?: React.ReactNode;
  workspaceEnabled?: boolean;
  workspacePath?: string;
  /** Conversation ID for mode switching */
  conversationId?: string;
}> = (props) => {
  const { conversationId } = props;
  const { workspaceEnabled = true } = props;
  const layout = useLayoutContext();
  const isMacRuntime = isMacEnvironment();
  const isWindowsRuntime = isWindowsEnvironment();
  const isDesktop = !layout?.isMobile;
  const isMobile = Boolean(layout?.isMobile);
  const titlebarPrimarySlotId = getWorkbenchTitlebarPrimarySlotId(layout?.activeWorkbenchDefinition);
  const toolbarSlotId = getWorkbenchToolbarSlotId(layout?.activeWorkbenchDefinition);
  const showWorkspaceHeader = Boolean(props.siderTitle) || (!isMacRuntime && !isWindowsRuntime);
  const workspaceHeaderHeight = showWorkspaceHeader ? WORKSPACE_HEADER_HEIGHT : 0;
  const [desktopHeaderTarget, setDesktopHeaderTarget] = useState<HTMLElement | null>(null);
  const [desktopToolbarTarget, setDesktopToolbarTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isMobile || typeof document === 'undefined') {
      setDesktopHeaderTarget(null);
      setDesktopToolbarTarget(null);
      return;
    }

    setDesktopHeaderTarget(titlebarPrimarySlotId ? document.getElementById(titlebarPrimarySlotId) : null);
    setDesktopToolbarTarget(toolbarSlotId ? document.getElementById(toolbarSlotId) : null);
  }, [isMobile, titlebarPrimarySlotId, toolbarSlotId]);

  // Preview panel state
  const { isOpen: isPreviewOpen } = usePreviewContext();

  // --- Hook A: workspace collapse ---
  const { rightSiderCollapsed, setRightSiderCollapsed } = useWorkspaceCollapse({
    workspaceEnabled,
    isMobile,
    conversationId,
  });

  // --- Hook B: container width ---
  const { containerRef, containerWidth } = useContainerWidth();

  // --- Hook C: title rename ---
  const { openTabs, updateTabName } = useConversationTabs();
  const hasTabs = openTabs.length > 0;

  const { editingTitle, setEditingTitle, titleDraft, setTitleDraft, renameLoading, canRenameTitle, submitTitleRename } =
    useTitleRename({
      title: props.title,
      conversationId,
      updateTabName,
    });

  const {
    splitRatio: workspaceSplitRatio,
    setSplitRatio: setWorkspaceSplitRatio,
    createDragHandle: createWorkspaceDragHandle,
  } = useResizableSplit({
    defaultWidth: 20,
    minWidth: MIN_WORKSPACE_RATIO,
    maxWidth: 40,
    storageKey: 'chat-workspace-split-ratio',
  });

  // Pre-hook metrics: compute dynamic min/max for the chat-preview split hook
  const { dynamicChatMinRatio, dynamicChatMaxRatio } = calcLayoutMetrics({
    containerWidth,
    workspaceSplitRatio,
    chatSplitRatio: 60, // placeholder; only dynamicChatMinRatio/dynamicChatMaxRatio are used here
    workspaceEnabled,
    isDesktop,
    isPreviewOpen,
    rightSiderCollapsed,
    isMobile,
  });

  const {
    splitRatio: chatSplitRatio,
    setSplitRatio: setChatSplitRatio,
    createDragHandle: createPreviewDragHandle,
  } = useResizableSplit({
    defaultWidth: 60,
    minWidth: dynamicChatMinRatio,
    maxWidth: dynamicChatMaxRatio,
    storageKey: 'chat-preview-split-ratio',
  });

  // Full metrics with real chatSplitRatio
  const { chatFlex, workspaceFlex, workspaceWidthPx, titleAreaMaxWidth, mobileWorkspaceHandleRight } =
    calcLayoutMetrics({
      containerWidth,
      workspaceSplitRatio,
      chatSplitRatio,
      workspaceEnabled,
      isDesktop,
      isPreviewOpen,
      rightSiderCollapsed,
      isMobile,
    });

  const desktopHeaderContent = useMemo(
    () => (
      <div className={classNames('flex h-full min-w-0 items-stretch overflow-hidden', !hasTabs && 'bg-1')}>
        {hasTabs ? (
          <div className='flex h-full w-52px shrink-0 items-center justify-center border-r border-[var(--border-base)] px-4px'>
            {props.headerLeft}
          </div>
        ) : props.headerLeft ? (
          <div className='flex shrink-0 items-center justify-center border-r border-[var(--border-base)] px-4px'>
            {props.headerLeft}
          </div>
        ) : null}
        <div className={classNames('min-w-0 flex-1', !hasTabs && 'bg-1')}>
          {hasTabs ? (
            <ConversationTabs showHeaderActions={false} />
          ) : (
            <div className='flex h-40px items-center bg-1 px-16px'>
              <ChatTitleEditor
                editingTitle={editingTitle}
                titleDraft={titleDraft}
                setTitleDraft={setTitleDraft}
                setEditingTitle={setEditingTitle}
                renameLoading={renameLoading}
                canRenameTitle={canRenameTitle}
                submitTitleRename={submitTitleRename}
                titleAreaMaxWidth={titleAreaMaxWidth}
                title={props.title}
                conversationId={conversationId}
                workspacePath={props.workspacePath}
              />
            </div>
          )}
        </div>
      </div>
    ),
    [
      canRenameTitle,
      conversationId,
      editingTitle,
      hasTabs,
      props.headerLeft,
      props.title,
      props.workspacePath,
      renameLoading,
      setEditingTitle,
      setTitleDraft,
      submitTitleRename,
      titleAreaMaxWidth,
      titleDraft,
    ]
  );

  // --- Hook D: preview auto-collapse ---
  usePreviewAutoCollapse({
    isPreviewOpen,
    isDesktop,
    workspaceEnabled,
    rightSiderCollapsed,
    setRightSiderCollapsed,
    siderCollapsed: layout?.siderCollapsed,
    setSiderCollapsed: layout?.setSiderCollapsed,
  });

  // --- Hook E: layout constraints ---
  useLayoutConstraints({
    containerWidth,
    workspaceEnabled,
    isDesktop,
    isPreviewOpen,
    rightSiderCollapsed,
    setRightSiderCollapsed,
    workspaceSplitRatio,
    setWorkspaceSplitRatio,
    chatSplitRatio,
    setChatSplitRatio,
    dynamicChatMinRatio,
    dynamicChatMaxRatio,
  });

  const showMobileToolbar = Boolean(props.headerLeft || props.headerExtra || (isWindowsRuntime && workspaceEnabled));

  const mobileHeaderBlock = layout?.isMobile ? (
    <div className='chat-layout-mobile-top-chrome'>
      {showMobileToolbar && (
        <div className='chat-layout-mobile-context-row'>
          <div className='chat-layout-mobile-toolbar'>
            <div className='chat-layout-mobile-toolbar-scroll'>
              {props.headerLeft ? <div className='chat-layout-mobile-toolbar-item'>{props.headerLeft}</div> : null}
              {props.headerExtra ? <div className='chat-layout-mobile-toolbar-item'>{props.headerExtra}</div> : null}
              {isWindowsRuntime && workspaceEnabled && (
                <button
                  type='button'
                  className='workspace-header__toggle'
                  aria-label='Toggle workspace'
                  onClick={() => dispatchWorkspaceToggleEvent()}
                >
                  {rightSiderCollapsed ? <ExpandRight size={16} /> : <ExpandLeft size={16} />}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <ArcoLayout
      className='size-full color-black '
      style={{
        // fontFamily: `cursive,"anthropicSans","anthropicSans Fallback",system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif`,
      }}
    >
      {isDesktop && desktopHeaderTarget ? createPortal(desktopHeaderContent, desktopHeaderTarget) : null}
      {isDesktop && desktopToolbarTarget && props.headerExtra
        ? createPortal(
            <div className='app-titlebar__toolbar-portal-content flex h-full min-w-80px items-center justify-end'>
              {props.headerExtra}
            </div>,
            desktopToolbarTarget
          )
        : null}
      <div ref={containerRef} className='flex flex-1 relative w-full overflow-hidden'>
        <div
          className='flex flex-col relative'
          style={{
            flexGrow: isPreviewOpen && isDesktop ? 0 : chatFlex,
            flexShrink: 0,
            flexBasis: isPreviewOpen && isDesktop ? `${chatFlex}%` : 0,
            display: isPreviewOpen && layout?.isMobile ? 'none' : 'flex',
            minWidth: isDesktop ? '240px' : '100%',
          }}
        >
          <ArcoLayout.Content
            className='flex flex-col h-full'
            onClick={() => {
              if (window.innerWidth < 768 && !rightSiderCollapsed) setRightSiderCollapsed(true);
            }}
          >
            {layout?.isMobile ? mobileHeaderBlock : null}
            <ArcoLayout.Content className='flex flex-col flex-1 bg-1 overflow-hidden'>
              {props.children}
            </ArcoLayout.Content>
          </ArcoLayout.Content>
        </div>
        {isPreviewOpen && (
          <div
            className={classNames(
              'preview-panel flex flex-col relative overflow-visible rounded-[15px]',
              layout?.isMobile ? 'm-[8px]' : 'my-[12px] mr-[12px] ml-[8px]'
            )}
            style={{
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 0,
              border: '1px solid var(--bg-3)',
              width: layout?.isMobile ? 'calc(100% - 16px)' : undefined,
              maxWidth: layout?.isMobile ? 'calc(100% - 16px)' : undefined,
              minWidth: layout?.isMobile ? 0 : '260px',
              boxSizing: 'border-box',
            }}
          >
            {!layout?.isMobile &&
              createPreviewDragHandle({
                className: 'absolute top-0 bottom-0 z-30',
                style: { width: '20px', left: '-20px' },
                linePlacement: 'end',
                lineClassName: 'opacity-30 group-hover:opacity-100 group-active:opacity-100',
                lineStyle: { width: '2px' },
              })}
            <div className='h-full w-full overflow-hidden rounded-[15px]'>
              <PreviewPanel />
            </div>
          </div>
        )}
        {workspaceEnabled && !layout?.isMobile && (
          <div
            className={classNames('!bg-1 relative chat-layout-right-sider layout-sider')}
            style={{
              flexGrow: isPreviewOpen ? 0 : workspaceFlex,
              flexShrink: 0,
              flexBasis: rightSiderCollapsed ? '0px' : isPreviewOpen ? `${Math.round(workspaceWidthPx)}px` : 0,
              width: rightSiderCollapsed ? '0px' : isPreviewOpen ? `${Math.round(workspaceWidthPx)}px` : undefined,
              minWidth: rightSiderCollapsed ? '0px' : '220px',
              overflow: 'hidden',
              borderLeft: rightSiderCollapsed ? 'none' : '1px solid var(--bg-3)',
            }}
          >
            {isDesktop &&
              !rightSiderCollapsed &&
              createWorkspaceDragHandle({ className: 'absolute left-0 top-0 bottom-0', style: {}, reverse: true })}
            {showWorkspaceHeader ? (
              <WorkspacePanelHeader
                showToggle={!isMacRuntime && !isWindowsRuntime}
                collapsed={rightSiderCollapsed}
                onToggle={() => dispatchWorkspaceToggleEvent()}
                togglePlacement={layout?.isMobile ? 'left' : 'right'}
              >
                {props.siderTitle}
              </WorkspacePanelHeader>
            ) : null}
            <ArcoLayout.Content style={{ height: `calc(100% - ${workspaceHeaderHeight}px)` }}>
              {props.sider}
            </ArcoLayout.Content>
          </div>
        )}

        {/* Mobile workspace overlay: backdrop + fixed panel + floating collapse handle */}
        {workspaceEnabled && layout?.isMobile && (
          <MobileWorkspaceOverlay
            rightSiderCollapsed={rightSiderCollapsed}
            setRightSiderCollapsed={setRightSiderCollapsed}
            workspaceWidthPx={workspaceWidthPx}
            mobileWorkspaceHandleRight={mobileWorkspaceHandleRight}
            siderTitle={props.siderTitle}
            sider={props.sider}
          />
        )}
      </div>
    </ArcoLayout>
  );
};

export default ChatLayout;
