import { Card, Empty, List, Space, Tag, Typography } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  IContextMemoryCandidateView,
  IContextMemoryView,
  IContextProfileView,
} from '@/common/adapter/ipcBridge';

const { Paragraph, Text } = Typography;

type SpaceContextPanelProps = {
  docsCount: number;
  boardsCount: number;
  threadCount: number;
  acceptedMemories: readonly IContextMemoryView[];
  profiles: readonly IContextProfileView[];
  pendingCandidates: readonly IContextMemoryCandidateView[];
  selectionSummary: string;
  compact?: boolean;
};

function renderPriorityTag(priority: string): string {
  return priority;
}

export default function SpaceContextPanel(props: SpaceContextPanelProps) {
  const { t } = useTranslation();
  const queuePreview = props.pendingCandidates.slice(0, props.compact ? 4 : 8);
  const acceptedPreview = props.acceptedMemories.slice(0, props.compact ? 4 : 8);
  const profilePreview = props.profiles.slice(0, props.compact ? 3 : 6);

  return (
    <div className='flex flex-col gap-4'>
      <Card size='small' title={t('space.context.activeTitle')}>
        <Space direction='vertical' size='small' className='w-full'>
          <Paragraph className='mb-0 text-13px text-t-secondary'>{t('space.context.activeDescription')}</Paragraph>
          <div className='grid grid-cols-2 gap-2'>
            <Tag color='arcoblue'>
              {t('space.context.stats.threads')}: {props.threadCount}
            </Tag>
            <Tag color='green'>
              {t('space.context.stats.docs')}: {props.docsCount}
            </Tag>
            <Tag color='gold'>
              {t('space.context.stats.boards')}: {props.boardsCount}
            </Tag>
            <Tag color='red'>
              {t('space.context.stats.candidates')}: {props.pendingCandidates.length}
            </Tag>
          </div>
          <div>
            <Text className='text-12px font-600 text-t-primary'>{t('space.context.selectionTitle')}</Text>
            <Paragraph className='mb-0 mt-4px text-13px text-t-secondary'>
              {props.selectionSummary || t('space.context.selectionEmpty')}
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Card size='small' title={t('space.context.durableTitle')}>
        <Space direction='vertical' size='small' className='w-full'>
          <Paragraph className='mb-0 text-13px text-t-secondary'>{t('space.context.durableDescription')}</Paragraph>
          <div className='rounded-12px bg-[var(--color-fill-1)] px-12px py-10px'>
            <Text className='text-12px font-600 text-t-primary'>{t('space.context.layers.memories')}</Text>
            <Paragraph className='mb-0 mt-4px text-12px text-t-secondary'>
              {t('space.context.layers.memoriesHint')}
            </Paragraph>
          </div>
          {acceptedPreview.length === 0 ? (
            <Empty description={t('space.context.acceptedEmpty')} />
          ) : (
            <List
              dataSource={[...acceptedPreview]}
              render={(item) => (
                <List.Item key={item.id}>
                  <Space direction='vertical' size={2} className='w-full'>
                    <Text>{item.summary}</Text>
                    <Text type='secondary'>
                      {item.kind} · {item.tier} · {renderPriorityTag(item.priority)}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          )}

          <div className='rounded-12px bg-[var(--color-fill-1)] px-12px py-10px'>
            <Text className='text-12px font-600 text-t-primary'>{t('space.context.layers.profiles')}</Text>
            <Paragraph className='mb-0 mt-4px text-12px text-t-secondary'>
              {t('space.context.layers.profilesHint')}
            </Paragraph>
          </div>
          {profilePreview.length === 0 ? (
            <Empty description={t('space.context.profilesEmpty')} />
          ) : (
            <List
              dataSource={[...profilePreview]}
              render={(item) => (
                <List.Item key={item.id}>
                  <Space direction='vertical' size={2} className='w-full'>
                    <Text>{item.summary}</Text>
                    <Text type='secondary'>
                      {item.key} · {Math.round(item.confidence * 100)}%
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Space>
      </Card>

      <Card size='small' title={t('space.context.governanceTitle')}>
        <Space direction='vertical' size='small' className='w-full'>
          <Paragraph className='mb-0 text-13px text-t-secondary'>{t('space.context.governanceDescription')}</Paragraph>
          <Tag>{t('space.context.rules.reviewers')}</Tag>
          <Tag>{t('space.context.rules.decisions')}</Tag>
          <Tag>{t('space.context.rules.provenance')}</Tag>
        </Space>
      </Card>

      <Card size='small' title={t('space.context.queueTitle')}>
        {queuePreview.length === 0 ? (
          <Empty description={t('space.context.queueEmpty')} />
        ) : (
          <List
            dataSource={[...queuePreview]}
            render={(item) => (
              <List.Item key={item.id}>
                <Space direction='vertical' size={2} className='w-full'>
                  <Text>{item.summary}</Text>
                  <Text type='secondary'>
                    {item.reviewStatus} · {item.tier} · score {item.promotionScore}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
