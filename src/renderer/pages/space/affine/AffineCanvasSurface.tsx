import '@toeverything/theme/fonts.css';
import '@toeverything/theme/style.css';

import { Button, Empty, Tag } from '@arco-design/web-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createAffineCanvasRuntime } from './createAffineCanvasRuntime.js';
import type { SpaceAffineCanvasProjection, SpaceAffineCanvasSelectionItem } from './types';
import styles from './AffineCanvasSurface.module.css';

type AffineCanvasSurfaceProps = {
  projection: SpaceAffineCanvasProjection;
  projectCount: number;
  sessionCount: number;
  runningCount: number;
  onOpenSession: (conversationId: string) => void;
};

const AffineCanvasSurface: React.FC<AffineCanvasSurfaceProps> = ({
  projection,
  projectCount,
  sessionCount,
  runningCount,
  onOpenSession,
}) => {
  const { t } = useTranslation();
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const [selectedItem, setSelectedItem] = useState<SpaceAffineCanvasSelectionItem | null>(null);
  const [surfaceReady, setSurfaceReady] = useState(false);

  const hasProjectActivity = useMemo(
    () => projection.items.some((item) => item.kind === 'project' || item.kind === 'session'),
    [projection.items]
  );

  useEffect(() => {
    const host = editorHostRef.current;
    if (!host) {
      return;
    }

    setSelectedItem(null);
    setSurfaceReady(false);

    let disposed = false;
    let runtime: Awaited<ReturnType<typeof createAffineCanvasRuntime>> | null = null;
    let selectionCleanup: (() => void) | null = null;

    const setup = async () => {
      try {
        runtime = await createAffineCanvasRuntime(projection);
      } catch (error) {
        if (!disposed) {
          console.error('[AffineCanvasSurface] Failed to create canvas runtime:', error);
          setSurfaceReady(true);
        }
        return;
      }

      if (disposed || !runtime) {
        runtime?.destroy();
        return;
      }

      host.replaceChildren(runtime.editor);

      try {
        await runtime.ready();
      } catch (error) {
        if (!disposed) {
          console.error('[AffineCanvasSurface] Failed to initialize canvas runtime:', error);
          setSurfaceReady(true);
        }
        return;
      }

      if (disposed || !runtime) {
        return;
      }

      runtime.fitToScreen();
      selectionCleanup = runtime.subscribeSelection(setSelectedItem);
      setSurfaceReady(true);
    };

    void setup();

    return () => {
      disposed = true;
      selectionCleanup?.();
      runtime?.destroy();
      host.replaceChildren();
    };
  }, [projection]);

  const selectionKindLabel = selectedItem ? t(`space.canvas.${selectedItem.kind}` as const) : null;
  const previewLines = selectedItem ? selectedItem.blocks.slice(1, 4) : [];

  return (
    <div className={styles.surface} data-testid='space-canvas'>
      <div className={`${styles.floatingPanel} ${styles.summaryPanel}`}>
        <h2 className={styles.panelTitle}>{t('space.canvas.title')}</h2>
        <div className={styles.panelText}>{t('space.canvas.summary')}</div>
        <div className={styles.tagRow}>
          <Tag color='arcoblue'>{t('space.overview.projectCount', { count: projectCount })}</Tag>
          <Tag color='green'>{t('space.overview.sessionCount', { count: sessionCount })}</Tag>
          <Tag color='orange'>{t('space.overview.runningCount', { count: runningCount })}</Tag>
        </div>
        <div className={styles.panelText}>{t('space.shell.workbenchHint')}</div>
      </div>

      <div className={`${styles.floatingPanel} ${styles.selectionPanel}`}>
        {selectedItem ? (
          <>
            <div className={styles.tagRow}>
              <Tag color='arcoblue'>{selectionKindLabel}</Tag>
              {selectedItem.status ? <Tag color='green'>{t(`space.canvas.status.${selectedItem.status}`)}</Tag> : null}
              {selectedItem.backend ? (
                <Tag color='purple'>{t(`space.canvas.backends.${selectedItem.backend}`)}</Tag>
              ) : null}
            </div>
            <h3 className={styles.panelTitle}>{selectedItem.title}</h3>
            <div className={styles.previewList}>
              {previewLines.map((block, index) => (
                <div className={styles.previewLine} key={`${selectedItem.itemId}:${index}`}>
                  {block.text}
                </div>
              ))}
            </div>
            {selectedItem.workingDirectory ? (
              <div className={styles.pathText}>{selectedItem.workingDirectory}</div>
            ) : null}
            {selectedItem.conversationId ? (
              <div className={styles.actionRow}>
                <Button size='small' type='primary' onClick={() => onOpenSession(selectedItem.conversationId!)}>
                  {t('space.canvas.openSession')}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <h3 className={styles.panelTitle}>{t('space.canvas.gestureHint')}</h3>
            <div className={styles.panelText}>{t('space.canvas.emptyDescription')}</div>
          </>
        )}
      </div>

      <div className={styles.editorHost} ref={editorHostRef} />

      {!hasProjectActivity && surfaceReady ? (
        <div className={styles.emptyState}>
          <Empty description={t('space.canvas.emptyDescription')} />
        </div>
      ) : null}
    </div>
  );
};

export default AffineCanvasSurface;
