import React from 'react';
import { Card, Empty, Typography } from '@arco-design/web-react';
import type { ContextGoEmbedDescriptor } from './IContextGoSpaceProvider';

const { Text } = Typography;

type ContextGoEmbedContainerProps = {
  descriptor: ContextGoEmbedDescriptor;
  height?: number;
};

export default function ContextGoEmbedContainer(props: ContextGoEmbedContainerProps) {
  if (props.descriptor.mode === 'placeholder' || !props.descriptor.src) {
    return (
      <Card size='small' title={props.descriptor.title}>
        <Empty description='Embedded canvas surface not ready yet' />
      </Card>
    );
  }

  return (
    <Card size='small' title={props.descriptor.title} bodyStyle={{ padding: 0 }}>
      <div className='flex flex-col' style={{ height: props.height ?? 520 }}>
        <div className='border-b border-[var(--border-base)] px-12px py-8px'>
          <Text type='secondary'>{props.descriptor.src}</Text>
        </div>
        <iframe
          title={props.descriptor.title}
          src={props.descriptor.src}
          className='h-full w-full border-0 bg-white'
          sandbox='allow-same-origin allow-scripts allow-forms allow-downloads allow-popups'
        />
      </div>
    </Card>
  );
}
