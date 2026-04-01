import React from 'react';
import { Button, Card, Empty, List, Space, Tag, Typography } from '@arco-design/web-react';
import { useEffect, useState } from 'react';
import type {
  ContextGoDocRef,
  ContextGoEmbedDescriptor,
  ContextGoSurfaceStatus,
  IContextGoSpaceProvider,
} from './IContextGoSpaceProvider';
import ContextGoEmbedContainer from './ContextGoEmbedContainer';

const { Paragraph, Text } = Typography;

type ContextGoDocsSurfaceProps = {
  spaceId: string;
  docs: readonly ContextGoDocRef[];
  provider: IContextGoSpaceProvider;
  status?: ContextGoSurfaceStatus;
  onCreated?: (doc: ContextGoDocRef) => void;
};

export default function ContextGoDocsSurface(props: ContextGoDocsSurfaceProps) {
  const [activeDocId, setActiveDocId] = useState<string | undefined>(props.docs[0]?.id);
  const [embedDescriptor, setEmbedDescriptor] = useState<ContextGoEmbedDescriptor | undefined>();

  useEffect(() => {
    if (!activeDocId) {
      setEmbedDescriptor(undefined);
      return;
    }

    let cancelled = false;
    void props.provider
      .getEmbedDescriptor({ kind: 'doc', spaceId: props.spaceId, entityId: activeDocId })
      .then((descriptor) => {
        if (!cancelled) {
          setEmbedDescriptor(descriptor);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeDocId, props.provider, props.spaceId]);

  useEffect(() => {
    if (!activeDocId && props.docs[0]?.id) {
      setActiveDocId(props.docs[0].id);
    }
  }, [activeDocId, props.docs]);

  const handleCreate = async () => {
    const doc = await props.provider.createDoc(props.spaceId, `New Doc ${props.docs.length + 1}`);
    props.onCreated?.(doc);
    setActiveDocId(doc.id);
  };

  if (props.status?.mode === 'embedded' && activeDocId && embedDescriptor) {
    return (
      <Space direction='vertical' size='medium' className='w-full'>
        <Card size='small' title='Space Docs'>
          <Space direction='vertical' size='small' className='w-full'>
            <Tag color='arcoblue'>{props.status.mode}</Tag>
            <Paragraph className='mb-0'>{props.status.description}</Paragraph>
            <Space>
              <Button type='primary' size='small' onClick={() => void handleCreate()}>
                New Doc
              </Button>
              <Button size='small' onClick={() => void props.provider.openDoc(props.spaceId, activeDocId)}>
                Open Document
              </Button>
            </Space>
          </Space>
        </Card>
        <ContextGoEmbedContainer descriptor={embedDescriptor} />
      </Space>
    );
  }

  return (
    <Space direction='vertical' size='medium' className='w-full'>
      <Card size='small' title='Space Docs'>
        <Space direction='vertical' size='small' className='w-full'>
          <Tag color='arcoblue'>{props.status?.mode || 'shell'}</Tag>
          <Text type='secondary'>
            {props.status?.webAppUrl ? `Connected to ${props.status.webAppUrl}` : 'Canvas URL not configured yet'}
          </Text>
          <Paragraph className='mb-0'>
            {props.status?.description || 'Document surface shell ready for native canvas integration.'}
          </Paragraph>
          <Space>
            <Button type='primary' size='small' onClick={() => void handleCreate()}>
              New Doc
            </Button>
          </Space>
        </Space>
      </Card>
      <Card size='small' title={`Docs (${props.docs.length})`}>
        {props.docs.length === 0 ? (
          <Empty description='No docs yet' />
        ) : (
          <List
            dataSource={[...props.docs]}
            render={(item) => (
              <List.Item key={item.id}>
                <Space className='w-full justify-between'>
                  <Space direction='vertical' size={2} className='w-full'>
                    <Text>{item.title}</Text>
                    {item.preview ? <Text type='secondary'>{item.preview}</Text> : null}
                  </Space>
                  <Space>
                    <Button size='mini' onClick={() => setActiveDocId(item.id)}>
                      Select
                    </Button>
                    <Button size='mini' onClick={() => void props.provider.openDoc(props.spaceId, item.id)}>
                      Open
                    </Button>
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
}
