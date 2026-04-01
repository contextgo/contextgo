import { Alert, Card, Spin, Typography } from '@arco-design/web-react';
import React, { useEffect, useRef, useState } from 'react';
import { getSpaceContentRuntimeConfig } from '../spaceContentRuntimeConfig';
import {
  probeContextGoNativeCanvasRuntime,
  type ContextGoNativeCanvasProbeResult,
} from './blocksuiteRuntime';

const { Paragraph, Text } = Typography;

type ContextGoNativeCanvasHostProps = {
  spaceId: string;
  boardId?: string;
  selectionSummary?: string;
};

export default function ContextGoNativeCanvasHost(props: ContextGoNativeCanvasHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [probe, setProbe] = useState<ContextGoNativeCanvasProbeResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const runtimeConfig = getSpaceContentRuntimeConfig();

    void probeContextGoNativeCanvasRuntime(runtimeConfig.localSourcePath).then(async (result) => {
      if (cancelled) {
        return;
      }

      setProbe(result);
      if (result.status !== 'available' || !containerRef.current) {
        return;
      }

      const mounted = await result.runtime.mountCanvas({
        container: containerRef.current,
        spaceId: props.spaceId,
        boardId: props.boardId,
        selectionSummary: props.selectionSummary,
      });
      destroy = mounted.destroy;
    });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [props.boardId, props.selectionSummary, props.spaceId]);

  if (!probe) {
    return (
      <Card size='small' title='Space Canvas' bodyStyle={{ minHeight: 360 }}>
        <div className='flex h-full min-h-320px items-center justify-center'>
          <Spin />
        </div>
      </Card>
    );
  }

  if (probe.status === 'unavailable') {
    return (
      <Card size='small' title='Space Canvas'>
        <Alert type='info' content={probe.detail} />
        <Paragraph className='mt-12px mb-0 text-13px text-t-secondary'>
          Native integration is now the preferred path. This panel is the attachment point for absorbed Blocksuite/edgeless code.
        </Paragraph>
      </Card>
    );
  }

  return (
    <Card size='small' title='Space Canvas' bodyStyle={{ padding: 0 }}>
      <div className='border-b border-[var(--border-base)] px-12px py-8px'>
        <Text type='secondary'>{probe.detail}</Text>
      </div>
      <div ref={containerRef} className='min-h-720px w-full bg-[var(--color-bg-1)]' />
    </Card>
  );
}
