import { Button, Card, Empty, List, Space, Tag, Typography } from '@arco-design/web-react';
import { useEffect, useState } from 'react';
import type { AffineDocRef, AffineEmbedDescriptor, AffineProviderStatus, IAffineSpaceProvider } from './IAffineSpaceProvider';
import AffineEmbedContainer from './AffineEmbedContainer';

const { Paragraph, Text } = Typography;

type AffineDocSurfaceProps = {
  spaceId: string;
  docs: readonly AffineDocRef[];
  provider: IAffineSpaceProvider;
  status?: AffineProviderStatus;
  onCreated?: (doc: AffineDocRef) => void;
};

export default function AffineDocSurface(props: AffineDocSurfaceProps) {
  const [activeDocId, setActiveDocId] = useState<string | undefined>(props.docs[0]?.id);
  const [embedDescriptor, setEmbedDescriptor] = useState<AffineEmbedDescriptor | undefined>();

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
        <Card size='small' title='AFFiNE Doc Surface'>
          <Space direction='vertical' size='small' className='w-full'>
            <Tag color='arcoblue'>{props.status.mode}</Tag>
            <Paragraph className='mb-0'>{props.status.description}</Paragraph>
            <Space>
              <Button type='primary' size='small' onClick={() => void handleCreate()}>
                New Doc
              </Button>
              <Button size='small' onClick={() => void props.provider.openDoc(props.spaceId, activeDocId)}>
                Open in AFFiNE
              </Button>
            </Space>
          </Space>
        </Card>
        <AffineEmbedContainer descriptor={embedDescriptor} />
      </Space>
    );
  }

  return (
    <Space direction='vertical' size='medium' className='w-full'>
      <Card size='small' title='AFFiNE Doc Surface'>
        <Space direction='vertical' size='small' className='w-full'>
          <Tag color='arcoblue'>{props.status?.mode || 'shell'}</Tag>
          <Text type='secondary'>
            {props.status?.webAppUrl ? `Connected to ${props.status.webAppUrl}` : 'AFFiNE URL not configured yet'}
          </Text>
          <Paragraph className='mb-0'>
            {props.status?.description || 'Doc surface shell ready for AFFiNE embedding.'}
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
            dataSource={props.docs}
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
