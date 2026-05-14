const navigation = {
  docs: [
    'index',
    {
      type: 'category',
      label: 'Start Here',
      link: { type: 'doc', id: 'start-here/index' },
      items: [
        {
          type: 'category',
          label: 'Foundations',
          items: ['start-here/what-is-contextgo', 'start-here/product-map'],
        },
        {
          type: 'category',
          label: 'Get Started',
          items: ['start-here/quick-start', 'start-here/choose-your-setup'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Use Cases',
      link: { type: 'doc', id: 'use-cases/index' },
      items: [
        {
          type: 'category',
          label: 'Core Workflows',
          items: [
            'use-cases/bring-your-workflow-into-contextgo',
            'use-cases/content-and-writing-studio',
            'use-cases/research-and-browser-workflow',
            'use-cases/coding-and-builder-workflow',
            'use-cases/personal-remote-workbench',
            'use-cases/recommended-starter-modes',
          ],
        },
        {
          type: 'category',
          label: 'Team And Delivery',
          items: [
            'use-cases/operations-and-automation-workflow',
            'use-cases/publish-to-channel-workflow',
            'use-cases/team-and-collaboration-workflow',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Workbench',
      link: { type: 'doc', id: 'workbench/index' },
      items: ['workbench/ai-native-workbench-overview', 'workbench/conversation-cowork-workbench'],
    },
    {
      type: 'category',
      label: 'Context',
      link: { type: 'doc', id: 'context/index' },
      items: [
        {
          type: 'category',
          label: 'Foundations',
          items: ['context/context-system-overview', 'context/context-connector', 'context/context-engine'],
        },
        {
          type: 'category',
          label: 'Modeling And Governance',
          items: ['context/session-project-space', 'context/memory-profile-context-pack', 'context/context-governance'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Agents & Capabilities',
      link: { type: 'doc', id: 'agents/index' },
      items: [
        {
          type: 'category',
          label: 'System And Packages',
          items: ['agents/agent-system-overview', 'agents/agent-packages', 'agents/built-in-assistants'],
        },
        {
          type: 'category',
          label: 'Runtime And Tooling',
          items: [
            'agents/runtime-center',
            'agents/installed-signed-in-ready',
            'agents/external-session-takeover',
            'agents/browser-tools-and-runtime-actions',
          ],
        },
        {
          type: 'category',
          label: 'Automation',
          items: ['agents/skill-market', 'agents/hooks-commands-schedules'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Publish',
      link: { type: 'doc', id: 'publish/index' },
      items: [
        {
          type: 'category',
          label: 'Channel Model',
          items: [
            'publish/publish-overview',
            'publish/channels',
            'publish/channel-accounts-and-instances',
            'publish/audiences-threads-groups',
          ],
        },
        {
          type: 'category',
          label: 'Operations',
          items: ['publish/publish-one-agent-to-many-places', 'publish/managing-published-agents'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Collaboration',
      link: { type: 'doc', id: 'collaboration/index' },
      items: [
        {
          type: 'category',
          label: 'Collaboration Patterns',
          items: [
            'collaboration/collaboration-overview',
            'collaboration/multi-agent-collaboration',
            'collaboration/harness-style-workflows',
            'collaboration/group-workflows',
            'collaboration/agent-teams',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Remote & Devices',
      link: { type: 'doc', id: 'remote/index' },
      items: [
        {
          type: 'category',
          label: 'Host Model',
          items: ['remote/remote-access-overview', 'remote/desktop-host', 'remote/linux-host-and-cli'],
        },
        {
          type: 'category',
          label: 'Client Surfaces',
          items: ['remote/web-client', 'remote/mobile-shells', 'remote/same-experience-across-devices'],
        },
        {
          type: 'category',
          label: 'Data Flow',
          items: ['remote/uploads-files-and-host-processing'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Manage',
      link: { type: 'doc', id: 'manage/index' },
      items: [
        {
          type: 'category',
          label: 'Account And Setup',
          items: ['manage/account-and-devices', 'manage/settings-guide', 'manage/updates'],
        },
        {
          type: 'category',
          label: 'Security And Support',
          items: ['manage/security-and-permissions', 'manage/troubleshooting', 'manage/faq'],
        },
      ],
    },
  ],
};

module.exports = navigation;
