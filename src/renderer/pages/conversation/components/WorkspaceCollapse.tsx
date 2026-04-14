/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Down } from '@icon-park/react';
import classNames from 'classnames';
import React from 'react';

interface WorkspaceCollapseProps {
  /** 是否展开 */
  expanded: boolean;
  /** 切换展开状态的回调 */
  onToggle: () => void;
  /** 折叠面板的标题 */
  header: React.ReactNode;
  /** 头部右侧操作 */
  headerActions?: React.ReactNode;
  /** 折叠面板的内容 */
  children: React.ReactNode;
  /** 额外的类名 */
  className?: string;
  /** 侧栏是否折叠 - 折叠时隐藏组标题并移除缩进 */
  siderCollapsed?: boolean;
}

/**
 * 工作空间折叠组件 - 简单的折叠面板，用于工作空间分组
 */
const WorkspaceCollapse: React.FC<WorkspaceCollapseProps> = ({
  expanded,
  onToggle,
  header,
  headerActions,
  children,
  className,
  siderCollapsed = false,
}) => {
  // 侧栏折叠时，强制展开内容并隐藏头部
  const showContent = siderCollapsed || expanded;

  return (
    <div className={classNames('workspace-collapse w-full min-w-0', className)}>
      {/* 折叠头部 - 侧栏折叠时隐藏 */}
      {!siderCollapsed && (
        <div
          className='group flex h-32px w-full min-w-0 cursor-pointer items-center gap-8px rounded-4px pl-8px pr-18px py-4px transition-colors hover:bg-hover'
          onClick={onToggle}
        >
          {/* 展开/收起箭头 */}
          <Down
            size={16}
            className={classNames(
              'line-height-0 transition-transform duration-200 flex-shrink-0',
              expanded ? 'rotate-0' : '-rotate-90'
            )}
          />

          {/* 标题内容 */}
          <div className='ml-6px flex-1 min-w-0 overflow-hidden'>{header}</div>

          {headerActions ? (
            <div className='ml-0 max-w-0 shrink-0 overflow-hidden opacity-0 transition-[max-width,opacity,margin] duration-150 group-hover:ml-12px group-hover:max-w-64px group-hover:opacity-100 group-focus-within:ml-12px group-focus-within:max-w-64px group-focus-within:opacity-100'>
              {headerActions}
            </div>
          ) : null}
        </div>
      )}

      {/* 折叠内容 - 侧栏折叠时移除左边距 */}
      {showContent && <div className='workspace-collapse-content w-full min-w-0'>{children}</div>}
    </div>
  );
};

export default WorkspaceCollapse;
