import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IContextSchedule } from '@/common/adapter/ipcBridge';

const navigateMock = vi.fn();
const pauseJobMock = vi.fn().mockResolvedValue(undefined);
const resumeJobMock = vi.fn().mockResolvedValue(undefined);
const runJobNowMock = vi.fn().mockResolvedValue(undefined);
const deleteJobMock = vi.fn().mockResolvedValue(undefined);
const updateJobMock = vi.fn().mockResolvedValue(undefined);
const refetchMock = vi.fn().mockResolvedValue(undefined);
const successMessageMock = vi.fn();
const errorMessageMock = vi.fn();

const DEFAULT_JOBS: IContextSchedule[] = [
  {
    id: 'schedule-1',
    name: 'Daily summary',
    enabled: true,
    owner: 'user',
    createdBy: 'user',
    schedule: {
      kind: 'cron',
      expr: '0 9 * * *',
      description: 'Every day at 09:00',
    },
    scope: {
      kind: 'conversation',
      spaceId: 'space-1',
      conversationId: 'conv-1',
      label: 'Project Alpha',
    },
    target: {
      kind: 'send_query',
      conversationId: 'conv-1',
      conversationTitle: 'Project Alpha',
      agentType: 'claude',
      message: 'Summarize the latest AI updates',
    },
    state: {
      nextRunAtMs: 1_700_000_000_000,
      lastRunAtMs: 1_699_999_000_000,
      lastStatus: 'ok',
      runCount: 3,
      retryCount: 0,
      maxRetries: 3,
    },
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'schedule-2',
    name: 'Paused review',
    enabled: false,
    owner: 'user',
    createdBy: 'user',
    schedule: {
      kind: 'every',
      everyMs: 3_600_000,
      description: 'Hourly',
    },
    scope: {
      kind: 'conversation',
      spaceId: 'space-1',
      conversationId: 'conv-2',
      label: 'Project Beta',
    },
    target: {
      kind: 'send_query',
      conversationId: 'conv-2',
      conversationTitle: 'Project Beta',
      agentType: 'codex',
      message: 'Review incoming feedback',
    },
    state: {
      runCount: 0,
      retryCount: 0,
      maxRetries: 3,
    },
    createdAt: 1,
    updatedAt: 1,
  },
];

let mockJobs: IContextSchedule[] = DEFAULT_JOBS;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'common.refresh': 'Refresh',
        'common.edit': 'Edit',
        'common.unknownError': 'Unknown error',
        'schedule.allScheduledTasks': 'All Scheduled Tasks',
        'schedule.taskCount': `${options?.count ?? 0} task(s)`,
        'schedule.schedule': 'Schedule',
        'schedule.nextRun': 'Next run',
        'schedule.lastRun': 'Last run',
        'schedule.lastError': 'Error',
        'schedule.message': 'Message',
        'schedule.runNowSuccess': 'Task execution triggered',
        'schedule.pauseSuccess': 'Task paused',
        'schedule.resumeSuccess': 'Task resumed',
        'schedule.status.active': 'Active',
        'schedule.status.paused': 'Paused',
        'schedule.status.error': 'Error',
        'schedule.actions.goTo': 'View Chat',
        'schedule.actions.runNow': 'Run Now',
        'schedule.actions.pause': 'Pause',
        'schedule.actions.resume': 'Resume',
        'schedule.overview.description': 'Review and manage scheduled tasks across all conversations from one place.',
        'schedule.overview.stats.total': 'Total Tasks',
        'schedule.overview.stats.active': 'Active Tasks',
        'schedule.overview.stats.paused': 'Paused Tasks',
        'schedule.overview.stats.error': 'Errored Tasks',
        'schedule.overview.filters.allStatuses': 'All Statuses',
        'schedule.overview.filters.searchPlaceholder': 'Search scheduled tasks',
        'schedule.overview.emptyInitial': 'No scheduled tasks yet.',
        'schedule.overview.emptyFiltered': 'No scheduled tasks match the current filters.',
        'schedule.presets.title': 'Starter Scheduled Tasks',
        'schedule.presets.description': 'Turn on high-value automations out of the box.',
        'schedule.presets.packPacksTitle': 'Browse by Industry Pack',
        'schedule.presets.emptyHint': 'Open a single-agent conversation to enable a preset timer.',
        'schedule.presets.recommended': 'Recommended Default',
        'schedule.presets.packs.all': 'All',
        'settings.mcpStatus': 'Status',
      };

      const template = map[key] ?? key;
      return Object.entries(options || {}).reduce(
        (result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)),
        template
      );
    },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid='settings-page-wrapper'>{children}</div>,
}));

vi.mock('@/renderer/pages/schedule/components/ScheduleJobDrawer', () => ({
  default: ({ job }: { job: IContextSchedule }) => <div data-testid='schedule-job-drawer'>{job.name}</div>,
}));

vi.mock('@/renderer/pages/schedule/components/SchedulePresetLibrary', () => ({
  default: () => <div data-testid='schedule-preset-library' />,
}));

vi.mock('@/renderer/pages/schedule/useScheduleJobs', () => ({
  useAllScheduleJobs: () => ({
    jobs: mockJobs,
    loading: false,
    refetch: refetchMock,
    pauseJob: pauseJobMock,
    resumeJob: resumeJobMock,
    runJobNow: runJobNowMock,
    deleteJob: deleteJobMock,
    updateJob: updateJobMock,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
  }) => <input value={value} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />,
  Message: {
    useMessage: () => [
      {
        success: successMessageMock,
        error: errorMessageMock,
      },
      <div key='message-context' />,
    ],
  },
  Select: ({
    value,
    options,
    onChange,
  }: {
    value?: string;
    options?: Array<{ label: string; value: string }>;
    onChange?: (value: string) => void;
  }) => (
    <select value={value} onChange={(event) => onChange?.(event.target.value)}>
      {options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Spin: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  },
}));

vi.mock('@icon-park/react', () => ({
  AlarmClock: () => <span />,
  ArrowRight: () => <span />,
  Edit: () => <span />,
  Pause: () => <span />,
  Play: () => <span />,
  Refresh: () => <span />,
  Search: () => <span />,
}));

import GlobalScheduleSettings from '@/renderer/pages/schedule/GlobalScheduleSettings';

describe('GlobalScheduleSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobs = DEFAULT_JOBS;
  });

  it('renders scheduled jobs and opens the drawer for editing', async () => {
    render(<GlobalScheduleSettings />);

    expect(screen.getByText('All Scheduled Tasks')).toBeInTheDocument();
    expect(screen.getByText('Daily summary')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Edit')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('schedule-job-drawer')).toHaveTextContent('Daily summary');
    });
  });

  it('triggers run-now and shows success feedback', async () => {
    render(<GlobalScheduleSettings />);

    fireEvent.click(screen.getAllByText('Run Now')[0]);

    await waitFor(() => {
      expect(runJobNowMock).toHaveBeenCalledWith('schedule-1');
      expect(successMessageMock).toHaveBeenCalledWith('Task execution triggered');
    });
  });

  it('toggles pause and resume based on the current schedule state', async () => {
    render(<GlobalScheduleSettings />);

    fireEvent.click(screen.getByText('Pause'));
    fireEvent.click(screen.getByText('Resume'));

    await waitFor(() => {
      expect(pauseJobMock).toHaveBeenCalledWith('schedule-1');
      expect(resumeJobMock).toHaveBeenCalledWith('schedule-2');
    });
  });
});
