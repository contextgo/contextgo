import type { BadgeProps } from '@arco-design/web-react';
import { Tooltip } from '@arco-design/web-react';
import { IconDown, IconRight } from '@arco-design/web-react/icon';
import { DeleteOne, EditTwo, FileText, PreviewOpen, Search, Terminal, Tool, Write } from '@icon-park/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IMessageAcpToolCall, IMessageCodexToolCall, IMessageToolGroup } from '@/common/chat/chatLib';
import { getFileNameFromPath, type FileOperationKind, type ParsedFileOperationMessage } from './MessagetText';
import './MessageToolGroupSummary.css';

type ToolMarkerType = 'read' | 'edit' | 'exec' | 'info' | 'mcp' | 'operation';

type ToolItem = {
  key: string;
  name: string;
  desc: unknown;
  status: BadgeProps['status'];
  marker?: React.ReactNode;
  label?: string;
  input?: string;
  output?: string;
};

export type StepSummaryEntry =
  | {
      type: 'file_operation';
      id: string;
      operation: ParsedFileOperationMessage;
    }
  | {
      type: 'tool';
      id: string;
      message: IMessageToolGroup | IMessageAcpToolCall | IMessageCodexToolCall;
    };

const FILE_OPERATION_ORDER: FileOperationKind[] = ['read', 'written', 'deleted', 'operation'];

const formatValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const normalizeToolText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  return formatValue(value);
};

const getResultDisplayText = (resultDisplay: IMessageToolGroup['content'][0]['resultDisplay']): string | undefined => {
  if (!resultDisplay) return undefined;
  if (typeof resultDisplay === 'string') return resultDisplay;
  if ('fileDiff' in resultDisplay) return resultDisplay.fileDiff;
  if ('img_url' in resultDisplay) return resultDisplay.relative_path || resultDisplay.img_url;
  return undefined;
};

const getToolMarker = (type: ToolMarkerType): React.ReactNode => {
  switch (type) {
    case 'read':
      return <PreviewOpen theme='outline' size='14' fill='currentColor' className='app-icon' />;
    case 'edit':
      return <EditTwo theme='outline' size='14' fill='currentColor' className='app-icon' />;
    case 'exec':
      return <Terminal theme='outline' size='14' fill='currentColor' className='app-icon' />;
    case 'info':
      return <Search theme='outline' size='14' fill='currentColor' className='app-icon' />;
    case 'mcp':
      return <Tool theme='outline' size='14' fill='currentColor' className='app-icon' />;
    default:
      return <FileText theme='outline' size='14' fill='currentColor' className='app-icon' />;
  }
};

const getToolMarkerClassName = (type: ToolMarkerType, status: BadgeProps['status']): string => {
  switch (type) {
    case 'read':
      return 'step-item-icon-chip--read';
    case 'edit':
      return 'step-item-icon-chip--edit';
    case 'exec':
      return 'step-item-icon-chip--exec';
    case 'info':
      return 'step-item-icon-chip--info';
    case 'mcp':
      return 'step-item-icon-chip--mcp';
    default:
      return status === 'error' ? 'step-item-icon-chip--deleted' : 'step-item-icon-chip--operation';
  }
};

const getCodexToolMarkerType = (message: IMessageCodexToolCall): ToolMarkerType => {
  const { kind, subtype, content, data, description } = message.content;

  if (kind === 'patch' || subtype === 'patch_apply_begin' || subtype === 'patch_apply_end' || subtype === 'turn_diff') {
    return 'edit';
  }

  const hasDiffContent =
    Array.isArray(content) && content.some((item) => item.type === 'diff' || Boolean(item.filePath));
  if (hasDiffContent) {
    return 'edit';
  }

  if ('invocation' in data && data.invocation && typeof data.invocation === 'object') {
    return 'mcp';
  }

  if (kind === 'mcp' || subtype === 'mcp_tool_call_begin' || subtype === 'mcp_tool_call_end') {
    return 'mcp';
  }

  if (kind === 'web_search' || subtype === 'web_search_begin' || subtype === 'web_search_end') {
    return 'info';
  }

  if (
    typeof description === 'string' &&
    (/^Edit\b/i.test(description) || /apply_patch/i.test(description) || /patch apply/i.test(description))
  ) {
    return 'edit';
  }

  return 'exec';
};

const mapToolGroupItems = (message: IMessageToolGroup): ToolItem[] => {
  return message.content.map(({ name, callId, description, confirmationDetails, status, resultDisplay }) => {
    let desc = normalizeToolText(description).slice(0, 100);
    const type = confirmationDetails?.type;
    if (type === 'edit') desc = confirmationDetails.fileName;
    if (type === 'exec') desc = confirmationDetails.command;
    if (type === 'info') desc = confirmationDetails.urls?.join(';') || confirmationDetails.title;
    if (type === 'mcp') desc = confirmationDetails.serverName + ':' + confirmationDetails.toolName;

    let input: string | undefined;
    if (confirmationDetails) {
      const { title: _title, type: _type, ...rest } = confirmationDetails;
      if (Object.keys(rest).length) input = formatValue(rest);
    } else {
      const normalizedDescription = normalizeToolText(description);
      if (normalizedDescription) {
        input = normalizedDescription;
      }
    }

    const output = getResultDisplayText(resultDisplay);

    const markerStatus = (
      status === 'Success' ? 'success' : status === 'Error' ? 'error' : status === 'Canceled' ? 'default' : 'processing'
    ) as BadgeProps['status'];

    return {
      key: callId,
      name,
      desc,
      status: markerStatus,
      marker: (
        <span className={'step-item-icon-chip ' + getToolMarkerClassName(type, markerStatus)}>
          {getToolMarker(type)}
        </span>
      ),
      input,
      output,
    };
  });
};

const getAcpToolMarkerType = (message: IMessageAcpToolCall): ToolMarkerType => {
  const kind = message.content.update?.kind;

  switch (kind) {
    case 'read':
      return 'read';
    case 'edit':
      return 'edit';
    case 'execute':
      return 'exec';
    default:
      return 'operation';
  }
};

const mapAcpToolItems = (message: IMessageAcpToolCall): ToolItem[] => {
  const update = message.content.update;
  if (!update) return [];

  const markerType = getAcpToolMarkerType(message);
  const markerStatus =
    update.status === 'completed'
      ? 'success'
      : update.status === 'failed'
        ? 'error'
        : ('processing' as BadgeProps['status']);
  const input = update.rawInput ? formatValue(update.rawInput) : undefined;

  let output: string | undefined;
  if (update.content?.length) {
    output = update.content
      .map((item) => {
        if (item.type === 'content' && item.content?.text) return item.content.text;
        if (item.type === 'diff' && item.path) return '[diff] ' + item.path;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return [
    {
      key: update.toolCallId,
      name: normalizeToolText(update.rawInput?.description) || update.title,
      desc: normalizeToolText(update.rawInput?.command) || update.kind,
      status: markerStatus,
      marker: (
        <span className={'step-item-icon-chip ' + getToolMarkerClassName(markerType, markerStatus)}>
          {getToolMarker(markerType)}
        </span>
      ),
      input,
      output,
    },
  ];
};
const mapCodexToolItems = (message: IMessageCodexToolCall): ToolItem[] => {
  const update = message.content;
  const data = update.data || {};
  const markerType = getCodexToolMarkerType(message);

  const command = 'command' in data && Array.isArray(data.command) ? data.command.join(' ') : undefined;
  const query = 'query' in data && typeof data.query === 'string' ? data.query : undefined;
  const invocation =
    'invocation' in data && data.invocation && typeof data.invocation === 'object' ? data.invocation : null;
  const toolName = invocation ? invocation.tool || invocation.name || invocation.method || undefined : undefined;

  const desc = normalizeToolText(update.description) || command || query || toolName || update.kind;

  const inputParts: string[] = [];
  if (command) inputParts.push(command);
  if (query) inputParts.push(query);
  if (invocation && invocation.arguments !== undefined) {
    inputParts.push(formatValue(invocation.arguments));
  }

  const outputParts = [
    ...(update.content || []).map((item) => {
      if (item.type === 'output' && item.output) return item.output;
      if (item.type === 'text' && item.text) return item.text;
      if (item.type === 'diff' && item.filePath) return '[diff] ' + item.filePath;
      return '';
    }),
    'result' in data && data.result !== undefined ? formatValue(data.result) : '',
    'exit_code' in data && data.exit_code !== undefined ? 'exit_code=' + String(data.exit_code) : '',
  ].filter(Boolean);

  const markerStatus =
    update.status === 'success'
      ? 'success'
      : update.status === 'error'
        ? 'error'
        : update.status === 'canceled'
          ? 'default'
          : ('processing' as BadgeProps['status']);

  return [
    {
      key: update.toolCallId,
      name: update.title || update.kind,
      desc,
      status: markerStatus,
      marker: (
        <span className={'step-item-icon-chip ' + getToolMarkerClassName(markerType, markerStatus)}>
          {getToolMarker(markerType)}
        </span>
      ),
      input: inputParts.length > 0 ? inputParts.join('\n\n') : undefined,
      output: outputParts.length > 0 ? outputParts.join('\n\n') : undefined,
    },
  ];
};

const mapToolStepItems = (message: IMessageToolGroup | IMessageAcpToolCall | IMessageCodexToolCall): ToolItem[] => {
  if (message.type === 'tool_group') return mapToolGroupItems(message);
  if (message.type === 'acp_tool_call') return mapAcpToolItems(message);
  return mapCodexToolItems(message);
};

const isToolMessagePending = (message: IMessageToolGroup | IMessageAcpToolCall | IMessageCodexToolCall): boolean => {
  if (message.type === 'tool_group') {
    return message.content.some(
      (tool) => tool.status !== 'Success' && tool.status !== 'Error' && tool.status !== 'Canceled'
    );
  }

  if (message.type === 'acp_tool_call') {
    return message.content.update.status !== 'completed';
  }

  return !['success', 'error', 'canceled'].includes(message.content.status);
};

const GENERIC_TOOL_ITEM_VALUES = new Set(['read', 'edit', 'execute', 'patch', 'web_search', 'mcp', 'operation']);

const getToolItemLabel = (item: ToolItem): string => {
  const name = normalizeToolText(item.name).trim();
  const desc = normalizeToolText(item.desc).trim();
  const normalizedName = name.toLowerCase();
  const normalizedDesc = desc.toLowerCase();

  if (item.label) {
    return item.label;
  }

  if (!desc) {
    return name;
  }

  if (GENERIC_TOOL_ITEM_VALUES.has(normalizedName)) {
    return desc;
  }

  if (GENERIC_TOOL_ITEM_VALUES.has(normalizedDesc)) {
    return name;
  }

  if (/^(Edit|Read|Delete)\b/i.test(desc)) {
    return desc;
  }

  return name + '(' + desc + ')';
};

const getFileOperationMeta = (
  kind: FileOperationKind,
  t: ReturnType<typeof useTranslation>['t'],
  count = 1
): {
  title: string;
  summaryLabel: string;
  icon: React.ReactNode;
  chipClassName: string;
  markerClassName: string;
} => {
  switch (kind) {
    case 'read':
      return {
        title: t('messages.fileOperation.read'),
        summaryLabel: t('messages.fileOperation.summary.read', { count }),
        icon: <PreviewOpen theme='outline' size='14' fill='currentColor' className='app-icon' />,
        chipClassName: 'text-primary bg-primary-light-1',
        markerClassName: 'step-item-icon-chip--read',
      };
    case 'written':
      return {
        title: t('messages.fileOperation.written'),
        summaryLabel: t('messages.fileOperation.summary.written', { count }),
        icon: <Write theme='outline' size='14' fill='currentColor' className='app-icon' />,
        chipClassName: 'text-success bg-success-light-1',
        markerClassName: 'step-item-icon-chip--written',
      };
    case 'deleted':
      return {
        title: t('messages.fileOperation.deleted'),
        summaryLabel: t('messages.fileOperation.summary.deleted', { count }),
        icon: <DeleteOne theme='outline' size='14' fill='currentColor' className='app-icon' />,
        chipClassName: 'text-danger bg-danger-light-1',
        markerClassName: 'step-item-icon-chip--deleted',
      };
    case 'operation':
    default:
      return {
        title: t('messages.fileOperation.operation'),
        summaryLabel: t('messages.fileOperation.summary.operation', { count }),
        icon: <FileText theme='outline' size='14' fill='currentColor' className='app-icon' />,
        chipClassName: 'text-t-secondary bg-bg-2',
        markerClassName: 'step-item-icon-chip--operation',
      };
  }
};

type StepTimelineRowProps = {
  marker: React.ReactNode;
  label: string;
  expanded: boolean;
  canExpand: boolean;
  onToggle?: () => void;
  meta?: React.ReactNode;
  emphasized?: boolean;
};

const StepTimelineRow: React.FC<StepTimelineRowProps> = ({
  marker,
  label,
  expanded,
  canExpand,
  onToggle,
  meta,
  emphasized = false,
}) => {
  return (
    <div className={'step-item-row-shell' + (emphasized ? ' step-item-row-shell--highlight' : '')}>
      <div className='step-item-row'>
        <span className='step-item-marker'>{marker}</span>
        <span
          className={
            'step-item-label' +
            (expanded ? ' step-item-label--wrap' : ' step-item-label--truncate') +
            (canExpand ? ' step-item-label--interactive' : '')
          }
          onClick={canExpand ? onToggle : undefined}
        >
          {label}
        </span>
        <span className='step-item-meta'>{meta ?? null}</span>
        <span
          className={
            'step-item-arrow' + (canExpand ? ' step-item-arrow--interactive' : ' step-item-arrow--placeholder')
          }
          onClick={canExpand ? onToggle : undefined}
        >
          {canExpand ? expanded ? <IconDown style={{ fontSize: 12 }} /> : <IconRight style={{ fontSize: 12 }} /> : null}
        </span>
      </div>
    </div>
  );
};

const ToolItemDetail: React.FC<{ item: ToolItem }> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = Boolean(item.input || item.output);
  const statusClassName =
    item.status === 'success'
      ? 'step-item-status-chip--success'
      : item.status === 'error'
        ? 'step-item-status-chip--error'
        : item.status === 'processing'
          ? 'step-item-status-chip--processing'
          : 'step-item-status-chip--default';

  return (
    <div className='flex flex-col gap-6px'>
      <StepTimelineRow
        marker={
          item.marker ?? (
            <span className={'step-item-status-chip ' + statusClassName}>
              <span
                className={'step-item-status-dot' + (item.status === 'processing' ? ' badge-breathing' : '')}
              ></span>
            </span>
          )
        }
        label={getToolItemLabel(item)}
        expanded={expanded}
        canExpand={hasDetail}
        onToggle={hasDetail ? () => setExpanded((value) => !value) : undefined}
      />
      {expanded && hasDetail && (
        <div className='step-item-detail tool-detail-panel'>
          {item.input && (
            <div className='tool-detail-section'>
              <div className='tool-detail-label'>Input</div>
              <pre className='tool-detail-content'>{item.input}</pre>
            </div>
          )}
          {item.output && (
            <div className='tool-detail-section'>
              <div className='tool-detail-label'>Output</div>
              <pre className='tool-detail-content'>{item.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FileOperationTimelineItem: React.FC<{ operation: ParsedFileOperationMessage }> = ({ operation }) => {
  const { t } = useTranslation();
  const meta = getFileOperationMeta(operation.kind, t);
  const fileName = getFileNameFromPath(operation.path);
  const hasDetail = Boolean(operation.preview || operation.path || operation.method);
  const [expanded, setExpanded] = useState(false);

  return (
    <Tooltip content={operation.path}>
      <div className='flex flex-col gap-6px'>
        <StepTimelineRow
          marker={<span className={'step-item-icon-chip ' + meta.markerClassName}>{meta.icon}</span>}
          label={meta.title + '(' + fileName + ')'}
          expanded={expanded}
          canExpand={hasDetail}
          onToggle={hasDetail ? () => setExpanded((value) => !value) : undefined}
          emphasized
          meta={operation.method ? <span className='step-item-method-chip'>{operation.method}</span> : null}
        />
        {expanded && (
          <div className='step-item-detail tool-detail-panel'>
            <div className='tool-detail-section'>
              <div className='tool-detail-label'>Path</div>
              <pre className='tool-detail-content'>{operation.path}</pre>
            </div>
            {operation.preview && (
              <div className='tool-detail-section'>
                <div className='tool-detail-label'>Preview</div>
                <pre className='tool-detail-content'>{operation.preview}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Tooltip>
  );
};

const MessageToolGroupSummary: React.FC<{ steps?: StepSummaryEntry[] }> = ({ steps = [] }) => {
  const { t } = useTranslation();
  const hasPendingTools = useMemo(
    () => steps.some((step) => step.type === 'tool' && isToolMessagePending(step.message)),
    [steps]
  );
  const previousHasPendingToolsRef = useRef(hasPendingTools);
  const [showMore, setShowMore] = useState(hasPendingTools);

  useEffect(() => {
    if (hasPendingTools && !previousHasPendingToolsRef.current) {
      setShowMore(true);
    }
    previousHasPendingToolsRef.current = hasPendingTools;
  }, [hasPendingTools]);

  const groupedOperations = useMemo(() => {
    const groups = new Map<FileOperationKind, ParsedFileOperationMessage[]>();

    steps.forEach((step) => {
      if (step.type !== 'file_operation') {
        return;
      }

      const existing = groups.get(step.operation.kind);
      if (existing) {
        existing.push(step.operation);
        return;
      }

      groups.set(step.operation.kind, [step.operation]);
    });

    return FILE_OPERATION_ORDER.filter((kind) => groups.has(kind)).map((kind) => ({
      kind,
      operations: groups.get(kind) || [],
    }));
  }, [steps]);

  const toolCount = useMemo(() => {
    return steps.reduce((count, step) => {
      if (step.type !== 'tool') {
        return count;
      }

      return count + mapToolStepItems(step.message).length;
    }, 0);
  }, [steps]);

  if (!steps.length) {
    return null;
  }

  return (
    <div className='step-summary-card'>
      <div className='step-summary-header' onClick={() => setShowMore((value) => !value)}>
        <span className='step-summary-title'>{t('messages.stepSummary.viewSteps')}</span>
        <div className='step-summary-chips'>
          {groupedOperations.map((group) => {
            const meta = getFileOperationMeta(group.kind, t, group.operations.length);
            return (
              <span
                key={group.kind}
                className={
                  'inline-flex items-center gap-6px rounded-full px-10px py-4px text-12px font-500 leading-16px ' +
                  meta.chipClassName
                }
              >
                <span className='app-icon-slot app-icon-slot--sm'>{meta.icon}</span>
                <span>{meta.summaryLabel}</span>
              </span>
            );
          })}
          {toolCount > 0 && (
            <span className='inline-flex items-center gap-6px rounded-full bg-bg-2 px-10px py-4px text-12px font-500 leading-16px text-t-secondary'>
              <span className='step-summary-tool-dot'></span>
              <span>
                {t('messages.stepSummary.tools', {
                  count: toolCount,
                })}
              </span>
            </span>
          )}
        </div>
        <span className='step-summary-toggle'>{showMore ? <IconDown /> : <IconRight />}</span>
      </div>
      {showMore && (
        <div className='step-summary-body'>
          {steps.map((step) => {
            if (step.type === 'file_operation') {
              return <FileOperationTimelineItem key={step.id} operation={step.operation} />;
            }

            return (
              <div key={step.id} className='flex flex-col gap-8px'>
                {mapToolStepItems(step.message).map((item) => (
                  <ToolItemDetail key={item.key} item={item} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageToolGroupSummary);
