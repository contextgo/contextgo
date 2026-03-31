import { Card, Empty, Typography } from '@arco-design/web-react';
import type { AffineEmbedDescriptor } from './IAffineSpaceProvider';

const { Paragraph, Text } = Typography;

type AffineEmbedContainerProps = {
  descriptor: AffineEmbedDescriptor;
  height?: number;
};

export default function AffineEmbedContainer(props: AffineEmbedContainerProps) {
  if (props.descriptor.mode === 'placeholder' || !props.descriptor.src) {
    return (
      <Card size='small' title={props.descriptor.title}>
        <Empty description='Embedded AFFiNE surface not ready yet' />
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
