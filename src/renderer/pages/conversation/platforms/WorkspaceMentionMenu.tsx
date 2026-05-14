/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '@arco-design/web-react';
import React from 'react';
import type { WorkspaceMentionItem } from '@/renderer/utils/file/workspaceMentions';

type WorkspaceMentionMenuProps = {
  items: WorkspaceMentionItem[];
  activeIndex: number;
  onSelect: (item: WorkspaceMentionItem) => void;
};

const WorkspaceMentionMenu: React.FC<WorkspaceMentionMenuProps> = ({ items, activeIndex, onSelect }) => {
  return (
    <div className='rounded-12px border border-solid b-border-2 bg-dialog-fill-0 p-6px shadow-lg'>
      <div className='flex flex-col gap-2px'>
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <Button
              key={item.path}
              type='text'
              className={`!h-auto !justify-start !rounded-10px !px-10px !py-8px text-left ${
                isActive ? '!bg-fill-2' : ''
              }`}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(item);
              }}
            >
              <span className='flex min-w-0 flex-col items-start'>
                <span className='truncate text-13px text-t-primary'>{item.name}</span>
                <span className='truncate text-12px text-t-secondary'>{item.relativePath}</span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default WorkspaceMentionMenu;
