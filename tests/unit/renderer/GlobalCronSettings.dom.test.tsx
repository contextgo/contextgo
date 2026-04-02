import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ICronJob } from '@/common/adapter/ipcBridge';

const navigateMock = vi.fn();
const pauseJobMock = vi.fn().mockResolvedValue(undefined);
const resumeJobMock = vi.fn().mockResolvedValue(undefined);
const deleteJobMock = vi.fn().mockResolvedValue(undefined);
const updateJobMock = vi.fn().mockResolvedValue(undefined);
const refetchMock = vi.fn().mockResolvedValue(undefined);
const successMessageMock = vi.fn();
const errorMessageMock = vi.fn();

const DEFAULT_JOBS: ICronJob[] = [
  {
    id: 'job-1',
    name: 'Daily summary',
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: '0 9 * * *',
      description: 'Every day at 09:00',
    },
    target: {
      payload: {
        kind: 'message',
        text: 'Summarize the latest AI updates',
      },
    },
    metadata: {
      conversationId: 'conv-1',
      conversationTitle: 'Project Alpha',
      agentType: 'claude',
      createdBy: 'user',
      createdAt: 1,
      updatedAt: 1,
    },
    state: {
      nextRunAtMs: 1_700_000_000_000,
      lastRunAtMs: 1_699_999_000_000,
      lastStatus: 'ok',
      runCount: 3,
      retryCount: 0,
      maxRetries: 3,
    },
  },
  {
    id: 'job-2',
    name: 'Paused review',
    enabled: false,
    schedule: {
      kind: 'every',
      everyMs: 3_600_000,
      description: 'Hourly',
    },
    target: {
      payload: {
        kind: 'message',
        text: 'Review incoming feedback',
      },
    },
    metadata: {
      conversationId: 'conv-2',
      conversationTitle: 'Project Beta',
      agentType: 'codex',
      createdBy: 'user',
      createdAt: 1,
      updatedAt: 1,
    },
    state: {
      runCount: 0,
      retryCount: 0,
      maxRetries: 3,
    },
  },
];

let mockJobs: ICronJob[] = DEFAULT_JOBS;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'common.refresh': 'Refresh',
        'common.edit': 'Edit',
        'common.unknownError': 'Unknown error',
        'cron.allScheduledTasks': 'All Scheduled Tasks',
        'cron.taskCount': `${options?.count ?? 0} task(s)`,
        'cron.schedule': 'Schedule',
        'cron.nextRun': 'Next run',
        'cron.lastRun': 'Last run',
        'cron.lastError': 'Error',
        'cron.message': 'Message',
        'cron.pauseSuccess': 'Task paused',
        'cron.resumeSuccess': 'Task resumed',
        'cron.status.active': 'Active',
        'cron.status.paused': 'Paused',
        'cron.status.error': 'Error',
        'cron.actions.goTo': 'View Chat',
        'cron.actions.pause': 'Pause',
        'cron.actions.resume': 'Resume',
        'cron.overview.description': 'Review and manage scheduled tasks across all conversations from one place.',
        'cron.overview.stats.total': 'Total Tasks',
        'cron.overview.stats.active': 'Active Tasks',
        'cron.overview.stats.paused': 'Paused Tasks',
        'cron.overview.stats.error': 'Errored Tasks',
        'cron.overview.filters.allStatuses': 'All Statuses',
        'cron.overview.filters.searchPlaceholder': 'Search scheduled tasks',
        'cron.overview.emptyInitial': 'No scheduled tasks yet.',
        'cron.overview.emptyFiltered': 'No scheduled tasks match the current filters.',
        'cron.presets.title': 'Starter Scheduled Tasks',
        'cron.presets.description': 'Turn on high-value automations out of the box.',
        'cron.presets.packPacksTitle': 'Browse by Industry Pack',
        'cron.presets.emptyHint': 'Open a single-agent conversation to enable a preset timer.',
        'cron.presets.recommended': 'Recommended Default',
        'cron.presets.packs.all': 'All',
        'cron.presets.packs.saasProduct': 'SaaS Product Pack',
        'cron.presets.packs.contentGrowth': 'Content Growth Pack',
        'cron.presets.packs.recruitingOps': 'Recruiting Ops Pack',
        'cron.presets.packs.salesFollowUp': 'Sales Follow-Up Pack',
        'cron.presets.packs.researchMonitoring': 'Research Monitoring Pack',
        'cron.presets.actions.browseAllPacks': 'Browse All Packs',
        'cron.presets.actions.viewAllInPack': 'View all {{count}} presets',
        'cron.presets.actions.showLessInPack': 'Show Fewer',
        'cron.presets.packDetails.presetCount': 'presets',
        'cron.presets.packDetails.bestForLabel': 'Best For',
        'cron.presets.packDetails.outcomeLabel': 'Expected Outcome',
        'cron.presets.packDetails.all.title': 'All Industry Packs',
        'cron.presets.packDetails.all.description':
          'Browse the full starter library across product, growth, recruiting, sales, and research workflows.',
        'cron.presets.packDetails.all.bestFor':
          'Teams still exploring where scheduled automations create the most leverage.',
        'cron.presets.packDetails.all.outcome':
          'Compare multiple operating styles first, then narrow into a focused pack once one workflow stands out.',
        'cron.presets.packDetails.saasProduct.description':
          'Built for product-led SaaS teams that need recurring visibility into user behavior, backlog pressure, competitor moves, and weekly execution rhythm.',
        'cron.presets.packDetails.saasProduct.bestFor':
          'Product managers, product ops, and startup teams that want one strong default pack before specializing.',
        'cron.presets.packDetails.saasProduct.outcome':
          'Catch usage shifts earlier, keep priorities current, and maintain a steady decision cadence without rebuilding the workflow every week.',
        'cron.presets.packDetails.contentGrowth.description':
          'Built for content and growth teams that need repeatable topic discovery, calendar checks, experiment reviews, and audience-signal monitoring.',
        'cron.presets.packDetails.contentGrowth.bestFor':
          'Content leads, growth marketers, and lean teams running organic distribution with limited bandwidth.',
        'cron.presets.packDetails.contentGrowth.outcome':
          'Keep the pipeline warm, reduce topic gaps, and turn scattered growth work into a repeatable publishing and review loop.',
        'cron.presets.packDetails.recruitingOps.description':
          'Built for recruiting workflows that need daily pipeline visibility, interview-feedback rollups, and operational follow-through across open roles.',
        'cron.presets.packDetails.recruitingOps.bestFor':
          'Recruiters, hiring managers, and recruiting coordinators handling multiple candidates and parallel stages.',
        'cron.presets.packDetails.recruitingOps.outcome':
          'Spot bottlenecks faster, push stalled candidates forward, and make hiring decisions with cleaner daily summaries.',
        'cron.presets.packDetails.salesFollowUp.description':
          'Built for sales follow-up work that depends on rapid response, stale-opportunity detection, and consistent deal review across the funnel.',
        'cron.presets.packDetails.salesFollowUp.bestFor':
          'Sales reps, founders doing outbound, and revenue teams that cannot afford follow-up drift.',
        'cron.presets.packDetails.salesFollowUp.outcome':
          'Recover stalled deals sooner, maintain follow-up cadence, and surface the next best move before pipeline quality drops.',
        'cron.presets.packDetails.researchMonitoring.description':
          'Built for research-heavy workflows that rely on fresh policy signals, market movement, competitor tracking, and structured weekly synthesis.',
        'cron.presets.packDetails.researchMonitoring.bestFor':
          'Analysts, investors, strategy teams, and operators tracking moving markets or regulated sectors.',
        'cron.presets.packDetails.researchMonitoring.outcome':
          'Reduce signal lag, keep monitoring consistent, and turn fragmented updates into a sharper research decision loop.',
        'cron.presets.categories.research': 'Research',
        'cron.presets.categories.planning': 'Planning',
        'cron.presets.categories.review': 'Review',
        'cron.presets.categories.reporting': 'Reporting',
        'cron.presets.categories.operations': 'Operations',
        'cron.presets.items.aiDigest.name': 'AI News Digest',
        'cron.presets.items.aiDigest.description': 'Track the latest AI models and products.',
        'cron.presets.items.aiDigest.scheduleDescription': 'Every weekday at 09:00',
        'cron.presets.items.aiDigest.message': 'Summarize the top AI signals.',
        'cron.presets.items.competitorWatch.name': 'Competitor Watch',
        'cron.presets.items.competitorWatch.description': 'Review competitor moves every afternoon.',
        'cron.presets.items.competitorWatch.scheduleDescription': 'Every weekday at 14:00',
        'cron.presets.items.competitorWatch.message': 'Summarize competitor changes.',
        'cron.presets.items.morningFocus.name': 'Morning Focus Plan',
        'cron.presets.items.morningFocus.description': 'Decide what matters most today.',
        'cron.presets.items.morningFocus.scheduleDescription': 'Every weekday at 09:30',
        'cron.presets.items.morningFocus.message': "Identify today's top priorities.",
        'cron.presets.items.contentRadar.name': 'Content Idea Radar',
        'cron.presets.items.contentRadar.description': 'Generate timely topics twice a week.',
        'cron.presets.items.contentRadar.scheduleDescription': 'Every Tuesday and Thursday at 11:00',
        'cron.presets.items.contentRadar.message': 'Generate content ideas.',
        'cron.presets.items.saasUsageReview.name': 'Active User Shift Review',
        'cron.presets.items.saasUsageReview.description': 'Review active-user movement every morning.',
        'cron.presets.items.saasUsageReview.scheduleDescription': 'Every weekday at 10:00',
        'cron.presets.items.saasUsageReview.message': 'Review active-user changes.',
        'cron.presets.items.backlogPrioritization.name': 'Backlog Priority Review',
        'cron.presets.items.backlogPrioritization.description': 'Re-check backlog priorities twice a week.',
        'cron.presets.items.backlogPrioritization.scheduleDescription': 'Every Tuesday and Thursday at 15:30',
        'cron.presets.items.backlogPrioritization.message': 'Reassess backlog priorities.',
        'cron.presets.items.contentCalendar.name': 'Content Calendar Review',
        'cron.presets.items.contentCalendar.description': 'Review the upcoming publishing cadence.',
        'cron.presets.items.contentCalendar.scheduleDescription': 'Every Monday, Wednesday, and Friday at 10:00',
        'cron.presets.items.contentCalendar.message': 'Review the content calendar.',
        'cron.presets.items.growthExperimentReview.name': 'Growth Experiment Review',
        'cron.presets.items.growthExperimentReview.description': 'Review growth experiments mid-week.',
        'cron.presets.items.growthExperimentReview.scheduleDescription': 'Every Wednesday at 17:00',
        'cron.presets.items.growthExperimentReview.message': 'Review growth experiments.',
        'cron.presets.items.candidatePipelineReview.name': 'Candidate Pipeline Review',
        'cron.presets.items.candidatePipelineReview.description': 'Review candidate stages and blockers.',
        'cron.presets.items.candidatePipelineReview.scheduleDescription': 'Every weekday at 10:00',
        'cron.presets.items.candidatePipelineReview.message': 'Review the candidate pipeline.',
        'cron.presets.items.interviewFeedbackDigest.name': 'Interview Feedback Digest',
        'cron.presets.items.interviewFeedbackDigest.description': 'Summarize interview feedback every evening.',
        'cron.presets.items.interviewFeedbackDigest.scheduleDescription': 'Every weekday at 18:00',
        'cron.presets.items.interviewFeedbackDigest.message': 'Summarize interview feedback.',
        'cron.presets.items.staleDealAlert.name': 'Stale Deal Alert',
        'cron.presets.items.staleDealAlert.description': 'Spot stalled deals every afternoon.',
        'cron.presets.items.staleDealAlert.scheduleDescription': 'Every weekday at 14:30',
        'cron.presets.items.staleDealAlert.message': 'Identify stale deals.',
        'cron.presets.items.policySignalWatch.name': 'Policy Signal Watch',
        'cron.presets.items.policySignalWatch.description': 'Track policy and regulatory signals every morning.',
        'cron.presets.items.policySignalWatch.scheduleDescription': 'Every weekday at 08:30',
        'cron.presets.items.policySignalWatch.message': 'Track policy signals.',
        'cron.presets.items.endOfDayReview.name': 'End-of-Day Review',
        'cron.presets.items.endOfDayReview.description': 'Wrap up the workday.',
        'cron.presets.items.endOfDayReview.scheduleDescription': 'Every weekday at 18:30',
        'cron.presets.items.endOfDayReview.message': "Review today's progress.",
        'cron.presets.items.userFeedbackDigest.name': 'User Feedback Digest',
        'cron.presets.items.userFeedbackDigest.description': 'Summarize repeated user issues.',
        'cron.presets.items.userFeedbackDigest.scheduleDescription': 'Every weekday at 16:00',
        'cron.presets.items.userFeedbackDigest.message': 'Summarize user feedback.',
        'cron.presets.items.weeklyReview.name': 'Friday Weekly Report',
        'cron.presets.items.weeklyReview.description': 'Generate a structured weekly recap.',
        'cron.presets.items.weeklyReview.scheduleDescription': 'Every Friday at 17:30',
        'cron.presets.items.weeklyReview.message': 'Prepare a structured weekly report.',
        'cron.presets.items.leadFollowUp.name': 'Lead Follow-Up Queue',
        'cron.presets.items.leadFollowUp.description': 'Prioritize lead follow-ups.',
        'cron.presets.items.leadFollowUp.scheduleDescription': 'Every weekday at 10:30',
        'cron.presets.items.leadFollowUp.message': 'List lead follow-ups.',
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

vi.mock('@/renderer/pages/cron/components/CronJobDrawer', () => ({
  default: ({ job }: { job: ICronJob }) => <div data-testid='cron-job-drawer'>{job.name}</div>,
}));

vi.mock('@/renderer/pages/cron/useCronJobs', () => ({
  useAllCronJobs: () => ({
    jobs: mockJobs,
    loading: false,
    refetch: refetchMock,
    pauseJob: pauseJobMock,
    resumeJob: resumeJobMock,
    deleteJob: deleteJobMock,
    updateJob: updateJobMock,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    icon,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    icon?: React.ReactNode;
  }) => (
    <button type='button' onClick={onClick}>
      {icon}
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
    Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
    Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  },
}));

vi.mock('@icon-park/react', () => ({
  AlarmClock: () => <span data-testid='icon-alarm' />,
  ArrowRight: () => <span data-testid='icon-arrow-right' />,
  Edit: () => <span data-testid='icon-edit' />,
  Pause: () => <span data-testid='icon-pause' />,
  Play: () => <span data-testid='icon-play' />,
  Refresh: () => <span data-testid='icon-refresh' />,
  Search: () => <span data-testid='icon-search' />,
}));

import GlobalCronSettings from '@/renderer/pages/cron/GlobalCronSettings';

describe('GlobalCronSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobs = DEFAULT_JOBS;
  });

  it('renders the global cron overview and all jobs', () => {
    render(<GlobalCronSettings />);

    expect(screen.getByText('All Scheduled Tasks')).toBeInTheDocument();
    expect(screen.getByText('Daily summary')).toBeInTheDocument();
    expect(screen.getByText('Paused review')).toBeInTheDocument();
    expect(screen.getByText('2 task(s)')).toBeInTheDocument();
  });

  it('filters jobs by search query', async () => {
    render(<GlobalCronSettings />);

    fireEvent.change(screen.getByPlaceholderText('Search scheduled tasks'), {
      target: { value: 'beta' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Daily summary')).not.toBeInTheDocument();
      expect(screen.getByText('Paused review')).toBeInTheDocument();
    });
  });

  it('navigates to the conversation and pauses active jobs', async () => {
    render(<GlobalCronSettings />);

    fireEvent.click(screen.getAllByText('View Chat')[0]);
    expect(navigateMock).toHaveBeenCalledWith('/conversation/conv-1');

    fireEvent.click(screen.getAllByText('Pause')[0]);

    await waitFor(() => {
      expect(pauseJobMock).toHaveBeenCalledWith('job-1');
      expect(successMessageMock).toHaveBeenCalledWith('Task paused');
    });
  });

  it('opens the drawer for editing a selected job', async () => {
    render(<GlobalCronSettings />);

    fireEvent.click(screen.getAllByText('Edit')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('cron-job-drawer')).toHaveTextContent('Daily summary');
    });
  });

  it('shows starter presets when there are no jobs yet', () => {
    mockJobs = [];

    render(<GlobalCronSettings />);

    expect(screen.getByText('Starter Scheduled Tasks')).toBeInTheDocument();
    expect(screen.getByText('Browse by Industry Pack')).toBeInTheDocument();
    expect(screen.getAllByText(/SaaS Product Pack/).length).toBeGreaterThan(0);
    expect(screen.getByText('Recommended Default')).toBeInTheDocument();
    expect(screen.getByText('Best For')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Product managers, product ops, and startup teams that want one strong default pack before specializing.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Morning Focus Plan')).toBeInTheDocument();
    expect(screen.getByText('Active User Shift Review')).toBeInTheDocument();
    expect(screen.getByText('Backlog Priority Review')).toBeInTheDocument();
    expect(screen.getByText('User Feedback Digest')).toBeInTheDocument();
    expect(screen.getByText('Friday Weekly Report')).toBeInTheDocument();
    expect(screen.getByText('Browse All Packs')).toBeInTheDocument();
    expect(screen.getByText('View all 9 presets')).toBeInTheDocument();
    expect(screen.queryByText('AI News Digest')).not.toBeInTheDocument();
    expect(screen.queryByText('Lead Follow-Up Queue')).not.toBeInTheDocument();
    expect(screen.queryByText('Candidate Pipeline Review')).not.toBeInTheDocument();
    expect(screen.queryByText('Policy Signal Watch')).not.toBeInTheDocument();
    expect(screen.getByText('Open a single-agent conversation to enable a preset timer.')).toBeInTheDocument();
  });

  it('expands the recommended pack only when users ask to view everything', async () => {
    mockJobs = [];

    render(<GlobalCronSettings />);

    fireEvent.click(screen.getByRole('button', { name: /View all 9 presets/i }));

    await waitFor(() => {
      expect(screen.getByText('AI News Digest')).toBeInTheDocument();
      expect(screen.getByText('Lead Follow-Up Queue')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Show Fewer/i })).toBeInTheDocument();
    });
  });

  it('switches the visible presets and pack guidance when a different industry pack is selected', async () => {
    mockJobs = [];

    render(<GlobalCronSettings />);

    fireEvent.click(screen.getByRole('button', { name: /Recruiting Ops Pack/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Recruiters, hiring managers, and recruiting coordinators handling multiple candidates and parallel stages.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Candidate Pipeline Review')).toBeInTheDocument();
      expect(screen.getByText('Interview Feedback Digest')).toBeInTheDocument();
      expect(screen.queryByText('Active User Shift Review')).not.toBeInTheDocument();
      expect(screen.queryByText('Recommended Default')).not.toBeInTheDocument();
    });
  });
});
