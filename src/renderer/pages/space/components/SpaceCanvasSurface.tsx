import { Button, Empty, Tag } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpaceCanvasViewport } from '../hooks/useSpaceCanvasViewport';
import type {
  SpaceCanvasBoard,
  SpaceCanvasBoardNode,
  SpaceCanvasBoardProjectNode,
  SpaceCanvasBoardSessionNode,
  SpaceCanvasBoardSummaryNode,
} from '../utils/spaceCanvasBoard';
import styles from './SpaceCanvasSurface.module.css';

type SpaceCanvasSurfaceProps = {
  board: SpaceCanvasBoard;
  projectCount: number;
  sessionCount: number;
  runningCount: number;
  onOpenSession: (conversationId: string) => void;
};

type SceneBounds = {
  width: number;
  height: number;
};

const getSceneBounds = (nodes: SpaceCanvasBoardNode[]): SceneBounds => {
  if (nodes.length === 0) {
    return { width: 1120, height: 760 };
  }

  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return {
    width: Math.max(1120, maxX + 220),
    height: Math.max(760, maxY + 220),
  };
};

const getProjectSummaryKey = (node: SpaceCanvasBoardProjectNode): string => {
  return node.runningCount > 0 ? 'space.canvas.projectSummaryRunning' : 'space.canvas.projectSummary';
};

const getSummaryTitleKey = (node: SpaceCanvasBoardSummaryNode): string => {
  return node.kind === 'memory' ? 'space.canvas.memory' : 'space.canvas.profile';
};

const getSummarySubtitleKey = (node: SpaceCanvasBoardSummaryNode): string => {
  return node.kind === 'memory' ? 'space.canvas.memorySummary' : 'space.canvas.profileSummary';
};

const getBackendLabelKey = (node: SpaceCanvasBoardSessionNode): string => {
  return `space.canvas.backends.${node.backend}`;
};

const renderSessionStatusTag = (
  translate: (key: string, options?: Record<string, unknown>) => string,
  node: SpaceCanvasBoardSessionNode
) => {
  const color = node.status === 'running' ? 'green' : 'gray';
  return <Tag color={color}>{translate(`space.canvas.status.${node.status}`)}</Tag>;
};

const SpaceCanvasSurface: React.FC<SpaceCanvasSurfaceProps> = ({
  board,
  projectCount,
  sessionCount,
  runningCount,
  onOpenSession,
}) => {
  const { t } = useTranslation();
  const {
    surfaceRef,
    viewport,
    dragging,
    zoomIn,
    zoomOut,
    resetViewport,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleWheel,
  } = useSpaceCanvasViewport();

  const sceneBounds = useMemo(() => getSceneBounds(board.nodes), [board.nodes]);
  const nodeMap = useMemo(() => new Map(board.nodes.map((node) => [node.id, node])), [board.nodes]);
  const hasProjectContent = useMemo(() => board.nodes.some((node) => node.kind === 'project'), [board.nodes]);

  const renderProjectNode = (node: SpaceCanvasBoardProjectNode) => {
    return (
      <div
        className={`${styles.nodeCard} ${styles.projectCard}`}
        data-testid='space-canvas-project-node'
        key={node.id}
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          borderColor: node.accentToken,
        }}
      >
        <div className={styles.kindBadge}>{t('space.canvas.project')}</div>
        <h3 className={styles.nodeTitle}>{node.title}</h3>
        <div className={styles.nodeSubtitle}>
          {t(getProjectSummaryKey(node), {
            sessionCount: node.sessionCount,
            runningCount: node.runningCount,
          })}
        </div>
        {node.workingDirectory ? <div className={styles.nodePath}>{node.workingDirectory}</div> : null}
      </div>
    );
  };

  const renderSessionNode = (node: SpaceCanvasBoardSessionNode) => {
    return (
      <Button
        aria-label={t('space.canvas.openSession')}
        className={styles.sessionButton}
        data-testid='space-canvas-session-node'
        key={node.id}
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
        }}
        type='text'
        onClick={() => {
          onOpenSession(node.conversationId);
        }}
      >
        <div className={`${styles.nodeCard} ${styles.sessionButtonInner}`} style={{ borderColor: node.accentToken }}>
          <div className={styles.kindBadge}>{t('space.canvas.session')}</div>
          <h3 className={styles.nodeTitle}>{node.title}</h3>
          <div className={styles.sessionMeta}>
            <Tag color='arcoblue'>{t(getBackendLabelKey(node))}</Tag>
            {renderSessionStatusTag(t, node)}
          </div>
          <div className={styles.sessionAction}>{t('space.canvas.openSession')}</div>
        </div>
      </Button>
    );
  };

  const renderSummaryNode = (node: SpaceCanvasBoardSummaryNode) => {
    return (
      <div
        className={`${styles.nodeCard} ${styles.summaryCard}`}
        data-testid={`space-canvas-${node.kind}-node`}
        key={node.id}
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          borderColor: node.accentToken,
        }}
      >
        <div className={styles.kindBadge}>{t(getSummaryTitleKey(node))}</div>
        <h3 className={styles.nodeTitle}>{t(getSummaryTitleKey(node))}</h3>
        <div className={styles.nodeSubtitle}>{t(getSummarySubtitleKey(node), { count: node.count })}</div>
      </div>
    );
  };

  const renderNode = (node: SpaceCanvasBoardNode) => {
    if (node.kind === 'project') {
      return renderProjectNode(node);
    }

    if (node.kind === 'session') {
      return renderSessionNode(node);
    }

    return renderSummaryNode(node);
  };

  const renderEdge = (edge: SpaceCanvasBoard['edges'][number]) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) {
      return null;
    }

    if (edge.kind === 'contains') {
      const startX = from.x + from.width / 2;
      const startY = from.y + from.height;
      const endX = to.x + to.width / 2;
      const endY = to.y;
      const midY = (startY + endY) / 2;
      return (
        <path
          className={styles.edgePath}
          d={`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
          key={edge.id}
        />
      );
    }

    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;
    const midX = (startX + endX) / 2;
    return (
      <path
        className={styles.edgePath}
        d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
        key={edge.id}
      />
    );
  };

  return (
    <div className={styles.surface} data-testid='space-canvas'>
      <div className={`${styles.floatingPanel} ${styles.summaryPanel}`}>
        <h2 className={styles.summaryTitle}>{t('space.canvas.title')}</h2>
        <div className={styles.summaryText}>{t('space.canvas.summary')}</div>
        <div className={styles.tagRow}>
          <Tag color='arcoblue'>{t('space.overview.projectCount', { count: projectCount })}</Tag>
          <Tag color='green'>{t('space.overview.sessionCount', { count: sessionCount })}</Tag>
          <Tag color='orange'>{t('space.overview.runningCount', { count: runningCount })}</Tag>
        </div>
        <div className={styles.summaryText}>{t('space.canvas.gestureHint')}</div>
      </div>

      <div className={`${styles.floatingPanel} ${styles.toolbar}`}>
        <Button size='small' type='secondary' onClick={zoomOut}>
          -
        </Button>
        <div className={styles.scaleText}>{Math.round(viewport.scale * 100)}%</div>
        <Button size='small' type='secondary' onClick={zoomIn}>
          +
        </Button>
        <Button size='small' type='secondary' onClick={resetViewport}>
          {t('space.canvas.resetView')}
        </Button>
      </div>

      <div
        className={classNames(styles.viewport, dragging && styles.viewportDragging)}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        ref={surfaceRef}
      >
        {hasProjectContent ? (
          <div
            className={styles.scene}
            style={{
              width: `${sceneBounds.width}px`,
              height: `${sceneBounds.height}px`,
              transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
            }}
          >
            <svg className={styles.edges} height={sceneBounds.height} width={sceneBounds.width}>
              {board.edges.map(renderEdge)}
            </svg>
            {board.nodes.map(renderNode)}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Empty
              description={
                <div>
                  <div>{t('space.canvas.emptyTitle')}</div>
                  <div className={styles.summaryText}>{t('space.canvas.emptyDescription')}</div>
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SpaceCanvasSurface;
