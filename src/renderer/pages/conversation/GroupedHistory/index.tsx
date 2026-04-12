/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { Button, Dropdown, Empty, Input, Menu, Message } from '@arco-design/web-react';
import { ContextGoModal } from '@/renderer/components/base';
import FlexFullContainer from '@/renderer/components/layout/FlexFullContainer';
import { useSelectedSpaceId } from '@/renderer/hooks/context/useSelectedSpace';
import DirectorySelectionModal from '@/renderer/components/settings/DirectorySelectionModal';
import { CUSTOM_AVATAR_IMAGE_MAP } from '@/renderer/pages/guid/constants';
import { useScheduleJobsMap } from '@/renderer/pages/schedule';
import { buildCliAgentParams, buildPresetAssistantParams } from '@/renderer/pages/conversation/utils/createConversationParams';
import { applyDefaultConversationName } from '@/renderer/pages/conversation/utils/newConversationName';
import { useConversationAgents } from '@/renderer/pages/conversation/hooks/useConversationAgents';
import { useConversationTabs } from '@/renderer/pages/conversation/hooks/ConversationTabsContext';
import { emitter } from '@/renderer/utils/emitter';
import { getAgentLogo } from '@/renderer/utils/model/agentLogo';
import { iconColors } from '@/renderer/styles/colors';
import { updateWorkspaceTime } from '@/renderer/utils/workspace/workspaceHistory';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Down, FolderOpen, Plus, Robot } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import WorkspaceCollapse from '../components/WorkspaceCollapse';
import ConversationRow from './ConversationRow';
import DeleteConversationModal from './DeleteConversationModal';
import DragOverlayContent from './DragOverlayContent';
import SortableConversationRow from './SortableConversationRow';
import { useBatchSelection } from './hooks/useBatchSelection';
import { useConversationActions } from './hooks/useConversationActions';
import { useConversations } from './hooks/useConversations';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useExport } from './hooks/useExport';
import type { ConversationRowProps, WorkspaceGroupedHistoryProps } from './types';

const WorkspaceGroupedHistory: React.FC<WorkspaceGroupedHistoryProps> = ({
  onSessionClick,
  collapsed = false,
  tooltipEnabled = false,
  batchMode = false,
  onBatchModeChange,
}) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { getJobStatus, markAsRead, setActiveConversation } = useScheduleJobsMap();
  const { openTab } = useConversationTabs();
  const { cliAgents, presetAssistants } = useConversationAgents();
  const selectedSpaceId = useSelectedSpaceId();
  const defaultConversationName = t('conversation.welcome.newConversation');

  useEffect(() => {
    if (id) {
      setActiveConversation(id);
    }
  }, [id, setActiveConversation]);

  const {
    conversations,
    isConversationGenerating,
    hasCompletionUnread,
    expandedWorkspaces,
    expandedGroupConversations,
    pinnedConversations,
    timelineSections,
    groupChildConversationsByParentId,
    handleToggleWorkspace,
    handleToggleGroupConversation,
    ensureGroupConversationExpanded,
  } = useConversations();

  const {
    selectedConversationIds,
    setSelectedConversationIds,
    selectedCount,
    allSelected,
    toggleSelectedConversation,
    handleToggleSelectAll,
  } = useBatchSelection(batchMode, conversations);

  const {
    renameModalVisible,
    renameModalName,
    setRenameModalName,
    renameLoading,
    dropdownVisibleId,
    deleteModalState,
    deleteModalDeleting,
    handleConversationClick,
    handleDeleteClick,
    handleBatchDelete,
    handleDeleteModalCancel,
    handleDeleteModalConfirm,
    handleEditStart,
    handleRenameConfirm,
    handleRenameCancel,
    handleTogglePin,
    handleArchiveConversation,
    handleMenuVisibleChange,
    handleOpenMenu,
  } = useConversationActions({
    batchMode,
    onSessionClick,
    onBatchModeChange,
    selectedConversationIds,
    setSelectedConversationIds,
    toggleSelectedConversation,
    markAsRead,
  });

  const {
    exportTask,
    exportModalVisible,
    exportTargetPath,
    exportModalLoading,
    showExportDirectorySelector,
    setShowExportDirectorySelector,
    closeExportModal,
    handleSelectExportDirectoryFromModal,
    handleSelectExportFolder,
    handleExportConversation,
    handleBatchExport,
    handleConfirmExport,
  } = useExport({
    conversations,
    selectedConversationIds,
    setSelectedConversationIds,
    onBatchModeChange,
  });

  const { sensors, activeId, activeConversation, handleDragStart, handleDragEnd, handleDragCancel, isDragEnabled } =
    useDragAndDrop({
      pinnedConversations,
      batchMode,
      collapsed,
    });

  const getConversationRowProps = useCallback(
    (conversation: TChatConversation): ConversationRowProps => ({
      conversation,
      isGenerating: isConversationGenerating(conversation.id),
      hasCompletionUnread: hasCompletionUnread(conversation.id),
      collapsed,
      tooltipEnabled,
      batchMode,
      checked: selectedConversationIds.has(conversation.id),
      selected: id === conversation.id,
      menuVisible: dropdownVisibleId === conversation.id,
      onToggleChecked: toggleSelectedConversation,
      onConversationClick: handleConversationClick,
      onOpenMenu: handleOpenMenu,
      onMenuVisibleChange: handleMenuVisibleChange,
      onEditStart: handleEditStart,
      onDelete: handleDeleteClick,
      onExport: handleExportConversation,
      onTogglePin: handleTogglePin,
      onArchive: handleArchiveConversation,
      getJobStatus,
    }),
    [
      collapsed,
      tooltipEnabled,
      batchMode,
      isConversationGenerating,
      hasCompletionUnread,
      selectedConversationIds,
      id,
      dropdownVisibleId,
      toggleSelectedConversation,
      handleConversationClick,
      handleOpenMenu,
      handleMenuVisibleChange,
      handleEditStart,
      handleDeleteClick,
      handleExportConversation,
      handleTogglePin,
      handleArchiveConversation,
      getJobStatus,
    ]
  );

  const renderConversation = (conversation: TChatConversation, overrides: Partial<ConversationRowProps> = {}) => {
    const rowProps = {
      ...getConversationRowProps(conversation),
      ...overrides,
    };
    return (
      <div key={conversation.id} className='w-full min-w-0'>
        <ConversationRow {...rowProps} />
      </div>
    );
  };

  const composeLeadingSlot = (...slots: Array<React.ReactNode | undefined>) => {
    const visibleSlots = slots.filter(Boolean);
    if (visibleSlots.length === 0) {
      return undefined;
    }

    return <span className='flex items-center gap-4px'>{visibleSlots}</span>;
  };

  const renderWorkspaceMarker = () => <span className='flex h-20px w-12px shrink-0' aria-hidden='true' />;

  const handleCreateWorkspaceConversation = useCallback(
    async (workspace: string, key: string) => {
      try {
        let params;

        if (key.startsWith('cli:')) {
          const backend = key.slice(4);
          const agent = cliAgents.find((item) => item.backend === backend);
          if (!agent) {
            Message.error(t('conversation.createFailed'));
            return;
          }
          params = await buildCliAgentParams(agent, workspace, selectedSpaceId ?? undefined);
        } else if (key.startsWith('preset:')) {
          const assistantId = key.slice(7);
          const agent = presetAssistants.find((item) => item.customAgentId === assistantId);
          if (!agent) {
            Message.error(t('conversation.createFailed'));
            return;
          }
          params = await buildPresetAssistantParams(agent, workspace, i18n.language, selectedSpaceId ?? undefined);
        } else {
          return;
        }

        const conversation = await ipcBridge.conversation.create.invoke(
          applyDefaultConversationName(params, defaultConversationName)
        );

        updateWorkspaceTime(workspace);
        openTab(conversation);
        void navigate(`/conversation/${conversation.id}`);
        emitter.emit('chat.history.refresh');
        onSessionClick?.();
      } catch (error) {
        console.error('Failed to create workspace conversation:', error);
        Message.error(t('conversation.createFailed'));
      }
    },
    [cliAgents, defaultConversationName, i18n.language, navigate, onSessionClick, openTab, presetAssistants, selectedSpaceId, t]
  );

  const renderWorkspaceCreateMenu = useCallback(
    (workspace: string) => (
      <Menu
        onClickMenuItem={(key) => {
          void handleCreateWorkspaceConversation(workspace, key);
        }}
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
                      <img src={avatarImage} alt={agent.name} style={{ width: 16, height: 16, objectFit: 'contain' }} />
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
      </Menu>
    ),
    [cliAgents, handleCreateWorkspaceConversation, presetAssistants, t]
  );

  const renderGroupChildMarker = () => (
    <span className='relative flex h-20px w-14px shrink-0 items-center' aria-hidden='true'>
      <span className='absolute left-4px top-1/2 h-2px w-10px -translate-y-1/2 rounded-full bg-[var(--color-text-4)]/45' />
    </span>
  );

  const renderGroupChildConversations = (conversation: TChatConversation, inheritedLeadingSlot?: React.ReactNode) => {
    const childConversations = groupChildConversationsByParentId[conversation.id] ?? [];
    if (childConversations.length === 0) {
      return null;
    }

    return (
      <div className='mt-2px min-w-0 w-full'>
        {childConversations.map((childConversation) =>
          renderConversation(childConversation, {
            allowActions: false,
            allowBatchSelection: false,
            leadingSlot:
              collapsed || !conversation.id
                ? undefined
                : composeLeadingSlot(inheritedLeadingSlot, renderGroupChildMarker()),
          })
        )}
      </div>
    );
  };

  const renderConversationBlock = (conversation: TChatConversation, inheritedLeadingSlot?: React.ReactNode) => {
    const childConversations = groupChildConversationsByParentId[conversation.id] ?? [];
    const hasGroupChildren = childConversations.length > 0;
    const isGroupConversationExpanded = collapsed || expandedGroupConversations.includes(conversation.id);

    if (hasGroupChildren) {
      return (
        <div key={conversation.id} className='min-w-0 w-full'>
          {renderConversation(conversation, {
            leadingSlot: collapsed
              ? undefined
              : composeLeadingSlot(
                  inheritedLeadingSlot,
                  <Button
                    size='mini'
                    type='text'
                    className='!h-20px !w-18px !shrink-0 !rounded-6px !p-0 !text-[var(--color-text-3)] hover:!bg-fill-2'
                    icon={
                      <Down
                        size={14}
                        className={classNames('transition-transform duration-200', {
                          'rotate-0': isGroupConversationExpanded,
                          '-rotate-90': !isGroupConversationExpanded,
                        })}
                      />
                    }
                    aria-label={t('conversation.history.toggleGroupConversation')}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleGroupConversation(conversation.id);
                    }}
                  />
                ),
            onConversationClick: (targetConversation) => {
              ensureGroupConversationExpanded(targetConversation.id);
              handleConversationClick(targetConversation);
            },
          })}
          {isGroupConversationExpanded ? renderGroupChildConversations(conversation, inheritedLeadingSlot) : null}
        </div>
      );
    }

    return (
      <div key={conversation.id} className='min-w-0'>
        {renderConversation(conversation, {
          leadingSlot: inheritedLeadingSlot,
        })}
      </div>
    );
  };

  const pinnedIds = useMemo(() => pinnedConversations.map((c) => c.id), [pinnedConversations]);

  if (timelineSections.length === 0 && pinnedConversations.length === 0) {
    return (
      <FlexFullContainer>
        <div className='flex-center'>
          <Empty description={t('conversation.history.noHistory')} />
        </div>
      </FlexFullContainer>
    );
  }

  return (
    <FlexFullContainer>
      <ContextGoModal
        visible={renameModalVisible}
        onCancel={handleRenameCancel}
        className='conversation-rename-modal'
        header={{
          title: t('conversation.history.renameTitle'),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={handleRenameCancel} className='min-w-88px px-18px'>
                {t('conversation.history.cancelEdit')}
              </Button>
              <Button
                type='primary'
                loading={renameLoading}
                disabled={!renameModalName.trim()}
                onClick={() => void handleRenameConfirm()}
                className='min-w-104px px-18px'
              >
                {t('conversation.history.saveName')}
              </Button>
            </div>
          ),
        }}
        style={{ width: 'min(520px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <Input
          autoFocus
          value={renameModalName}
          onChange={setRenameModalName}
          onPressEnter={handleRenameConfirm}
          placeholder={t('conversation.history.renamePlaceholder')}
          allowClear
        />
      </ContextGoModal>

      <DeleteConversationModal
        visible={deleteModalState !== null}
        state={deleteModalState}
        deleting={deleteModalDeleting}
        onCancel={handleDeleteModalCancel}
        onConfirm={() => {
          void handleDeleteModalConfirm();
        }}
      />

      <ContextGoModal
        visible={exportModalVisible}
        onCancel={closeExportModal}
        className='conversation-export-modal'
        header={{
          title: t('conversation.history.exportDialogTitle'),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={null}
        style={{ width: 'min(560px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='py-8px'>
          <div className='text-14px mb-16px text-t-secondary'>
            {exportTask?.mode === 'batch'
              ? t('conversation.history.exportDialogBatchDescription', { count: exportTask.conversationIds.length })
              : t('conversation.history.exportDialogSingleDescription')}
          </div>

          <div className='mb-16px rounded-18px border border-b-base bg-fill-1 p-16px shadow-[0_12px_30px_rgba(15,23,42,0.04)]'>
            <div className='text-14px mb-8px text-t-primary'>{t('conversation.history.exportTargetFolder')}</div>
            <div
              className={`flex items-center justify-between rounded-14px border border-b-base bg-base px-14px py-12px transition-colors ${exportModalLoading ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-fill-1'}`}
              onClick={() => {
                void handleSelectExportFolder();
              }}
            >
              <span
                className={`overflow-hidden text-ellipsis whitespace-nowrap text-14px ${exportTargetPath ? 'text-t-primary' : 'text-t-secondary'}`}
              >
                {exportTargetPath || t('conversation.history.exportSelectFolder')}
              </span>
              <FolderOpen theme='outline' size='18' fill='currentColor' className='text-t-secondary' />
            </div>
          </div>

          <div className='flex items-center gap-8px mb-20px text-14px text-t-secondary'>
            <span>💡</span>
            <span>{t('conversation.history.exportDialogHint')}</span>
          </div>

          <div className='flex gap-12px justify-end'>
            <Button onClick={closeExportModal} className='min-w-88px px-18px'>
              {t('common.cancel')}
            </Button>
            <Button
              type='primary'
              loading={exportModalLoading}
              onClick={() => {
                void handleConfirmExport();
              }}
              className='min-w-104px px-18px'
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </ContextGoModal>

      <DirectorySelectionModal
        visible={showExportDirectorySelector}
        onConfirm={handleSelectExportDirectoryFromModal}
        onCancel={() => setShowExportDirectorySelector(false)}
      />

      {batchMode && !collapsed && (
        <div className='px-12px pb-8px'>
          <div className='rd-8px bg-fill-1 p-10px flex flex-col gap-8px border border-solid border-[rgba(var(--primary-6),0.08)]'>
            <div className='text-12px leading-18px text-t-secondary'>
              {t('conversation.history.selectedCount', { count: selectedCount })}
            </div>
            <div className='grid grid-cols-2 gap-6px'>
              <Button
                className='!col-span-2 !w-full !justify-center !min-w-0 !h-30px !px-8px !text-12px whitespace-nowrap'
                size='mini'
                type='secondary'
                onClick={handleToggleSelectAll}
              >
                {allSelected ? t('common.cancel') : t('conversation.history.selectAll')}
              </Button>
              <Button
                className='!w-full !justify-center !min-w-0 !h-30px !px-8px !text-12px whitespace-nowrap'
                size='mini'
                type='secondary'
                onClick={handleBatchExport}
              >
                {t('conversation.history.batchExport')}
              </Button>
              <Button
                className='!w-full !justify-center !min-w-0 !h-30px !px-8px !text-12px whitespace-nowrap'
                size='mini'
                status='warning'
                onClick={handleBatchDelete}
              >
                {t('conversation.history.batchDelete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className='size-full w-full overflow-y-auto overflow-x-hidden'>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {pinnedConversations.length > 0 && (
            <div className='mb-8px min-w-0'>
              {!collapsed && (
                <div className='chat-history__section py-8px px-12px text-13px text-t-secondary font-bold'>
                  {t('conversation.history.pinnedSection')}
                </div>
              )}
              <SortableContext items={pinnedIds} strategy={verticalListSortingStrategy}>
                <div className='w-full min-w-0'>
                  {pinnedConversations.map((conversation) => {
                    const props = getConversationRowProps(conversation);
                    return (
                      <div key={conversation.id} className='w-full min-w-0'>
                        {isDragEnabled ? <SortableConversationRow {...props} /> : <ConversationRow {...props} />}
                        {renderGroupChildConversations(conversation)}
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {activeId && activeConversation ? <DragOverlayContent conversation={activeConversation} /> : null}
          </DragOverlay>
        </DndContext>

        {timelineSections.map((section) => (
          <div key={section.timeline} className='mb-8px min-w-0'>
            {!collapsed && (
              <div className={classNames('chat-history__section py-8px px-12px text-13px text-t-secondary font-bold')}>
                {section.timeline}
              </div>
            )}

            {section.items.map((item) => {
              if (item.type === 'workspace' && item.workspaceGroup) {
                const group = item.workspaceGroup;
                return (
                  <div key={group.workspace} className='min-w-0'>
                    <WorkspaceCollapse
                      expanded={expandedWorkspaces.includes(group.workspace)}
                      onToggle={() => handleToggleWorkspace(group.workspace)}
                      siderCollapsed={collapsed}
                      headerActions={
                        <Dropdown droplist={renderWorkspaceCreateMenu(group.workspace)} trigger='click' position='bl'>
                          <button
                            type='button'
                            className='flex h-22px w-22px items-center justify-center rounded-6px border-none bg-transparent p-0 text-t-secondary transition-colors hover:bg-fill-2 hover:text-t-primary'
                            aria-label={t('conversation.entry.create') + t('conversation.entry.conversation')}
                            title={`${t('conversation.entry.create')} ${t('conversation.entry.conversation')}`}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            <Plus theme='outline' size='14' fill={iconColors.primary} />
                          </button>
                        </Dropdown>
                      }
                      header={
                        <div className='flex items-center gap-8px text-14px min-w-0'>
                          <span className='font-medium truncate flex-1 text-t-primary min-w-0'>
                            {group.displayName}
                          </span>
                        </div>
                      }
                    >
                      <div className={classNames('flex flex-col gap-2px min-w-0', { 'mt-4px': !collapsed })}>
                        {group.conversations.map((conversation) =>
                          renderConversationBlock(conversation, collapsed ? undefined : renderWorkspaceMarker())
                        )}
                      </div>
                    </WorkspaceCollapse>
                  </div>
                );
              }

              if (item.type === 'conversation' && item.conversation) {
                return renderConversationBlock(item.conversation);
              }

              return null;
            })}
          </div>
        ))}
      </div>
    </FlexFullContainer>
  );
};

export default WorkspaceGroupedHistory;
