/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { joinPath } from '@/common/chat/chatLib';
import type { GroupCollaborationConfig, GroupOrchestration } from '@/common/config/storage';
import { buildHarnessArtifactPaths, type HarnessArtifactManifest } from '@/common/utils';
import { usePreviewContext } from '@/renderer/pages/conversation/Preview';
import { Button, Spin, Typography } from '@arco-design/web-react';
import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type HarnessRunSummaryCardProps = {
  conversationId: string;
  workspace?: string;
  running: boolean;
  collaboration?: GroupCollaborationConfig;
  orchestration?: GroupOrchestration;
};

const formatUpdatedAt = (value: string): string => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
};

const resolveStatusLabelKey = (status: HarnessArtifactManifest['status'] | 'pending'): string => {
  if (status === 'running') {
    return 'conversation.workspace.groupMembers.status.running';
  }
  if (status === 'finished') {
    return 'conversation.workspace.groupMembers.status.finished';
  }
  if (status === 'stopped') {
    return 'conversation.workspace.groupMembers.status.stopped';
  }
  if (status === 'error') {
    return 'conversation.workspace.groupMembers.status.error';
  }
  return 'conversation.workspace.groupMembers.status.pending';
};

const resolveRoleLabelKey = (role: HarnessArtifactManifest['rounds'][number]['role']): string => {
  return `conversation.group.role.${role}`;
};

const HarnessRunSummaryCard = ({
  conversationId,
  workspace,
  running,
  collaboration,
  orchestration,
}: HarnessRunSummaryCardProps) => {
  const { t } = useTranslation();
  const { openPreview } = usePreviewContext();
  const [manifest, setManifest] = useState<HarnessArtifactManifest | null>(null);
  const [loading, setLoading] = useState(false);

  const isHarnessMode = collaboration?.mode === 'planner-generator-evaluator';
  const artifactPaths = useMemo(() => buildHarnessArtifactPaths(conversationId), [conversationId]);
  const latestRound = manifest?.rounds[manifest.rounds.length - 1] || null;

  useEffect(() => {
    if (!isHarnessMode || !workspace) {
      setManifest(null);
      return;
    }

    let cancelled = false;

    const loadManifest = async () => {
      setLoading(true);
      try {
        const absolutePath = joinPath(workspace, artifactPaths.manifestFile);
        const content = await ipcBridge.fs.readFile.invoke({ path: absolutePath }).catch((): null => null);
        if (cancelled) {
          return;
        }

        if (!content) {
          setManifest(null);
          return;
        }

        setManifest(JSON.parse(content) as HarnessArtifactManifest);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load harness artifact manifest:', error);
          setManifest(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadManifest();

    if (!running) {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(() => {
      void loadManifest();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [artifactPaths.manifestFile, isHarnessMode, running, workspace]);

  if (!isHarnessMode) {
    return null;
  }

  const openArtifactPreview = async (relativePath: string, contentType: 'markdown' | 'code') => {
    if (!workspace) {
      return;
    }

    const absolutePath = joinPath(workspace, relativePath);
    const content = await ipcBridge.fs.readFile.invoke({ path: absolutePath }).catch((): null => null);
    if (!content) {
      return;
    }

    openPreview(content, contentType, {
      title: relativePath.split('/').pop() || relativePath,
      fileName: relativePath.split('/').pop() || relativePath,
      filePath: absolutePath,
      workspace,
      editable: false,
      language: contentType === 'code' ? 'json' : 'markdown',
    });
  };

  const openArtifactFolder = async () => {
    if (!workspace) {
      return;
    }

    await ipcBridge.shell.openFile.invoke(joinPath(workspace, artifactPaths.rootDir));
  };

  return (
    <div className='mx-auto mb-12px w-full max-w-980px rounded-18px border border-border-2 bg-[var(--color-bg-1)] px-16px py-14px'>
      <div className='flex items-start justify-between gap-12px'>
        <div className='min-w-0'>
          <Typography.Text className='block text-13px font-semibold text-t-primary'>
            {t('conversation.group.summary.title')}
          </Typography.Text>
          <Typography.Text className='text-12px text-t-secondary'>
            {manifest
              ? t(resolveStatusLabelKey(manifest.status))
              : running
                ? t('conversation.group.summary.loading')
                : t('conversation.group.summary.empty')}
          </Typography.Text>
        </div>
        {loading ? <Spin size={14} /> : null}
      </div>

      {manifest ? (
        <>
          <div className='mt-10px grid grid-cols-[auto,1fr] gap-x-8px gap-y-6px text-12px text-t-secondary'>
            <span>{t('conversation.group.summary.updatedAt')}</span>
            <span className='text-t-primary'>{formatUpdatedAt(manifest.updatedAt)}</span>
            <span>{t('conversation.group.summary.completedSteps')}</span>
            <span className='text-t-primary'>{manifest.rounds.length}</span>
            <span>{t('conversation.group.summary.flow')}</span>
            <span className='text-t-primary'>
              {t(
                `conversation.group.mode${manifest.orchestrationMode.charAt(0).toUpperCase()}${manifest.orchestrationMode.slice(1)}`
              )}{' '}
              · {orchestration?.kind === 'discussion' ? orchestration.rounds : 2}
            </span>
            {latestRound ? (
              <>
                <span>{t('conversation.group.summary.latestStep')}</span>
                <span className='text-t-primary'>
                  {t('conversation.group.roundLabel', { round: latestRound.round })} ·{' '}
                  {t(resolveRoleLabelKey(latestRound.role))} · {latestRound.participantName}
                </span>
              </>
            ) : null}
            {manifest.executionBoundary.type === 'git-repository' ? (
              <>
                <span>{t('conversation.group.summary.repository')}</span>
                <span className='break-all text-t-primary'>{manifest.executionBoundary.repositoryRoot}</span>
              </>
            ) : null}
          </div>

          <div className='mt-10px flex flex-wrap gap-6px'>
            <Button
              size='mini'
              type='secondary'
              onClick={() => void openArtifactPreview(artifactPaths.plannerFile, 'markdown')}
            >
              {t('conversation.workspace.groupMembers.artifacts.planner')}
            </Button>
            <Button
              size='mini'
              type='secondary'
              onClick={() => void openArtifactPreview(artifactPaths.generatorFile, 'markdown')}
            >
              {t('conversation.workspace.groupMembers.artifacts.generator')}
            </Button>
            <Button
              size='mini'
              type='secondary'
              onClick={() => void openArtifactPreview(artifactPaths.evaluatorFile, 'markdown')}
            >
              {t('conversation.workspace.groupMembers.artifacts.evaluator')}
            </Button>
            <Button
              size='mini'
              type='secondary'
              onClick={() => void openArtifactPreview(artifactPaths.manifestFile, 'code')}
            >
              {t('conversation.workspace.groupMembers.artifacts.manifest')}
            </Button>
            <Button size='mini' type='secondary' onClick={() => void openArtifactFolder()}>
              {t('conversation.workspace.groupMembers.artifacts.folder')}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default HarnessRunSummaryCard;
