/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { iconColors } from '@/renderer/styles/colors';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { Button, Dropdown, Input, Menu, Tooltip } from '@arco-design/web-react';
import { Down, FileText, Left, Plus, Refresh, Search } from '@icon-park/react';
import React, { useId } from 'react';
import type { TFunction } from 'i18next';
import type { RefInputType } from '@arco-design/web-react/es/Input/interface';

type WorkspaceToolbarProps = {
  currentView: 'files' | 'changes';
  onViewChange: (view: 'files' | 'changes') => void;
  t: TFunction;
  isWorkspaceCollapsed: boolean;
  setIsWorkspaceCollapsed: (v: boolean) => void;
  isTemporaryWorkspace: boolean;
  workspacePath: string;
  workspaceDisplayName: string;
  // Search
  showSearch: boolean;
  searchText: string;
  setSearchText: (v: string) => void;
  onSearch: (v: string) => void;
  searchInputRef: React.RefObject<RefInputType | null>;
  // Tree state
  loading: boolean;
  refreshWorkspace: () => void;
  // Upload
  handleSelectHostFiles: () => void;
  handleUploadDeviceFiles: () => void;
  setShowHostFileSelector: (v: boolean) => void;
  // Migration
  handleOpenMigrationModal: () => void;
  handleOpenWorkspaceRoot: () => Promise<void>;
};

/** SVG icon for the "change workspace" action button. */
const ChangeWorkspaceIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({ className, ...rest }) => {
  const clipPathId = useId();
  return (
    <svg className={className} viewBox='0 0 24 24' role='img' aria-hidden='true' focusable='false' {...rest}>
      <rect width='24' height='24' rx='2' fill='var(--workspace-btn-bg, var(--color-bg-1))' />
      <g clipPath={`url(#${clipPathId})`}>
        <path
          fillRule='evenodd'
          clipRule='evenodd'
          d='M10.8215 8.66602L9.15482 6.99935H5.33333V16.9993H18.6667V8.66602H10.8215ZM4.5 6.99935C4.5 6.53912 4.8731 6.16602 5.33333 6.16602H9.15482C9.37583 6.16602 9.5878 6.25382 9.74407 6.41009L11.1667 7.83268H18.6667C19.1269 7.83268 19.5 8.20578 19.5 8.66602V16.9993C19.5 17.4596 19.1269 17.8327 18.6667 17.8327H5.33333C4.8731 17.8327 4.5 17.4596 4.5 16.9993V6.99935Z'
          fill='var(--color-text-3, var(--text-secondary))'
        />
        <path
          d='M13.0775 12.4158L12.1221 11.4603L12.7113 10.8711L14.6726 12.8324L12.7113 14.7937L12.1221 14.2044L13.0774 13.2491H9.5V12.4158H13.0775Z'
          fill='var(--color-text-3, var(--text-secondary))'
        />
      </g>
      <defs>
        <clipPath id={clipPathId}>
          <rect width='20' height='20' fill='transparent' transform='translate(2 2)' />
        </clipPath>
      </defs>
    </svg>
  );
};

/** Toolbar area: workspace name, search toggle, refresh button, upload menu, settings. */
const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  currentView,
  onViewChange,
  t,
  isWorkspaceCollapsed,
  setIsWorkspaceCollapsed,
  isTemporaryWorkspace,
  workspacePath,
  workspaceDisplayName,
  showSearch,
  searchText,
  setSearchText,
  onSearch,
  searchInputRef,
  loading,
  refreshWorkspace,
  handleSelectHostFiles,
  handleUploadDeviceFiles,
  setShowHostFileSelector,
  handleOpenMigrationModal,
  handleOpenWorkspaceRoot,
}) => {
  const workspaceUploadMenu = (
    <Menu
      onClickMenuItem={(key) => {
        if (key === 'host') {
          if (isElectronDesktop()) {
            handleSelectHostFiles();
          } else {
            setShowHostFileSelector(true);
          }
        }
        if (key === 'device') {
          handleUploadDeviceFiles();
        }
      }}
    >
      <Menu.Item key='host'>{t('common.fileAttach.hostFiles')}</Menu.Item>
      <Menu.Item key='device'>{t('common.fileAttach.myDevice')}</Menu.Item>
    </Menu>
  );

  const viewToggleTooltip =
    currentView === 'files' ? t('conversation.workspace.viewChanges') : t('conversation.workspace.viewFiles');

  return (
    <div className='px-12px pt-8px workspace-toolbar-shell'>
      {currentView === 'files' && (showSearch || searchText) && (
        <div className='app-icon-row pb-10px workspace-toolbar-search'>
          <Input
            className='w-full min-w-0 flex-1 workspace-search-input'
            ref={searchInputRef}
            placeholder={t('conversation.workspace.searchPlaceholder')}
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              onSearch(value);
            }}
            allowClear
            prefix={<Search theme='outline' size='14' fill={iconColors.primary} />}
          />
          <Tooltip content={viewToggleTooltip}>
            <Button
              type='secondary'
              shape='circle'
              className='workspace-search-toggle app-icon-button'
              aria-label={viewToggleTooltip}
              onClick={() => onViewChange('changes')}
            >
              <span className='i-icon'>
                <FileText theme='outline' size='16' fill={iconColors.secondary} />
              </span>
            </Button>
          </Tooltip>
        </div>
      )}

      {/* Border divider below search */}
      {!isWorkspaceCollapsed && currentView === 'files' && (showSearch || searchText) && (
        <div className='border-b border-b-base' />
      )}

      {/* Directory name with collapse and action icons */}
      <div className='workspace-toolbar-row flex min-h-32px items-center justify-between gap-8px'>
        <div
          className='flex min-w-0 flex-1 items-center gap-8px cursor-pointer'
          onClick={() => setIsWorkspaceCollapsed(!isWorkspaceCollapsed)}
        >
          <Down
            size={16}
            fill={iconColors.primary}
            className={`line-height-0 block shrink-0 transition-transform duration-200 ${isWorkspaceCollapsed ? '-rotate-90' : 'rotate-0'}`}
          />
          {isTemporaryWorkspace ? (
            <Tooltip content={workspacePath}>
              <span
                role='button'
                tabIndex={0}
                className='workspace-title-label overflow-hidden text-ellipsis whitespace-nowrap font-bold leading-20px text-14px text-t-primary transition-colors hover:text-[rgb(var(--primary-6))] hover:underline underline-offset-3'
                onClick={(event) => {
                  event.stopPropagation();
                  void handleOpenWorkspaceRoot();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleOpenWorkspaceRoot();
                  }
                }}
              >
                {workspaceDisplayName}
              </span>
            </Tooltip>
          ) : (
            <Tooltip content={workspacePath}>
              <span className='workspace-title-label overflow-hidden text-ellipsis whitespace-nowrap font-bold leading-20px text-14px text-t-primary'>
                {workspaceDisplayName}
              </span>
            </Tooltip>
          )}
        </div>
        <div className='workspace-toolbar-actions flex shrink-0 items-center gap-8px'>
          {currentView === 'changes' && (
            <Tooltip content={viewToggleTooltip}>
              <span>
                <Button
                  type='secondary'
                  shape='circle'
                  className='workspace-toolbar-icon-btn workspace-toolbar-nav-btn app-icon-button'
                  aria-label={viewToggleTooltip}
                  onClick={() => onViewChange('files')}
                >
                  <span className='i-icon'>
                    <Left theme='outline' size='16' fill={iconColors.secondary} />
                  </span>
                </Button>
              </span>
            </Tooltip>
          )}
          {!isElectronDesktop() && (
            <Dropdown droplist={workspaceUploadMenu} trigger='click' position='bl'>
              <span>
                <Plus
                  className='workspace-toolbar-icon-btn lh-[1] flex cursor-pointer'
                  theme='outline'
                  size='16'
                  fill={iconColors.secondary}
                />
              </span>
            </Dropdown>
          )}
          {isTemporaryWorkspace && (
            <Tooltip content={t('conversation.workspace.changeWorkspace')}>
              <span>
                <ChangeWorkspaceIcon
                  className='workspace-toolbar-icon-btn line-height-0 cursor-pointer w-24px h-24px flex-shrink-0'
                  onClick={handleOpenMigrationModal}
                />
              </span>
            </Tooltip>
          )}
          <Tooltip content={t('conversation.workspace.refresh')}>
            <span>
              <Refresh
                className={
                  loading
                    ? 'workspace-toolbar-icon-btn loading lh-[1] flex cursor-pointer'
                    : 'workspace-toolbar-icon-btn flex cursor-pointer'
                }
                theme='outline'
                size='16'
                fill={iconColors.secondary}
                onClick={() => refreshWorkspace()}
              />
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceToolbar;
