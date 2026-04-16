import { Button, Empty, Spin, Typography } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceChanges } from './useWorkspaceChanges';

type WorkspaceChangesProps = {
  workspace: string;
  openPreview: (content: string, type: 'diff', metadata?: Record<string, unknown>) => void;
};

const WorkspaceChanges: React.FC<WorkspaceChangesProps> = ({ workspace, openPreview }) => {
  const { t } = useTranslation();
  const { changes, isRepository, loading, openChangePreview } = useWorkspaceChanges({
    workspace,
    openPreview,
  });

  if (loading) {
    return (
      <div className='flex flex-1 items-center justify-center p-16px'>
        <Spin />
      </div>
    );
  }

  if (!isRepository) {
    return (
      <div className='flex flex-1 items-center justify-center p-16px'>
        <Empty description={t('conversation.workspace.changesNotRepository')} />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className='flex flex-1 items-center justify-center p-16px'>
        <Empty description={t('conversation.workspace.changesEmpty')} />
      </div>
    );
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-y-auto px-12px py-8px'>
      <div className='flex flex-col gap-8px'>
        {changes.map((change) => (
          <Button
            key={`${change.status}:${change.absolutePath}`}
            type='text'
            className='!h-auto !justify-start rounded-12px border border-[var(--border-base)] bg-[var(--color-bg-1)] px-12px py-10px text-left'
            aria-label={change.path}
            onClick={() => {
              void openChangePreview(change);
            }}
          >
            <div className='flex min-w-0 flex-1 items-center justify-between gap-8px'>
              <Typography.Text className='truncate'>{change.path}</Typography.Text>
              <Typography.Text className='shrink-0 text-t-secondary'>{change.status}</Typography.Text>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default WorkspaceChanges;
