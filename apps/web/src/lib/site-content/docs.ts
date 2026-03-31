import type { DocsSection, SiteLocale } from './types';

const docsContent: Record<SiteLocale, DocsSection> = {
  en: {
    badge: 'Documentation',
    title: 'ContextGo Docs',
    description:
      'Customer-facing documentation for setup, agents, hooks, scheduled tasks, skill market, remote access, and release operations.',
    featuredLabel: 'Documentation structure',
    featuredDescription:
      'ContextGo docs split into three layers: Guides explain how to start, Features explain what the product can do, and Operations explain how remote access, cloud identity, and release workflows actually work.',
    categories: [
      {
        id: 'guides',
        title: 'Guides',
        description: 'Start here to understand the product model, install flow, and how users should approach the first working setup.',
      },
      {
        id: 'features',
        title: 'Features',
        description: 'These docs explain the functional surfaces users actually operate: agents, hooks, schedules, runtimes, connectors, and the skill market.',
      },
      {
        id: 'operations',
        title: 'Operations',
        description: 'These docs define cloud account behavior, remote-access mechanics, release operations, and troubleshooting guidance.',
      },
    ],
    entries: [
      {
        slug: 'quick-start',
        category: 'guides',
        eyebrow: 'Quick Start',
        title: 'Set up ContextGo on your first desktop',
        summary:
          'Install the desktop app, sign in, bind the current device, and confirm the local host is ready for mobile and browser access.',
        readingTime: '5 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Install the desktop host first',
            paragraphs: [
              'ContextGo starts from the desktop app because the desktop machine is the real execution host. It owns the local workspace, the WebUI runtime, and the remote-access bridge.',
              'For direct installs, use the download center on contextgo.io. The website reads release artifacts from contextgo/contextgo-releases, so the download page and in-app update flow point at the same version source.',
            ],
          },
          {
            heading: 'Sign in and bind the device',
            paragraphs: [
              'Use the cloud-account entry in the desktop app to sign in with GitHub or Google. Once the browser flow completes, ContextGo registers the current desktop as a cloud-linked device.',
              'The cloud account does not move execution into the cloud. It links identity, device registration, and lightweight sync metadata so your devices can find each other.',
            ],
            bullets: [
              'Desktop remains the host',
              'Cloud account links identity and devices',
              'Mobile and web discover devices through the cloud layer',
            ],
          },
          {
            heading: 'Confirm the local host is healthy',
            paragraphs: [
              'After sign-in, confirm the WebUI can be opened locally and the device appears as active. If you plan to use remote access, make sure the remote status is provisioned or otherwise explicitly enabled for your environment.',
              'If a corporate environment blocks helper processes or networking tools, test on another machine before assuming the product model is wrong. The most common failures here are local policy, endpoint protection, or missing permissions.',
            ],
          },
        ],
      },
      {
        slug: 'product-model',
        category: 'guides',
        eyebrow: 'Product Model',
        title: 'Understand the ContextGo product model before you scale usage',
        summary:
          'Clarify the relationship between desktop host, mobile shell, cloud account, WebUI, and the release repository before onboarding more devices or teammates.',
        readingTime: '6 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'ContextGo is not just a chat UI',
            paragraphs: [
              'The product starts from context infrastructure, not from a standalone chat surface. Connectors, agents, hooks, scheduled tasks, and channel publishing all exist to keep context and execution close to the real workflow.',
              'That is why the documentation center cannot stop at install steps. Users also need a clear explanation of what runs where and how the feature surfaces relate to one another.',
            ],
          },
          {
            heading: 'Desktop host, cloud control plane, mobile client',
            paragraphs: [
              'The desktop app remains the execution host. The cloud account links identity and devices. Mobile and browser clients operate as control surfaces that discover and connect back to those hosts.',
              'Release operations stay separate again: contextgo/contextgo-releases is the product-release source of truth for installable artifacts, checksums, and release history.',
            ],
            bullets: [
              'Desktop owns execution',
              'Cloud owns identity and device discovery',
              'Release repository owns artifact truth',
            ],
          },
          {
            heading: 'How to read the rest of the docs',
            paragraphs: [
              'Read Guides first if you are onboarding. Read Features when you are configuring agents, hooks, scheduled tasks, or the skill market. Read Operations when you are enabling remote access, investigating device status, or preparing releases.',
            ],
          },
        ],
      },
      {
        slug: 'agent-workspace',
        category: 'features',
        eyebrow: 'Agent',
        title: 'Agent entry, assistants, and the working model inside ContextGo',
        summary:
          'Understand what the agent entry is for, how assistant management differs from agent entry, and why those concepts should not be collapsed into one vague settings bucket.',
        readingTime: '7 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Agent entry is the execution-facing surface',
            paragraphs: [
              'The agent entry should be treated as the place where users pick or launch the active working mode. It is the operational surface for starting work, not just a catalog of saved assistant definitions.',
              'If the UI mixes agent entry, remote access, and assistant management under one ambiguous label, users cannot tell whether they are choosing a runtime, choosing a workflow, or editing a preset.',
            ],
          },
          {
            heading: 'Assistants are managed definitions, not the whole runtime story',
            paragraphs: [
              'Assistant management belongs to the configuration layer. It defines reusable presets, capabilities, instructions, or runtime associations. That is different from the main working surface where the user chooses how to execute the next task.',
              'This distinction matters even more when multiple runtimes are installed, because the runtime layer, the assistant layer, and the active execution surface should remain separate in the information architecture.',
            ],
            bullets: [
              'Agent entry: start work',
              'Assistant management: configure reusable definitions',
              'Runtime management: install and repair execution backends',
            ],
          },
          {
            heading: 'Recommended information architecture',
            paragraphs: [
              'For users, the cleanest mental model is usually: Work with agents from the main surface, manage assistants in configuration, and manage runtimes in a dedicated runtime area. This keeps product structure coherent as more providers and workflows are added.',
            ],
          },
        ],
      },
      {
        slug: 'agent-collaboration',
        category: 'features',
        eyebrow: 'Collaboration',
        title: 'Harness mode and agent collaboration workflows',
        summary:
          'Explain how local harness mode coexists with remote workflows, and why agent collaboration is a first-class working style rather than an implementation detail.',
        readingTime: '7 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Harness mode is a real product workflow',
            paragraphs: [
              'Local harness mode should be kept as a supported collaboration model, not treated as a temporary development artifact. It gives users an immediate way to structure multi-agent work around the local machine they already trust.',
              'That is especially valuable for users who need an out-of-the-box collaboration pattern before they have a full remote orchestration or cloud-hosted workflow in place.',
            ],
          },
          {
            heading: 'How it fits with remote workflows',
            paragraphs: [
              'Remote workflow support does not replace harness mode. The right product story is coexistence: local harness mode for direct, device-local coordination, and remote workflow support for distributed or browser-mediated control paths.',
              'Once this is documented clearly, users stop reading the two modes as competing architectures. They become two ways to coordinate the same host-centric execution model.',
            ],
          },
          {
            heading: 'What users need to know operationally',
            paragraphs: [
              'Collaboration mode documentation should answer which machine executes work, where files live, how runtime availability is checked, and what remote clients can or cannot do compared with the local desktop host.',
            ],
          },
        ],
      },
      {
        slug: 'hooks-overview',
        category: 'features',
        eyebrow: 'Hooks',
        title: 'Use hooks to extend workflows at the right moment',
        summary:
          'Hooks are the product mechanism for inserting controlled behavior around execution events. Users need a clear trigger model, not just a configuration form.',
        readingTime: '6 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'What a hook is in product terms',
            paragraphs: [
              'A hook is a controlled extension point in the workflow. It lets ContextGo run additional logic around a meaningful event instead of forcing users to manually repeat the same coordination step every time.',
              'This can include validation, formatting, notifications, routing, or post-processing, depending on what surfaces the product exposes.',
            ],
          },
          {
            heading: 'Document triggers before implementation details',
            paragraphs: [
              'Users first need to understand when a hook can run: before work starts, after output arrives, when a publish action happens, or when a task reaches a state transition. Without that model, hook configuration looks arbitrary.',
              'Once the trigger model is clear, the rest of the document can explain inputs, outputs, and safety boundaries.',
            ],
            bullets: [
              'What event triggers the hook',
              'What context the hook receives',
              'What side effects the hook is allowed to produce',
            ],
          },
          {
            heading: 'Why hooks matter for ContextGo',
            paragraphs: [
              'Hooks are a bridge between context-aware work and repeatable automation. They make it possible to keep human review in the loop while still standardizing the repetitive parts of a workflow.',
            ],
          },
        ],
      },
      {
        slug: 'scheduled-tasks',
        category: 'features',
        eyebrow: 'Scheduled Tasks',
        title: 'Scheduled tasks and cron-driven automation',
        summary:
          'Explain how periodic execution works, what kinds of automation belong in scheduled tasks, and what users should watch for in long-running operations.',
        readingTime: '6 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Scheduled tasks are recurring workflows',
            paragraphs: [
              'A scheduled task should be described as a recurring workflow with defined timing, execution context, and output behavior. The point is not just to fire a timer, but to repeatedly run a meaningful context-aware action.',
              'Examples include recurring sync, periodic review, automated publish preparation, or routine context extraction from connected systems.',
            ],
          },
          {
            heading: 'Document execution boundaries clearly',
            paragraphs: [
              'Users need to know what host executes the task, whether the machine must stay online, and which runtime or credentials the task depends on. Without that information, cron-like configuration becomes unreliable in real usage.',
              'Scheduled tasks should also document how failures are surfaced and whether a missed run is retried, skipped, or queued.',
            ],
          },
          {
            heading: 'Best-fit use cases',
            paragraphs: [
              'The strongest use cases are routine, repeatable operations that benefit from context but do not require a human to sit and click through the same sequence every day.',
            ],
          },
        ],
      },
      {
        slug: 'skill-market',
        category: 'features',
        eyebrow: 'Skill Market',
        title: 'Skill Market and reusable capability packages',
        summary:
          'Show users how the skill market expands what ContextGo can do, how to think about local versus downloadable skills, and how installation should stay trustworthy.',
        readingTime: '6 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Skills extend workflow capability',
            paragraphs: [
              'The skill market is not just an add-on gallery. It is the mechanism that lets ContextGo adopt domain-specific workflows, instructions, or packaged capabilities without forcing every feature into the main product binary.',
              'That keeps the platform extensible while still presenting a coherent user experience.',
            ],
          },
          {
            heading: 'Installation trust matters',
            paragraphs: [
              'Users need to understand whether a skill is built-in, local, or downloaded. They should also know whether a skill only adds prompts and instructions, or whether it brings code, scripts, or network-facing behavior with it.',
              'Good documentation makes it clear what is being installed, where it lives, and how to remove or update it safely.',
            ],
            bullets: [
              'Built-in skill versus downloaded skill',
              'What files or behavior a skill introduces',
              'How updates and removals are handled',
            ],
          },
          {
            heading: 'Why this is core to the product',
            paragraphs: [
              'A strong skill market turns ContextGo from a fixed feature set into a product that can adapt to new domains without turning the main interface into a cluttered platform switchboard.',
            ],
          },
        ],
      },
      {
        slug: 'runtime-management',
        category: 'features',
        eyebrow: 'Runtimes',
        title: 'Manage local runtimes and CLI health',
        summary:
          'Install supported runtimes, repair broken CLI environments, and understand why a runtime can be installed but still not be usable yet.',
        readingTime: '6 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Installed is not the same as ready',
            paragraphs: [
              'ContextGo can install or repair supported local runtimes, but a successful install only means the CLI exists on the machine. Some runtimes still need provider login or API configuration before they can actually run work.',
              'The product should continue to keep these states separate in the UI so users do not read a green install result as a guarantee that every runtime is fully authenticated and ready.',
            ],
          },
          {
            heading: 'Repair flows should be conservative',
            paragraphs: [
              'A repair action is meant to restore the expected CLI installation path, clear obviously broken local caches, and then re-run detection. It should not silently rewrite unrelated user tools or global configuration beyond the runtime it owns.',
              'If your team supports multiple runtimes, keep the runtime manager explicit about which providers are supported and which ones still need user action after installation.',
            ],
          },
          {
            heading: 'Recommended operational model',
            paragraphs: [
              'Treat runtime installation as a product convenience layer on top of official vendor CLIs. This keeps ContextGo responsible for discovery, install orchestration, repair, and status display, while leaving provider authentication in the official path that users already trust.',
            ],
          },
        ],
      },
      {
        slug: 'connectors-and-channels',
        category: 'features',
        eyebrow: 'Connectors',
        title: 'Connectors, channels, and publishing paths',
        summary:
          'Explain how sources and channels fit into ContextGo, and why connectors are part of the product core rather than optional integrations.',
        readingTime: '6 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Connectors are the intake layer',
            paragraphs: [
              'Connectors are how ContextGo sees the real working context. Files, docs, drives, chats, and structured systems all enter through this layer before agents, hooks, or scheduled tasks can do useful work.',
              'That is why connector documentation should not read like a simple list of integrations. It should explain how connected sources become reusable context across multiple workflows.',
            ],
          },
          {
            heading: 'Channels are where work gets routed outward',
            paragraphs: [
              'Channels represent the outward side of the workflow: publishing, team communication, or delivery surfaces. In many cases, the same context that was ingested through connectors later exits through one or more channels.',
              'This makes connectors and channels two ends of the same product story: context comes in, gets shaped, and then moves to the place where action happens.',
            ],
          },
          {
            heading: 'What users need to understand',
            paragraphs: [
              'Users should know which systems are supported, what level of access is needed, and how connected context feeds agents, scheduled tasks, remote sessions, or publication flows.',
            ],
          },
        ],
      },
      {
        slug: 'remote-access',
        category: 'operations',
        eyebrow: 'Remote Access',
        title: 'How remote access works in ContextGo',
        summary:
          'Understand the desktop-host model, why remote access depends on a stable device-side connection, and what users should expect on mobile.',
        readingTime: '7 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Desktop is the source of truth',
            paragraphs: [
              'ContextGo remote access is not a separate cloud-hosted copy of your app. The desktop machine keeps running the real workspace, tools, files, and WebUI session.',
              'Mobile and browser clients connect back to that desktop host through the remote layer. This is why a device can appear online, unavailable, or not provisioned depending on the state of the host and the remote bridge.',
            ],
          },
          {
            heading: 'Why a stable device-side connection matters',
            paragraphs: [
              'A public remote page only works when the desktop host has an active outbound connection to the relay or tunnel layer. In the earlier FRP-based design, that meant the desktop had to keep a stable FRP client session.',
              'The same product principle remains true even if the transport changes. Whether you use FRP, Cloudflare Tunnel, or a custom relay, the device side still has to remain connected and authenticated.',
            ],
            bullets: [
              'Desktop host publishes availability',
              'Cloud account maps devices to the signed-in user',
              'Remote page becomes useful only when the host is reachable',
            ],
          },
          {
            heading: 'What mobile actually runs',
            paragraphs: [
              'The mobile shell is a remote control surface. It reuses the existing WebUI and host-side workflows instead of replacing the desktop host with a separate mobile-native execution model.',
              'That means uploads, runtime execution, and local workspace access still terminate on the desktop side. Mobile acts as the control surface, not the primary compute environment.',
            ],
          },
        ],
      },
      {
        slug: 'cloud-account',
        category: 'operations',
        eyebrow: 'Cloud Account',
        title: 'What the ContextGo cloud account syncs',
        summary:
          'Clarify what the cloud layer is for, what gets linked to the account, and why it should not be confused with full cloud execution.',
        readingTime: '6 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Identity, not full migration',
            paragraphs: [
              'The cloud account exists to bind a user identity to one or more desktop devices and to support multi-device discovery. It is the control plane, not the execution plane.',
              'In practical terms, cloud sign-in helps ContextGo know which desktop devices belong to you, whether a browser session is valid, and whether a mobile or web client can enumerate the same device list.',
            ],
          },
          {
            heading: 'What can sync across devices',
            paragraphs: [
              'The current cloud layer is suited for lightweight state such as language preference, device registration, and remote capability metadata. It should not be described as syncing the entire desktop workspace.',
              'As the product matures, more lightweight preferences can move into the cloud account without changing the core principle that local execution stays on the desktop.',
            ],
            bullets: [
              'Language preference',
              'Signed-in browser session state',
              'Device registration and remote capability state',
            ],
          },
          {
            heading: 'What does not automatically move to the cloud',
            paragraphs: [
              'Workspace files, local runtimes, active host processes, and host-side WebUI state still live on the desktop machine. If a user expects a full cloud-hosted clone of the desktop, the product positioning needs to be explicit that this is not the default model.',
            ],
          },
        ],
      },
      {
        slug: 'updates-and-troubleshooting',
        category: 'operations',
        eyebrow: 'Updates',
        title: 'Updates, releases, and common troubleshooting paths',
        summary:
          'Document how in-app updates relate to the website download center and release repository, and give users a single operational troubleshooting entry point.',
        readingTime: '7 min',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'One version source should serve everything',
            paragraphs: [
              'Users should be able to trust that the desktop updater, the website download center, and the GitHub release page are describing the same version truth. That is the reason contextgo/contextgo-releases exists as a dedicated release repository.',
              'If the website says one thing and the in-app updater says another, the release pipeline is not coherent enough yet.',
            ],
          },
          {
            heading: 'Common failure categories',
            paragraphs: [
              'The troubleshooting entry should cover the real user-facing failures: browser login does not complete, remote status is unavailable, device binding does not refresh, update checks flash an error, or a runtime is installed but still unusable.',
              'This kind of page is especially important because users do not care which internal subsystem failed. They care about the operational symptom they can see.',
            ],
            bullets: [
              'Login and browser-session failures',
              'Device status and remote availability failures',
              'Runtime detection and authentication failures',
              'Update and release-distribution failures',
            ],
          },
          {
            heading: 'What this page should always tell the user',
            paragraphs: [
              'A good troubleshooting page tells the user what the symptom means, what the likely cause categories are, and what to check next in the least destructive order.',
            ],
          },
        ],
      },
    ],
  },
  zh: {
    badge: '文档中心',
    title: 'ContextGo 文档',
    description: '面向客户的产品文档，覆盖安装、Agent、Hooks、定时任务、技能市场、远程访问与版本运维。',
    featuredLabel: '文档结构',
    featuredDescription:
      'ContextGo 文档现在分成三层：Guides 负责上手，Features 负责解释功能面，Operations 负责解释远程访问、云身份和发版运维。',
    categories: [
      {
        id: 'guides',
        title: 'Guides',
        description: '先看这些文档，理解产品模型、安装流程，以及第一套可工作的初始化路径。',
      },
      {
        id: 'features',
        title: 'Features',
        description: '这些文档解释用户真正会操作的功能面：Agent、Hooks、定时任务、Runtime、Connectors 和技能市场。',
      },
      {
        id: 'operations',
        title: 'Operations',
        description: '这些文档定义云账号、远程访问、发布运维和故障排查的工作方式。',
      },
    ],
    entries: [
      {
        slug: 'quick-start',
        category: 'guides',
        eyebrow: '快速开始',
        title: '在第一台桌面设备上完成 ContextGo 初始化',
        summary:
          '安装桌面端、登录云账号、绑定当前设备，并确认本地主机已经为移动端和浏览器访问准备完成。',
        readingTime: '5 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: '先安装桌面主机',
            paragraphs: [
              'ContextGo 的起点是桌面端，因为桌面设备才是真正的执行主机。它持有本地工作区、WebUI 运行时和远程访问桥接能力。',
              '直链安装包应从 contextgo.io 下载中心进入。网站读取的是 contextgo/contextgo-releases 里的版本产物，因此下载页和桌面端内的更新链路应该指向同一份版本事实来源。',
            ],
          },
          {
            heading: '登录并绑定设备',
            paragraphs: [
              '通过桌面端里的云账号入口，使用 GitHub 或 Google 登录。浏览器流程完成后，ContextGo 会把当前桌面设备注册成云端账号下的一台设备。',
              '云账号并不是把执行搬到云端，而是把身份、设备注册和轻量同步状态绑定起来，让多台设备能够相互发现。',
            ],
            bullets: [
              '桌面端仍然是执行主机',
              '云账号负责身份与设备绑定',
              '移动端和网页通过云层发现同一批设备',
            ],
          },
          {
            heading: '确认本地主机状态正常',
            paragraphs: [
              '登录之后，先确认 WebUI 能在本地打开，设备状态显示为 active。如果你要用远程访问，再继续确认 remote 状态已经 provisioned，或者至少在你的环境中被显式启用。',
              '如果企业环境会拦截辅助进程或网络工具，先换设备验证，不要第一时间怀疑产品模型本身。这里最常见的问题仍然是本地安全策略、终端防护或缺少权限。',
            ],
          },
        ],
      },
      {
        slug: 'product-model',
        category: 'guides',
        eyebrow: '产品模型',
        title: '先理解 ContextGo 的产品模型，再扩大使用范围',
        summary:
          '先厘清桌面主机、移动壳、云账号、WebUI 和 release 仓库之间的关系，再去扩展更多设备和团队使用。',
        readingTime: '6 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'ContextGo 不只是一个聊天界面',
            paragraphs: [
              '这个产品的起点是上下文基础设施，而不是一个孤立聊天框。Connectors、Agent、Hooks、定时任务和渠道发布，都是为了让上下文和执行继续贴近真实工作流。',
              '因此文档中心不能只停留在安装步骤，也必须把“功能是怎么互相配合的”讲清楚。',
            ],
          },
          {
            heading: '桌面主机、云控制平面、移动客户端',
            paragraphs: [
              '桌面端仍然是执行主机。云账号负责身份与设备发现。移动端和浏览器端是控制面，用来发现并连接这些主机。',
              '版本运维又是另一条线：contextgo/contextgo-releases 是安装包、校验值和版本历史的事实来源。',
            ],
            bullets: [
              '桌面端负责执行',
              '云端负责身份与设备发现',
              'release 仓库负责产物事实来源',
            ],
          },
          {
            heading: '后面的文档怎么读',
            paragraphs: [
              '如果你是第一次上手，先读 Guides。如果你要配置 Agent、Hooks、定时任务或技能市场，读 Features。如果你在做远程访问、设备排查或发版运维，读 Operations。',
            ],
          },
        ],
      },
      {
        slug: 'agent-workspace',
        category: 'features',
        eyebrow: 'Agent',
        title: 'Agent 入口、Assistants 管理与工作模型',
        summary:
          '理解 Agent 入口是干什么的、Assistants 管理和它有什么区别，以及为什么这些概念不应该混在一个模糊设置里。',
        readingTime: '7 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Agent 入口是面向执行的工作面',
            paragraphs: [
              'Agent 入口应该被视为用户选择或启动当前工作模式的地方。它是执行面，不应该只是一个保存配置的列表页。',
              '如果界面把 Agent 入口、远程访问和 Assistants 管理全部混在一起，用户就很难分辨自己现在是在选工作方式、选 Runtime，还是在改预设。',
            ],
          },
          {
            heading: 'Assistants 是配置层，不是全部工作面',
            paragraphs: [
              'Assistants 管理属于配置层，负责保存可复用的定义、能力、指令或 Runtime 绑定。它和真正开始执行工作的主界面是不同层次。',
              '特别是在支持多个 Runtime 之后，这个区分会更加重要，因为 Runtime 层、Assistant 层和当前执行层必须保持分离。',
            ],
            bullets: [
              'Agent 入口：开始工作',
              'Assistants 管理：维护可复用定义',
              'Runtime 管理：安装与修复执行后端',
            ],
          },
          {
            heading: '推荐的信息架构',
            paragraphs: [
              '对用户来说，最清晰的模型通常是：在主工作面里使用 Agent，在配置区管理 Assistants，在独立 Runtime 区管理底层执行后端。这样随着 provider 和工作流增多，信息架构才不会变形。',
            ],
          },
        ],
      },
      {
        slug: 'agent-collaboration',
        category: 'features',
        eyebrow: '协作模式',
        title: 'Harness 模式与 Agent 协作工作流',
        summary:
          '解释本地 harness 模式如何与远端 workflow 共存，以及为什么 Agent 协作模式是产品的一等工作方式。',
        readingTime: '7 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Harness 模式是一种真实的产品工作流',
            paragraphs: [
              '本地 harness 模式不应该被当成临时开发技巧，而应该被保留成受支持的协作模型。它让用户在自己已经信任的本机环境里，快速进入多 Agent 协作。',
              '这对还没有完整远端编排环境的用户尤其重要，因为它提供了一种开箱即用的协作实践。',
            ],
          },
          {
            heading: '它如何和远端 workflow 共存',
            paragraphs: [
              '远端 workflow 并不是用来替代 harness 模式的。正确的产品叙事是兼容共存：本地 harness 负责设备内直接协作，远端 workflow 负责分布式或浏览器侧控制链路。',
              '一旦文档把这点说清楚，用户就不会把两者误读成冲突的技术路线，而会理解成同一套主机模型上的两种协作方式。',
            ],
          },
          {
            heading: '用户最需要知道什么',
            paragraphs: [
              '协作模式文档必须回答：哪台机器在执行、文件在哪里、Runtime 怎么检测、远端客户端相对本地主机有哪些能力边界。',
            ],
          },
        ],
      },
      {
        slug: 'hooks-overview',
        category: 'features',
        eyebrow: 'Hooks',
        title: '在合适的时机用 Hooks 扩展工作流',
        summary:
          'Hooks 是在执行事件附近插入受控行为的机制。用户需要看到清晰的触发模型，而不是一个孤立配置表单。',
        readingTime: '6 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: '从产品角度看 Hook 是什么',
            paragraphs: [
              'Hook 是工作流中的一个受控扩展点。它让 ContextGo 能在关键事件附近自动执行额外逻辑，而不是让用户每次重复做同样的协调动作。',
              '它可以承担校验、格式整理、通知、路由或后处理，具体取决于产品暴露了哪些触发点。',
            ],
          },
          {
            heading: '先讲触发模型，再讲实现细节',
            paragraphs: [
              '用户首先需要知道 Hook 会在什么时候运行，例如开始前、输出后、发布动作发生时，或任务状态切换时。没有这个模型，Hook 配置就会显得很随机。',
              '触发模型清楚之后，再去解释输入、输出和安全边界，用户才容易真正理解。',
            ],
            bullets: [
              '什么事件会触发 Hook',
              'Hook 会收到哪些上下文',
              'Hook 被允许产生什么副作用',
            ],
          },
          {
            heading: '为什么它对 ContextGo 很重要',
            paragraphs: [
              'Hooks 把上下文工作和可重复自动化连接起来，让产品既能保留人工审阅，又能把重复步骤标准化。',
            ],
          },
        ],
      },
      {
        slug: 'scheduled-tasks',
        category: 'features',
        eyebrow: '定时任务',
        title: '定时任务与 Cron 驱动自动化',
        summary:
          '解释周期执行是如何工作的、哪些自动化适合放进定时任务，以及长时间运行场景下用户应该关注什么。',
        readingTime: '6 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: '定时任务是周期性工作流',
            paragraphs: [
              '定时任务应该被描述成有固定时间、执行上下文和输出行为的周期性工作流，而不只是“触发一个定时器”。',
              '典型场景包括周期同步、定期审阅、自动生成发布准备内容，或者从已接入系统里按节奏抽取上下文。',
            ],
          },
          {
            heading: '执行边界必须说明白',
            paragraphs: [
              '用户需要知道是哪台主机在执行任务、机器是否必须在线，以及它依赖哪套 Runtime 或凭证。没有这些说明，Cron 配置在真实环境里很容易变得不可靠。',
              '定时任务还需要说明失败如何呈现，以及漏跑之后是重试、跳过，还是排队等待下一次机会。',
            ],
          },
          {
            heading: '最适合的使用方式',
            paragraphs: [
              '它最适合那些规律性强、可重复、需要上下文但不需要人每天手工点一遍的工作。',
            ],
          },
        ],
      },
      {
        slug: 'skill-market',
        category: 'features',
        eyebrow: '技能市场',
        title: '技能市场与可复用能力包',
        summary:
          '让用户理解技能市场如何扩展 ContextGo、如何看待本地 skill 与下载 skill，以及安装信任边界应该怎么讲。',
        readingTime: '6 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Skill 在产品里承担什么角色',
            paragraphs: [
              '技能市场不只是一个附加组件列表，而是让 ContextGo 在不把所有能力都塞进主二进制的情况下，继续吸收领域化工作流和能力包的机制。',
              '这让平台保持可扩展，同时还能保留统一体验。',
            ],
          },
          {
            heading: '安装信任边界很重要',
            paragraphs: [
              '用户需要知道当前 skill 是内置的、本地的，还是下载的；也需要知道它只是补充提示词和说明，还是会带来脚本、代码或联网行为。',
              '好的文档应该把“安装了什么、它放在哪里、如何更新和移除”讲清楚。',
            ],
            bullets: [
              '内置 skill 与下载 skill 的区别',
              'skill 会引入哪些文件或行为',
              '如何更新和卸载',
            ],
          },
          {
            heading: '为什么这是核心能力',
            paragraphs: [
              '一个好的技能市场会让 ContextGo 从固定功能集合变成可持续适配新领域的平台，而不是把主界面堆成一个杂乱开关板。',
            ],
          },
        ],
      },
      {
        slug: 'runtime-management',
        category: 'features',
        eyebrow: '运行时',
        title: '本地运行时与 CLI 健康管理',
        summary:
          '安装支持的运行时、修复损坏的 CLI 环境，并理解为什么“已安装”并不等于“已可用”。',
        readingTime: '6 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: '安装成功不等于立即可用',
            paragraphs: [
              'ContextGo 可以帮助用户安装或修复本地运行时，但安装成功只代表 CLI 已经在机器上存在。有些 runtime 仍然需要用户完成官方登录或 API 配置，才能真正开始工作。',
              '产品界面应该继续把这两类状态分开显示，避免用户把“安装完成”误读成“已经完成认证并可立即运行”。',
            ],
          },
          {
            heading: '修复动作应该足够克制',
            paragraphs: [
              '修复的目标应该是恢复受支持 CLI 的安装路径、清理明显损坏的本地缓存，并重新执行检测。它不应该静默篡改用户无关的全局工具链或其他配置。',
              '如果产品支持多种 runtime，就应该明确告诉用户哪些 provider 已接入自动安装，哪些 provider 仍然需要额外手工动作。',
            ],
          },
          {
            heading: '推荐的运维模型',
            paragraphs: [
              '把 runtime 安装层视为官方 CLI 之上的产品便利能力。这样 ContextGo 负责发现、安装编排、修复和状态展示，而 provider 认证仍然走用户已经熟悉的官方路径。',
            ],
          },
        ],
      },
      {
        slug: 'connectors-and-channels',
        category: 'features',
        eyebrow: 'Connectors',
        title: 'Connectors、渠道与发布路径',
        summary:
          '解释来源接入和渠道发布如何构成同一条产品链路，以及为什么 Connectors 不只是可选集成。',
        readingTime: '6 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: 'Connectors 是输入层',
            paragraphs: [
              'Connectors 是 ContextGo 看到真实工作上下文的入口。文件、文档、云盘、聊天和结构化系统，都先通过这一层进入，后面的 Agent、Hooks 和定时任务才能真正有用。',
              '所以 connector 文档不应该只是“支持了哪些集成”的列表，而应该解释接入后的上下文会如何被复用。',
            ],
          },
          {
            heading: '渠道是输出层',
            paragraphs: [
              '渠道代表上下文流出去的方向，例如发布、团队沟通或投递面。很多时候，前面接入的上下文，最终会通过一个或多个渠道继续流向下一步工作。',
              '这让 Connectors 和渠道形成同一条产品叙事：上下文先接进来，再被整理，再流向行动发生的地方。',
            ],
          },
          {
            heading: '用户最需要知道什么',
            paragraphs: [
              '用户应该知道支持哪些系统、接入需要什么权限，以及接入后的上下文如何流向 Agent、定时任务、远程会话或发布流程。',
            ],
          },
        ],
      },
      {
        slug: 'remote-access',
        category: 'operations',
        eyebrow: '远程访问',
        title: 'ContextGo 的远程访问到底是怎么工作的',
        summary:
          '理解桌面主机模型、为什么远程访问依赖设备侧稳定连接，以及移动端应该向用户呈现什么预期。',
        readingTime: '7 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: '桌面端才是事实主机',
            paragraphs: [
              'ContextGo 的远程访问不是在云端重新起一份应用副本。真正的工作区、工具、文件和 WebUI 会话仍然运行在桌面设备上。',
              '移动端和浏览器端只是通过远程层连接回桌面主机。所以设备才会出现 online、unavailable 或 not provisioned 这类状态，取决于主机和远程桥接的健康度。',
            ],
          },
          {
            heading: '为什么设备侧稳定连接很重要',
            paragraphs: [
              '公开 remote 页面只有在桌面主机对外建立了稳定的出站连接之后才有意义。早期基于 FRP 的方案，本质就是要求桌面端长期维持 FRP client 会话。',
              '即便未来把传输层换成 Cloudflare Tunnel 或自建 relay，产品原则也不会变。无论底层是什么，设备侧都必须持续在线并完成认证。',
            ],
            bullets: [
              '桌面主机负责发布可用性',
              '云账号负责把设备映射到用户',
              '只有主机可达时，remote 页面才真正可用',
            ],
          },
          {
            heading: '移动端真正运行的是什么',
            paragraphs: [
              '移动壳的定位是远程控制面。它复用现有 WebUI 和主机侧流程，而不是把桌面执行模型替换成一套新的手机本地执行模型。',
              '这意味着上传、运行时执行和本地工作区访问，最终还是落在桌面端。移动端是使用面，不是主计算面。',
            ],
          },
        ],
      },
      {
        slug: 'cloud-account',
        category: 'operations',
        eyebrow: '云账号',
        title: 'ContextGo 云账号到底同步了什么',
        summary:
          '澄清云层的职责、账号会绑定哪些状态，以及为什么它不应该被描述成完整的云执行环境。',
        readingTime: '6 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: '绑定身份，不是整体迁云',
            paragraphs: [
              '云账号的职责是把一个用户身份和一台或多台桌面设备绑定起来，并支持多端发现。这是控制平面，不是执行平面。',
              '落到产品上，云登录让 ContextGo 能知道哪些桌面设备属于你、浏览器会话是否还有效，以及移动端或网页是否应该展示同一份设备列表。',
            ],
          },
          {
            heading: '什么状态适合跨设备同步',
            paragraphs: [
              '当前云层更适合承载轻量状态，例如语言偏好、设备注册和远程能力元数据。不应该把它表述成“完整同步整台桌面工作区”。',
              '随着产品演进，可以继续把更多轻量偏好放进云账号，但不应该改变“执行仍留在桌面端”的核心原则。',
            ],
            bullets: [
              '语言偏好',
              '浏览器登录会话状态',
              '设备注册与远程能力状态',
            ],
          },
          {
            heading: '什么不会自动上云',
            paragraphs: [
              '工作区文件、本地 runtime、主机进程和主机侧 WebUI 状态，默认仍然留在桌面设备上。如果用户期待的是一份完整托管在云端的桌面副本，产品表述必须明确这不是默认模型。',
            ],
          },
        ],
      },
      {
        slug: 'updates-and-troubleshooting',
        category: 'operations',
        eyebrow: '更新与排障',
        title: '更新、版本发布与常见排障入口',
        summary:
          '把桌面端内更新、官网下载页和 release 仓库之间的关系讲清楚，并给用户一个统一的运维排障入口。',
        readingTime: '7 分钟',
        updatedAt: '2026-03-30',
        sections: [
          {
            heading: '一份版本来源，服务所有更新入口',
            paragraphs: [
              '用户应该能够相信桌面端更新、官网下载页和 GitHub 版本页说的是同一件事。这就是 contextgo/contextgo-releases 存在的原因，它是安装产物的事实来源。',
              '如果官网显示一套版本、桌面端里又显示另一套，就说明发布链路还没有真正收口。',
            ],
          },
          {
            heading: '最常见的故障类别',
            paragraphs: [
              '这个排障入口应该覆盖用户真正能感知到的问题：浏览器登录没完成、remote 状态 unavailable、设备绑定没刷新、更新检查中途闪失败，或者 Runtime 已安装但仍不可用。',
              '用户并不关心内部到底是哪一个子系统报错，他们只关心眼前的运维症状。',
            ],
            bullets: [
              '登录和浏览器会话问题',
              '设备状态与远程访问问题',
              'Runtime 检测与认证问题',
              '更新与版本分发问题',
            ],
          },
          {
            heading: '这类页面必须提供什么',
            paragraphs: [
              '好的排障文档必须告诉用户：这个现象意味着什么、最可能的原因类别有哪些、下一步应该按什么最不具破坏性的顺序检查。',
            ],
          },
        ],
      },
    ],
  },
};

export const getDocsSection = (locale: SiteLocale) => docsContent[locale];
