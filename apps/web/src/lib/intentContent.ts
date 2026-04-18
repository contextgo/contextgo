import type { SiteLocale } from './public-content/types';

export const INTENT_PAGE_SLUGS = [
  'ai-workbench',
  'multi-agent-collaboration-workspace',
  'remote-ai-workspace',
  'context-engine-for-teams',
  'connector-based-knowledge-ops',
  'release-operations-workspace',
] as const;

export type IntentPageSlug = (typeof INTENT_PAGE_SLUGS)[number];
export type IntentSurface = 'home' | 'download' | 'connect';

export type IntentFaqItem = {
  question: string;
  answer: string;
};

export type IntentSection = {
  title: string;
  body: string;
  points: string[];
};

export type IntentPage = {
  slug: IntentPageSlug;
  eyebrow: string;
  title: string;
  summary: string;
  problem: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  sections: [IntentSection, IntentSection, IntentSection];
  faq: [IntentFaqItem, IntentFaqItem, IntentFaqItem];
  relatedSlugs: IntentPageSlug[];
};

export type IntentSurfaceContent = {
  eyebrow: string;
  title: string;
  description: string;
  points: [string, string, string];
  intentSlugs: [IntentPageSlug, IntentPageSlug, IntentPageSlug];
  faqTitle: string;
  faq: [IntentFaqItem, IntentFaqItem, IntentFaqItem];
};

const content: Record<
  SiteLocale,
  {
    pages: IntentPage[];
    surfaces: Record<IntentSurface, IntentSurfaceContent>;
    index: {
      eyebrow: string;
      title: string;
      description: string;
    };
  }
> = {
  en: {
    index: {
      eyebrow: 'Solutions',
      title: 'Search-led entry points for real ContextGo workflows',
      description:
        'These pages answer concrete product questions: what ContextGo is for, how remote use works, how release operations stay trustworthy, and where connectors fit into daily work.',
    },
    surfaces: {
      home: {
        eyebrow: 'Answer First',
        title: 'What ContextGo actually does in one operating model',
        description:
          'ContextGo is not just another chat surface. It connects working context, routes it into agents, and keeps desktop, remote, and release behavior aligned around one product model.',
        points: [
          'Build an AI workbench around files, tasks, docs, channels, and runtime state.',
          'Keep the desktop as the real execution host while remote clients reuse the same workspace.',
          'Let connectors and release operations stay attached to one factual product story.',
        ],
        intentSlugs: ['ai-workbench', 'remote-ai-workspace', 'context-engine-for-teams'],
        faqTitle: 'Homepage FAQ',
        faq: [
          {
            question: 'What is ContextGo in practical terms?',
            answer:
              'ContextGo is a context-first AI workbench. It connects local files, docs, channels, tasks, and runtime state so agents can work inside the same operating context instead of one isolated chat turn at a time.',
          },
          {
            question: 'Who is ContextGo designed for?',
            answer:
              'It is aimed at operators, builders, product teams, and administrators who need one system to coordinate knowledge, execution, remote access, and release operations without splitting the workflow across unrelated tools.',
          },
          {
            question: 'Where does the actual work run?',
            answer:
              'The desktop host remains the real execution environment. Browser and mobile surfaces are remote clients that reuse the same workspace, tools, and context layer from the host.',
          },
        ],
      },
      download: {
        eyebrow: 'Before You Install',
        title: 'Direct downloads, version truth, and install decisions',
        description:
          'The download center should answer the operational questions first: which artifact is current, where it comes from, and how users can install ContextGo without guessing.',
        points: [
          'Website downloads and desktop updates should read from the same release truth.',
          'Android and desktop can ship through direct-download artifacts before store publication.',
          'Checksums, release notes, and artifact metadata need to stay close to each published version.',
        ],
        intentSlugs: ['release-operations-workspace', 'remote-ai-workspace', 'ai-workbench'],
        faqTitle: 'Download FAQ',
        faq: [
          {
            question: 'Can users install ContextGo without going through an app store?',
            answer:
              'Yes. Desktop builds and Android can be distributed by direct download as long as the release page, checksum, and install notes stay explicit. iOS remains a TestFlight or App Store path instead of direct public IPA distribution.',
          },
          {
            question: 'How should users verify that a download is current?',
            answer:
              'They should see one version source across the website, release notes, and updater metadata. That keeps support, installation, and update decisions anchored to the same release record.',
          },
          {
            question: 'Why does the download page talk about operations instead of only listing files?',
            answer:
              'Because install trust depends on more than a button. Users need the release source, artifact details, verification status, and distribution path before they decide which package to install.',
          },
        ],
      },
      connect: {
        eyebrow: 'Connector Model',
        title: 'Connectors are part of the context layer, not decorative integrations',
        description:
          'The connect surface should explain what gets connected, why that matters operationally, and how the same connected context keeps feeding AI work, remote access, and publishing paths.',
        points: [
          'Connect files, docs, channels, tickets, and structured systems into one reusable context layer.',
          'Normalize different systems so agents can work from one operating surface.',
          'Keep the same connected context available to desktop, WebUI, and remote clients.',
        ],
        intentSlugs: [
          'connector-based-knowledge-ops',
          'multi-agent-collaboration-workspace',
          'context-engine-for-teams',
        ],
        faqTitle: 'Connector FAQ',
        faq: [
          {
            question: 'What kinds of systems should ContextGo connect?',
            answer:
              'It should connect the systems that hold working context: docs, drives, channels, tasks, design tools, operational records, and structured data sources that teams already use to make decisions.',
          },
          {
            question: 'What changes after a connector is added?',
            answer:
              'The goal is not another integration badge. The goal is to turn scattered source material into one context layer that can support search, ranking, agent execution, remote use, and publishing workflows.',
          },
          {
            question: 'Do remote and mobile users see the same connected context?',
            answer:
              'Yes. The desktop host keeps the working context and runtime, while remote clients reuse that connected workspace instead of building a separate local copy with different behavior.',
          },
        ],
      },
    },
    pages: [
      {
        slug: 'ai-workbench',
        eyebrow: 'AI Workbench',
        title: 'ContextGo as an AI workbench for real operating context',
        summary:
          'Use ContextGo when the job is not just to chat with a model, but to connect materials, runtime access, and execution history inside one workbench.',
        problem:
          'A generic assistant answers questions. An AI workbench has to connect source material, execution context, and operating surfaces so work can continue across sessions.',
        primaryCtaLabel: 'Open download center',
        primaryCtaHref: '/download',
        secondaryCtaLabel: 'Read the docs',
        secondaryCtaHref: '/docs',
        sections: [
          {
            title: 'Why teams search for an AI workbench',
            body: 'Teams usually start looking for an AI workbench when chat alone stops being enough. They need one place to connect documents, files, tasks, runtime access, and execution history without re-explaining the same context every time.',
            points: [
              'Keep source material attached to the workspace, not pasted ad hoc into prompts.',
              'Make runtime and execution part of the workbench instead of an invisible side channel.',
              'Let remote clients continue the same work instead of opening a second disconnected tool.',
            ],
          },
          {
            title: 'How ContextGo frames the workbench boundary',
            body: 'ContextGo treats the workbench as a context layer plus execution layer. That means connectors, local host runtime, remote access, and publishing flows are part of the same product story rather than separate bolt-ons.',
            points: [
              'Desktop stays the primary execution host.',
              'Browser and mobile extend access to the same workspace.',
              'Connected systems keep feeding the same context model over time.',
            ],
          },
          {
            title: 'What a publishable workbench page should answer',
            body: 'A useful AI workbench page should explain where work runs, what gets connected, and how release or install decisions remain trustworthy. Without that, the page becomes generic AI copy instead of a real product explanation.',
            points: [
              'Clarify host versus remote client behavior.',
              'Show how connectors move source material into the workbench.',
              'Link installation, release truth, and ongoing operation together.',
            ],
          },
        ],
        faq: [
          {
            question: 'How is an AI workbench different from an AI chat app?',
            answer:
              'A workbench keeps context, tools, files, and operating state attached to the job. A chat app usually starts over from whatever the user pastes into a single conversation.',
          },
          {
            question: 'Does ContextGo require teams to move everything into a new system?',
            answer:
              'No. The product model is to connect existing systems, normalize them into a context layer, and let agents work across that layer instead of forcing one giant migration first.',
          },
          {
            question: 'Is ContextGo mainly for developers?',
            answer:
              'No. Builders are one audience, but the workbench model is also for product, operations, publishing, support, and administrators who need the same context to flow through real workflows.',
          },
        ],
        relatedSlugs: ['context-engine-for-teams', 'remote-ai-workspace'],
      },
      {
        slug: 'multi-agent-collaboration-workspace',
        eyebrow: 'Collaboration',
        title: 'A multi-agent collaboration workspace with one shared context',
        summary:
          'Use ContextGo when teams need multiple agents, operators, and contributors working from the same project context instead of passing isolated prompts back and forth.',
        problem:
          'Multi-agent collaboration breaks down quickly if every actor sees a different slice of context, uses different tools, or lacks a stable workspace boundary.',
        primaryCtaLabel: 'Open collaboration docs',
        primaryCtaHref: '/docs',
        secondaryCtaLabel: 'See connectors',
        secondaryCtaHref: '/connect',
        sections: [
          {
            title: 'What a multi-agent workspace must keep stable',
            body: 'If several agents and humans are supposed to collaborate, the product needs shared context, stable operating boundaries, and a clear execution host. Otherwise the workflow turns into brittle prompt passing.',
            points: [
              'Shared context has to outlive one conversation.',
              'Agents need access to the same connected source material.',
              'Operators need one place to inspect and steer the workflow.',
            ],
          },
          {
            title: 'How ContextGo keeps collaboration grounded',
            body: 'ContextGo frames collaboration around projects, spaces, context packs, connectors, and runtime access. That gives teams a stable workspace model before they multiply agent surfaces.',
            points: [
              'Humans and agents work from one evolving context model.',
              'Connected systems keep the workspace aligned with real activity.',
              'Remote access extends the same workspace to other devices.',
            ],
          },
          {
            title: 'Where this matters operationally',
            body: 'A collaboration page should also explain how admins, operators, and support can reason about what happened. Shared context is not only a UX feature. It is how later troubleshooting and governance stay coherent.',
            points: [
              'Keep activity traceable across participants.',
              'Make context ownership and workspace boundaries explicit.',
              'Reduce manual re-briefing across agent and human handoffs.',
            ],
          },
        ],
        faq: [
          {
            question: 'Why not just run several agents in separate chats?',
            answer:
              'Because separate chats create separate memory, separate assumptions, and weak handoffs. A collaboration workspace keeps the context and operating boundary shared from the start.',
          },
          {
            question: 'Do humans stay in the loop?',
            answer:
              'Yes. ContextGo is designed so operators, admins, and contributors can inspect, steer, and approve work instead of treating collaboration as a hidden automation box.',
          },
          {
            question: 'Does this require every system to be connected first?',
            answer:
              'No. Teams can start with the systems that matter most, then expand the connected context as the workflow becomes more mature.',
          },
        ],
        relatedSlugs: ['context-engine-for-teams', 'connector-based-knowledge-ops'],
      },
      {
        slug: 'remote-ai-workspace',
        eyebrow: 'Remote Use',
        title: 'Remote AI workspace access without inventing a second host',
        summary:
          'Use ContextGo when the product has to work across desktop, browser, and mobile, but the real execution host still lives on the desktop machine.',
        problem:
          'Remote AI products become confusing when the market story hides where the real host is. Users then expect local mobile execution even though the workspace still depends on the desktop environment.',
        primaryCtaLabel: 'Read remote docs',
        primaryCtaHref: '/docs',
        secondaryCtaLabel: 'Open download center',
        secondaryCtaHref: '/download',
        sections: [
          {
            title: 'Start with the host and client relationship',
            body: 'The strongest remote product story is the explicit one: the desktop remains the execution host, while browser and mobile surfaces are remote clients that reuse the same workspace.',
            points: [
              'Avoid pretending that the phone is a peer execution host.',
              'Keep remote access aligned with actual runtime behavior.',
              'Teach users where files, tools, and tasks really run.',
            ],
          },
          {
            title: 'How remote work stays coherent',
            body: 'Once the host model is explicit, upload flows, connector access, runtime discovery, and remote task launches become easier to explain and easier to support.',
            points: [
              'Uploads flow into the desktop host for further processing.',
              'Remote clients reuse the same context layer and connected systems.',
              'Support can reason about one execution plane instead of several partial ones.',
            ],
          },
          {
            title: 'Why this matters for public product pages',
            body: 'Remote AI workspace pages should reduce expectation debt. They should tell buyers and admins exactly what “works across devices” means, and what still depends on the host machine being available.',
            points: [
              'Clarify which capabilities require the host to be online.',
              'Show how remote access extends the workbench instead of replacing it.',
              'Keep mobile, browser, and desktop language tied to one product model.',
            ],
          },
        ],
        faq: [
          {
            question: 'Does ContextGo run the same work locally on the phone?',
            answer:
              'No. The phone is a remote client. It can access and control the workspace, but the actual execution host remains the desktop environment.',
          },
          {
            question: 'Can remote users upload local files?',
            answer:
              'Yes. The product model is to upload them into the desktop host through the web flow, then continue processing there so the workspace stays consistent.',
          },
          {
            question: 'Why is this clearer model better for users?',
            answer:
              'Because it aligns the public promise with the actual system. Users understand what requires host availability, and support teams do not need to unwind hidden architectural assumptions later.',
          },
        ],
        relatedSlugs: ['ai-workbench', 'release-operations-workspace'],
      },
      {
        slug: 'context-engine-for-teams',
        eyebrow: 'Context Engine',
        title: 'A team context engine that keeps knowledge, tasks, and memory reusable',
        summary:
          'Use ContextGo when the bigger problem is not prompt quality but fragmented working memory across docs, channels, projects, and recurring operations.',
        problem:
          'Teams do not lose time because information is unavailable in theory. They lose time because the relevant context is scattered across systems and decays between every handoff.',
        primaryCtaLabel: 'Read context docs',
        primaryCtaHref: '/docs',
        secondaryCtaLabel: 'Open the main site',
        secondaryCtaHref: '/',
        sections: [
          {
            title: 'Why teams need a context engine',
            body: 'A context engine gives teams a reusable structure for project memory, reference material, decisions, and operational state. Without it, each workflow starts from partial recall and manual reconstruction.',
            points: [
              'Keep reusable memory attached to the work rather than buried in chat history.',
              'Model sessions, projects, spaces, and context packs explicitly.',
              'Let connectors keep that memory updated from real source systems.',
            ],
          },
          {
            title: 'How ContextGo frames team context',
            body: 'ContextGo connects source systems, workspace objects, and runtime execution so teams can move from scattered knowledge to an operating context that agents and people can both reuse.',
            points: [
              'Context should be persistent, not only prompt-time retrieval.',
              'The same model should work for individual and team workflows.',
              'Governance and support need that same context boundary to stay visible.',
            ],
          },
          {
            title: 'What this changes in everyday work',
            body: 'Teams spend less time rebuilding the problem statement. More of the operating context is already attached to the workspace, which makes collaboration, remote access, and release operations easier to explain and repeat.',
            points: [
              'Reduce repeated briefing across meetings and agents.',
              'Keep project memory closer to the real source of work.',
              'Make later audits and support decisions easier to ground in context.',
            ],
          },
        ],
        faq: [
          {
            question: 'Is a context engine just another name for retrieval?',
            answer:
              'No. Retrieval is one capability. A context engine implies persistent workspace modeling, reusable memory, governance, and a way to keep context evolving with the workflow.',
          },
          {
            question: 'Does every team need the same context model?',
            answer:
              'No. But every team needs a stable way to connect project context, execution, and history. ContextGo provides the shared product boundary for doing that.',
          },
          {
            question: 'How does this help beyond AI answers?',
            answer:
              'It helps humans too. Teams can reason from a shared project context, reduce handoff loss, and keep operations tied to actual history instead of partial recollection.',
          },
        ],
        relatedSlugs: ['multi-agent-collaboration-workspace', 'connector-based-knowledge-ops'],
      },
      {
        slug: 'connector-based-knowledge-ops',
        eyebrow: 'Knowledge Ops',
        title: 'Connector-based knowledge operations for real working systems',
        summary:
          'Use ContextGo when important knowledge lives across drives, docs, channels, tickets, and structured systems, and the team needs one operational layer instead of scattered copies.',
        problem:
          'Knowledge work becomes expensive when every workflow depends on manual exports, pasted summaries, and one-off context reconstruction from disconnected systems.',
        primaryCtaLabel: 'Open connectors',
        primaryCtaHref: '/connect',
        secondaryCtaLabel: 'Read product docs',
        secondaryCtaHref: '/docs',
        sections: [
          {
            title: 'Why connectors matter operationally',
            body: 'Connectors are not only about access. They determine how new information enters the workspace, how stale context gets refreshed, and how teams avoid maintaining parallel copies of the same material.',
            points: [
              'Pull source material from the systems teams already trust.',
              'Reduce manual copy-and-paste context assembly.',
              'Keep updates flowing from real systems into reusable workspace context.',
            ],
          },
          {
            title: 'How ContextGo uses connected systems',
            body: 'ContextGo turns connected systems into a context supply line. Files, docs, channels, tickets, and data sources can all feed the same workbench, remote client, and collaboration model.',
            points: [
              'Normalize different inputs into one usable context layer.',
              'Support both human review and agent execution on top of that layer.',
              'Keep publishing and operational actions closer to source truth.',
            ],
          },
          {
            title: 'What makes this publishable and trustworthy',
            body: 'A knowledge-ops page should explain how connected context stays usable over time. That means showing how connectors support real workflows rather than treating integrations as a marketplace checklist.',
            points: [
              'Explain which systems supply durable context.',
              'Show how context flows into workbench and collaboration surfaces.',
              'Link connector value to support, governance, and execution outcomes.',
            ],
          },
        ],
        faq: [
          {
            question: 'Are connectors just for importing data once?',
            answer:
              'No. The product value is ongoing context flow. Connectors should keep the workspace attached to changing source systems instead of serving as a one-time migration step.',
          },
          {
            question: 'Which systems matter most to connect first?',
            answer:
              'Start with the systems that carry the working truth for your team: documents, task systems, shared drives, channels, and any structured records that shape decisions or execution.',
          },
          {
            question: 'How does this improve operations?',
            answer:
              'It reduces context drift. Teams can reason from fresher source material, and support or operators can trace decisions back to the systems where the work actually happened.',
          },
        ],
        relatedSlugs: ['context-engine-for-teams', 'multi-agent-collaboration-workspace'],
      },
      {
        slug: 'release-operations-workspace',
        eyebrow: 'Release Operations',
        title: 'A release operations workspace with one public version truth',
        summary:
          'Use ContextGo when product delivery, download pages, updater behavior, and support all depend on one trustworthy release source instead of several drifting records.',
        problem:
          'Release confusion appears when website copy, artifacts, checksums, and updater feeds each tell a slightly different story about what is current and what users should install.',
        primaryCtaLabel: 'Open changelog',
        primaryCtaHref: '/changelog',
        secondaryCtaLabel: 'Open download center',
        secondaryCtaHref: '/download',
        sections: [
          {
            title: 'Why release truth must stay singular',
            body: 'Users do not experience a release as separate repositories and feeds. They experience a product that offers a download, an update path, and a support promise. Those surfaces have to agree.',
            points: [
              'Release notes, artifacts, and updater metadata should share one factual source.',
              'Support should start from that release record before checking downstream surfaces.',
              'Website and client trust both depend on that alignment.',
            ],
          },
          {
            title: 'How ContextGo frames release operations',
            body: 'ContextGo treats public release history, downloadable artifacts, checksums, and install metadata as an operating surface. The website explains the product, while the release record explains what shipped.',
            points: [
              'Keep site narrative and installable truth distinct but aligned.',
              'Let download pages read from release data rather than drift into manual copy.',
              'Use the same source for update and support decisions.',
            ],
          },
          {
            title: 'What this page should help users decide',
            body: 'A strong release-operations page should answer whether a version is current, where the artifact came from, and how that affects installation or troubleshooting. Those are the questions that reduce support friction.',
            points: [
              'Explain the release repository boundary clearly.',
              'Show how downloads, checksums, and notes stay in sync.',
              'Reduce ambiguity before the user installs or upgrades.',
            ],
          },
        ],
        faq: [
          {
            question: 'Why is release operations content part of SEO at all?',
            answer:
              'Because users search for installation, version, checksum, and update answers directly. A trustworthy public page should answer those questions before support tickets do.',
          },
          {
            question: 'Should the website and updater read different release sources?',
            answer:
              'No. That creates version drift and support ambiguity. The best model is for both surfaces to consume the same release truth.',
          },
          {
            question: 'Does this only matter after store publication?',
            answer:
              'No. It matters even more before store publication, because direct downloads and manual installs need clear release provenance and verification information.',
          },
        ],
        relatedSlugs: ['ai-workbench', 'remote-ai-workspace'],
      },
    ],
  },
  zh: {
    index: {
      eyebrow: '方案页面',
      title: '围绕真实工作流组织的搜索入口页',
      description:
        '这些页面不是泛泛的 AI 文案，而是直接回答用户会搜索的问题：ContextGo 到底适合做什么、远程模型怎么解释、发布运维为什么必须单一来源、connector 在真实工作里起什么作用。',
    },
    surfaces: {
      home: {
        eyebrow: '先回答问题',
        title: '用一套产品模型把 ContextGo 说清楚',
        description:
          'ContextGo 不是另一个聊天框，而是一套把工作上下文、Agent 执行、远程访问和发布运维收拢到一起的 AI 工作台。',
        points: [
          '围绕文件、任务、文档、渠道和运行时状态构建 AI 工作台。',
          '让桌面端继续作为真实执行主机，远程端复用同一套工作区。',
          '把 connector、发布和安装路径都挂在同一套产品事实之上。',
        ],
        intentSlugs: ['ai-workbench', 'remote-ai-workspace', 'context-engine-for-teams'],
        faqTitle: '首页常见问题',
        faq: [
          {
            question: 'ContextGo 实际上是什么产品？',
            answer:
              'ContextGo 是一个以“上下文”为中心的 AI 工作台。它把本地文件、文档、消息渠道、任务和运行时状态接到一起，让 Agent 在真实工作上下文里持续工作，而不是只做一次性的聊天问答。',
          },
          {
            question: 'ContextGo 主要适合谁用？',
            answer:
              '它适合需要统一管理知识、执行、远程访问和发布运维的团队，包括产品、研发、运营、管理员和需要长期沉淀工作上下文的组织。',
          },
          {
            question: '真正的执行到底跑在哪里？',
            answer: '真正的执行主机仍然是桌面端。浏览器和移动端是远程使用面，复用同一个工作区、工具链和上下文层。',
          },
        ],
      },
      download: {
        eyebrow: '安装前先确认',
        title: '直链安装、版本事实和安装判断应该先说清楚',
        description:
          '下载页不应该只放按钮，还应该先回答版本从哪里来、用户如何判断当前安装包是否可信，以及哪些平台适合先走直链分发。',
        points: [
          '官网下载和桌面端更新应读取同一份 release 事实来源。',
          '桌面端和 Android 可以先走直链安装包分发，再视情况进入商店。',
          'checksum、release notes 和安装说明应该跟着版本一起对外公开。',
        ],
        intentSlugs: ['release-operations-workspace', 'remote-ai-workspace', 'ai-workbench'],
        faqTitle: '下载页常见问题',
        faq: [
          {
            question: '用户不经过应用商店也能安装 ContextGo 吗？',
            answer:
              '可以。桌面端和 Android 可以优先走直链安装包分发，只要 release 页面、校验值和安装说明清晰一致即可。iOS 仍然更适合 TestFlight 或 App Store 路径。',
          },
          {
            question: '用户怎么确认自己下载的是当前版本？',
            answer:
              '官网、release 说明和更新元数据应该读取同一个版本事实来源。这样用户、支持和管理员看到的版本口径才不会漂移。',
          },
          {
            question: '为什么下载页要讲运维，而不只是列文件？',
            answer:
              '因为安装信任不只取决于一个按钮。用户还要知道来源、校验状态、版本说明和分发路径，才能做出正确安装判断。',
          },
        ],
      },
      connect: {
        eyebrow: '连接模型',
        title: 'Connector 是上下文层的一部分，不是装饰性集成',
        description:
          '连接页应该解释清楚接进来的是什么、为什么这会影响产品运作，以及这些连接过的数据如何持续喂给 AI 工作台、远程访问和发布路径。',
        points: [
          '把文件、文档、渠道、工单和结构化系统接成一层可复用上下文。',
          '把不同系统统一成一个可供 Agent 工作的操作面。',
          '让桌面端、WebUI 和远程端访问同一份连接后的工作上下文。',
        ],
        intentSlugs: [
          'connector-based-knowledge-ops',
          'multi-agent-collaboration-workspace',
          'context-engine-for-teams',
        ],
        faqTitle: '连接页常见问题',
        faq: [
          {
            question: 'ContextGo 应该连接哪些系统？',
            answer:
              '优先连接真正承载工作上下文的系统，例如文档、网盘、消息渠道、任务系统、设计工具和结构化数据来源，这些才是团队做判断和推进工作的真实材料。',
          },
          {
            question: '接入 connector 之后到底改变了什么？',
            answer:
              '目标不是多一个集成徽标，而是把分散在各系统里的材料变成同一层工作上下文，进一步支持搜索、排序、Agent 执行、远程使用和发布流程。',
          },
          {
            question: '远程端和移动端看到的是同一份上下文吗？',
            answer:
              '是的。桌面主机继续持有上下文和运行时，远程端是在复用这套工作区，而不是再造一套行为不同的本地副本。',
          },
        ],
      },
    },
    pages: [
      {
        slug: 'ai-workbench',
        eyebrow: 'AI 工作台',
        title: '把 ContextGo 作为承载真实上下文的 AI 工作台',
        summary:
          '当你的问题不再是“怎么再多聊几句”，而是“怎么把资料、执行环境和过程历史接进同一个工作面”，ContextGo 才真正有价值。',
        problem:
          '通用助手可以回答问题，但 AI 工作台必须把资料来源、运行环境和执行历史一起接住，工作才能跨会话持续推进。',
        primaryCtaLabel: '打开下载中心',
        primaryCtaHref: '/download',
        secondaryCtaLabel: '阅读文档',
        secondaryCtaHref: '/docs',
        sections: [
          {
            title: '为什么团队会开始搜索 AI 工作台',
            body: '通常是因为单纯聊天已经不够用了。团队需要一个地方把文档、文件、任务、运行时权限和执行历史接到一起，而不是每次都重新粘贴背景。',
            points: [
              '让资料跟着工作区走，而不是临时拼进 prompt。',
              '把运行时和执行也纳入工作台，而不是放在看不见的旁路里。',
              '让远程端延续同一套工作，而不是打开第二个割裂工具。',
            ],
          },
          {
            title: 'ContextGo 如何界定工作台边界',
            body: '在 ContextGo 里，工作台等于“上下文层 + 执行层”。所以 connector、本地主机运行时、远程访问和发布路径都属于同一套产品叙事，而不是后期外挂。',
            points: [
              '桌面端继续是主要执行主机。',
              '浏览器和移动端是在扩展同一工作区的访问面。',
              '连接进来的系统会持续喂给同一套上下文模型。',
            ],
          },
          {
            title: '一个可发布的工作台页面应该回答什么',
            body: '真正有价值的 AI 工作台页面，应该清楚解释工作在哪里执行、什么材料会被接入，以及发布与安装事实如何保持可信。否则它只是一段通用 AI 文案。',
            points: [
              '把主机和远程客户端的关系讲清楚。',
              '说明 connector 如何把资料引入工作台。',
              '把安装、发布和持续运维逻辑串起来。',
            ],
          },
        ],
        faq: [
          {
            question: 'AI 工作台和普通 AI 聊天产品有什么区别？',
            answer:
              '工作台会把上下文、工具、文件和运行状态长期挂在任务上；聊天产品通常只看到用户临时贴进去的一段内容。',
          },
          {
            question: '用 ContextGo 是否意味着团队必须整体迁移系统？',
            answer: '不需要。更合理的路径是先连接现有系统，把上下文统一起来，再让 Agent 在这层之上工作。',
          },
          {
            question: '这只是面向开发者的产品吗？',
            answer: '不是。研发只是其中一类用户，产品、运营、发布、支持和管理员同样需要一套统一的工作上下文。',
          },
        ],
        relatedSlugs: ['context-engine-for-teams', 'remote-ai-workspace'],
      },
      {
        slug: 'multi-agent-collaboration-workspace',
        eyebrow: '协作空间',
        title: '让多 Agent 协作建立在同一份共享上下文上',
        summary:
          '当团队需要多个 Agent、多个操作人和多个工作面协同时，真正的关键不是多开几个会话，而是先把共享上下文和执行边界建好。',
        problem:
          '如果每个 Agent 看到的上下文都不同、工具权限不同、工作边界也不稳定，那么所谓多 Agent 协作很快就会退化成脆弱的 prompt 传递。',
        primaryCtaLabel: '打开协作文档',
        primaryCtaHref: '/docs',
        secondaryCtaLabel: '查看连接页',
        secondaryCtaHref: '/connect',
        sections: [
          {
            title: '多 Agent 协作最先要稳定的是什么',
            body: '首先要稳定的是共享上下文、工作边界和执行主机。否则每多一个参与者，系统就会多一层上下文偏差。',
            points: [
              '共享上下文必须能跨会话持续存在。',
              '多个 Agent 要使用同一批已连接材料。',
              '操作人需要一个可以观察和干预的统一入口。',
            ],
          },
          {
            title: 'ContextGo 如何让协作落地',
            body: 'ContextGo 把协作建立在 project、space、context pack、connector 和 runtime 访问之上。先有稳定工作区模型，再去增加 Agent 表面。',
            points: [
              '人和 Agent 共同工作在同一份上下文模型上。',
              '连接器让工作区和真实系统保持同步。',
              '远程访问只是这套工作区的延伸。',
            ],
          },
          {
            title: '这对运维和治理意味着什么',
            body: '协作不只是交互问题，也是治理问题。共享上下文能让后续排障、审批和责任边界更容易说清楚。',
            points: [
              '让跨参与者行为更可追踪。',
              '让上下文归属和空间边界更明确。',
              '减少不同参与者之间反复重新解释背景。',
            ],
          },
        ],
        faq: [
          {
            question: '为什么不能只让多个 Agent 在不同聊天窗口里工作？',
            answer:
              '因为那样会制造多套记忆、多套假设和脆弱交接。多 Agent 协作的前提，是从一开始就共享上下文和工作边界。',
          },
          {
            question: '人工还能参与和干预吗？',
            answer:
              '可以。ContextGo 的产品模型里，操作人和管理员应当能查看、推动和批准工作，而不是把协作变成不可见的自动化黑盒。',
          },
          {
            question: '是不是所有系统都接完之后才能做协作？',
            answer: '不是。可以先从最关键的工作系统开始接，再逐步扩展这层共享上下文。',
          },
        ],
        relatedSlugs: ['context-engine-for-teams', 'connector-based-knowledge-ops'],
      },
      {
        slug: 'remote-ai-workspace',
        eyebrow: '远程使用',
        title: '不伪造第二主机的远程 AI 工作区',
        summary:
          '如果产品要跨桌面端、浏览器和手机成立，同时又坚持桌面端是真实执行主机，那么 ContextGo 这套模型就需要被明确说出来。',
        problem:
          '远程 AI 产品最容易出问题的地方，是对外话术不敢明确承认主机在哪里，最后让用户误以为手机本地也具备同级执行能力。',
        primaryCtaLabel: '阅读远程文档',
        primaryCtaHref: '/docs',
        secondaryCtaLabel: '打开下载中心',
        secondaryCtaHref: '/download',
        sections: [
          {
            title: '先把主机与客户端关系说清楚',
            body: '最稳的远程产品叙事，就是把关系说直白：桌面端继续是执行主机，浏览器和移动端是远程客户端，复用同一套工作区。',
            points: [
              '不要把手机包装成同级执行主机。',
              '让远程说法和实际运行行为保持一致。',
              '明确告诉用户文件、工具和任务真正跑在哪里。',
            ],
          },
          {
            title: '远程工作为什么因此更连贯',
            body: '一旦主机模型被讲清楚，上传、connector 权限、runtime 发现和远程任务发起就都更容易解释，也更容易支持。',
            points: [
              '上传进入桌面主机后再继续处理。',
              '远程端复用同一层上下文和连接器。',
              '支持团队只需要围绕一条执行平面排障。',
            ],
          },
          {
            title: '为什么这会影响公开产品页面',
            body: '远程 AI 工作区页面应该先降低错误预期。用户和管理员需要在购买或部署前就知道“跨设备工作”到底意味着什么。',
            points: [
              '说明哪些能力要求主机在线。',
              '说明远程访问是在延伸工作台，而不是替代主机。',
              '让桌面端、移动端和浏览器文案都服从同一模型。',
            ],
          },
        ],
        faq: [
          {
            question: 'ContextGo 会在手机本地执行同样的任务吗？',
            answer: '不会。手机是远程客户端，可以访问和控制工作区，但真实执行主机仍然是桌面环境。',
          },
          {
            question: '远程端能上传本地文件吗？',
            answer: '可以。产品模型是先把文件上传到桌面主机，再从主机侧继续处理，这样工作区状态才一致。',
          },
          {
            question: '为什么这种讲法对用户更好？',
            answer:
              '因为它让对外承诺和真实系统一致，用户知道哪些能力依赖主机在线，支持团队也不必在问题发生后再解释隐藏架构。',
          },
        ],
        relatedSlugs: ['ai-workbench', 'release-operations-workspace'],
      },
      {
        slug: 'context-engine-for-teams',
        eyebrow: '上下文引擎',
        title: '给团队使用、可长期复用的上下文引擎',
        summary:
          '当真正的问题不是 prompt 写得不够好，而是团队知识、项目记忆和任务上下文长期分散在各系统里时，ContextGo 的意义才会显出来。',
        problem:
          '团队耗时往往不是因为信息理论上不存在，而是因为每次交接都要重新从文档、聊天、任务系统和历史记录里拼凑上下文。',
        primaryCtaLabel: '阅读上下文文档',
        primaryCtaHref: '/docs',
        secondaryCtaLabel: '打开官网首页',
        secondaryCtaHref: '/',
        sections: [
          {
            title: '团队为什么需要上下文引擎',
            body: '上下文引擎的价值在于，为项目记忆、参考材料、历史决策和运行状态提供一层可长期复用的结构。没有这层结构，每条工作流都要重新建问题背景。',
            points: [
              '把可复用记忆挂在工作对象上，而不是沉在聊天历史里。',
              '明确建模 session、project、space 和 context pack。',
              '让 connector 持续把真实系统变化带回这层结构里。',
            ],
          },
          {
            title: 'ContextGo 如何定义团队上下文',
            body: 'ContextGo 把源系统、工作区对象和运行时执行连在一起，让团队从碎片化知识，过渡到一层可供人和 Agent 共同复用的工作上下文。',
            points: [
              '上下文应该是持续存在的，而不是临时检索结果。',
              '同一套模型要能同时服务个人和团队。',
              '治理和支持也要建立在这同一层边界上。',
            ],
          },
          {
            title: '这会怎样改变日常工作',
            body: '团队不再把大量时间花在重建问题背景上。更多工作上下文已经挂在工作区里，因此协作、远程使用和发布运维都更容易重复和解释。',
            points: [
              '减少会议与 Agent 之间反复补背景。',
              '让项目记忆更接近真实工作来源。',
              '让审计和支持更容易回到上下文事实。',
            ],
          },
        ],
        faq: [
          {
            question: '上下文引擎是不是只是换个说法的检索？',
            answer:
              '不是。检索只是其中一个能力。上下文引擎还意味着工作区建模、长期记忆、治理边界，以及随着工作持续演化的上下文结构。',
          },
          {
            question: '每个团队都必须用同样的上下文模型吗？',
            answer:
              '不需要完全一样，但都需要一套稳定方式，把项目上下文、执行和历史接在一起。ContextGo 提供的是这条产品边界。',
          },
          {
            question: '这除了帮助 Agent 之外，还帮助谁？',
            answer: '也帮助人。团队可以从同一份项目上下文出发协作，减少交接损耗，也让运维和支持更容易回到真实历史。',
          },
        ],
        relatedSlugs: ['multi-agent-collaboration-workspace', 'connector-based-knowledge-ops'],
      },
      {
        slug: 'connector-based-knowledge-ops',
        eyebrow: '知识运营',
        title: '基于 connector 的知识运营工作层',
        summary:
          '当重要知识分散在网盘、文档、消息、工单和结构化系统里，而团队又不想靠人工复制维持上下文时，这类页面就该出现。',
        problem: '知识工作昂贵，并不是因为没有资料，而是因为每条流程都依赖手工导出、人工总结和一次性的上下文重建。',
        primaryCtaLabel: '打开连接页',
        primaryCtaHref: '/connect',
        secondaryCtaLabel: '阅读产品文档',
        secondaryCtaHref: '/docs',
        sections: [
          {
            title: '为什么 connector 对运作本身有意义',
            body: 'connector 不只是“能接进去”，它决定的是新信息如何进入工作区、陈旧上下文如何被刷新，以及团队如何避免维护多套平行副本。',
            points: [
              '从团队已信任的系统拉取源材料。',
              '减少手工复制拼装上下文。',
              '让真实系统更新持续流入可复用工作区。',
            ],
          },
          {
            title: 'ContextGo 如何使用已连接系统',
            body: '在 ContextGo 里，连接过的系统构成了一条“上下文供给线”。文件、文档、渠道、工单和数据源都会持续喂给同一套工作台与远程模型。',
            points: [
              '把不同输入统一成一层可使用上下文。',
              '既服务人工复核，也服务 Agent 执行。',
              '让发布和操作动作更贴近源事实。',
            ],
          },
          {
            title: '什么样的连接页才是可发布、可信的',
            body: '真正有价值的知识运营页面，会解释连接后的上下文如何长期保持可用，而不是把 integrations 当作一个 marketplace 清单。',
            points: [
              '说明哪些系统提供的是长期上下文。',
              '说明上下文如何进入工作台和协作面。',
              '把 connector 价值和支持、治理、执行结果关联起来。',
            ],
          },
        ],
        faq: [
          {
            question: 'connector 只是一次性导入数据吗？',
            answer:
              '不是。真正的产品价值是持续上下文流。connector 应该让工作区持续贴着源系统变化，而不是只做一次导入。',
          },
          {
            question: '应该先连接哪些系统？',
            answer: '先连最接近团队工作事实的系统，例如文档、任务、共享盘、消息渠道和影响决策的结构化记录。',
          },
          {
            question: '这会如何改善运维？',
            answer:
              '它能减少上下文漂移。团队能从更接近真实来源的材料出发做判断，支持和运维也更容易回溯工作发生在哪里。',
          },
        ],
        relatedSlugs: ['context-engine-for-teams', 'multi-agent-collaboration-workspace'],
      },
      {
        slug: 'release-operations-workspace',
        eyebrow: '发布运维',
        title: '围绕单一版本事实来源构建的发布运维工作面',
        summary: '当下载页、安装产物、更新器行为和支持流程都依赖同一套版本事实时，这类公开页面就应该被补齐。',
        problem:
          '只要官网文案、安装包、checksum 和 updater feed 各自讲不同版本故事，用户就无法判断自己到底该安装什么，也无法判断哪个版本才是真的。',
        primaryCtaLabel: '打开更新记录',
        primaryCtaHref: '/changelog',
        secondaryCtaLabel: '打开下载中心',
        secondaryCtaHref: '/download',
        sections: [
          {
            title: '为什么版本事实必须只有一份',
            body: '用户不会把 release 体验拆成多个仓库和 feed。他们看到的是一个产品：官网给下载入口，客户端给更新入口，支持给判断口径。这些面必须一致。',
            points: [
              'release notes、产物和更新元数据应共享同一来源。',
              '支持应先从这份 release 记录开始判断。',
              '官网可信度和客户端更新体验都依赖这种对齐。',
            ],
          },
          {
            title: 'ContextGo 如何理解发布运维',
            body: '在 ContextGo 里，公开版本历史、可下载安装产物、校验值和安装元数据，本身就是一层运维操作面。官网负责解释产品，release 记录负责说明真正发布了什么。',
            points: [
              '把站点叙事和可安装事实分开，但保持对齐。',
              '让下载页读取 release 数据，而不是手工维护版本文案。',
              '让更新和支持都回到同一份来源上。',
            ],
          },
          {
            title: '这个页面最该帮助用户做什么判断',
            body: '最重要的是帮助用户判断版本是否当前、产物来自哪里，以及这会如何影响安装和排障。把这些问题答清楚，支持成本会直接下降。',
            points: [
              '把 release 仓库边界讲清楚。',
              '说明下载、checksum 和版本说明如何同步。',
              '在用户安装前先消除版本歧义。',
            ],
          },
        ],
        faq: [
          {
            question: '为什么发布运维内容也要做 SEO？',
            answer:
              '因为用户会直接搜索安装、版本、checksum 和更新问题。公开页面应该先回答这些问题，而不是把它们都留给支持。',
          },
          {
            question: '官网和 updater 可以读不同的 release 来源吗？',
            answer: '不应该。那会制造版本漂移和支持歧义。最稳的模型，是官网和客户端读取同一份 release 事实。',
          },
          {
            question: '这只在上架商店后才重要吗？',
            answer: '不是。越是在直链安装和人工分发阶段，越需要清楚的 release 来源和校验信息来建立信任。',
          },
        ],
        relatedSlugs: ['ai-workbench', 'remote-ai-workspace'],
      },
    ],
  },
};

export const getIntentPages = (locale: SiteLocale): IntentPage[] => content[locale].pages;

export const getIntentPage = (locale: SiteLocale, slug: string): IntentPage | null => {
  return content[locale].pages.find((page) => page.slug === slug) ?? null;
};

export const getPageFaqItems = (locale: SiteLocale, surface: IntentSurface): IntentFaqItem[] => {
  return [...content[locale].surfaces[surface].faq];
};

export const getIntentSurfaceContent = (locale: SiteLocale, surface: IntentSurface): IntentSurfaceContent => {
  return content[locale].surfaces[surface];
};

export const getIntentIndexContent = (locale: SiteLocale) => content[locale].index;

export const getIntentPagesBySlugs = (locale: SiteLocale, slugs: IntentPageSlug[]): IntentPage[] => {
  const pages = getIntentPages(locale);
  return slugs
    .map((slug) => pages.find((page) => page.slug === slug))
    .filter((page): page is IntentPage => Boolean(page));
};
