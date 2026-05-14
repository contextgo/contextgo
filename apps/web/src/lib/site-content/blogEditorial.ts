import type { SiteLocale } from './types';

type BlogJournalCopy = {
  identityTitle: string;
  identityBody: string;
  principlesTitle: string;
  principles: string[];
  themesTitle: string;
  themes: Array<{
    title: string;
    body: string;
  }>;
  featuredCardLabel: string;
  featurePointsLabel: string;
  audienceLabel: string;
  pathLabel: string;
  pathTitle: string;
  pathBody: string;
  pathItems: Array<{
    slug: string;
    step: string;
    body: string;
  }>;
  articleRoleLabel: string;
  articleAudienceLabel: string;
  articleCoverageTitle: string;
  articleWhyTitle: string;
  articleContinueTitle: string;
  articleActionsTitle: string;
  articleActionsHeadline: string;
  articleActionsBody: string;
};

type BlogArticleSupplement = {
  role: string;
  audience: string;
  cardPoints: string[];
  coverage: string[];
  why: string;
  relatedSlugs: string[];
};

const journalCopy: Record<SiteLocale, BlogJournalCopy> = {
  en: {
    identityTitle: 'A public product journal, not a content feed',
    identityBody:
      'This section exists to explain product decisions, release operations, and remote-product boundaries in a way customers, admins, and future contributors can actually use.',
    principlesTitle: 'Editorial rules',
    principles: [
      'Every note should state the product judgment, not just announce a feature.',
      'Operational changes belong here only when they affect install, update, or support reality.',
      'Remote access, release flow, and context modeling should use one explicit product model.',
    ],
    themesTitle: 'Current themes',
    themes: [
      {
        title: 'Product model before feature lists',
        body: 'Explain the product boundary first so later capabilities make sense.',
      },
      {
        title: 'Release truth as part of product trust',
        body: 'Users need one canonical place to understand versions, artifacts, and update behavior.',
      },
      {
        title: 'Remote access without mixed mental models',
        body: 'Desktop remains the host, while browser and mobile stay remote clients.',
      },
    ],
    featuredCardLabel: 'Core note',
    featurePointsLabel: 'What this note covers',
    audienceLabel: 'Best for',
    pathLabel: 'Reading path',
    pathTitle: 'Read the model in the right order',
    pathBody:
      'Start with the product boundary, then read the remote-access model, then finish with release-source rules so the external product story stays consistent.',
    pathItems: [
      {
        slug: 'why-we-built-contextgo',
        step: '01',
        body: 'Start with the founding problem, the mission, and the product boundary ContextGo is trying to make real.',
      },
      {
        slug: 'context-before-agents',
        step: '02',
        body: 'Understand why ContextGo starts from connected context instead of a blank assistant surface.',
      },
      {
        slug: 'desktop-host-mobile-client',
        step: '03',
        body: 'Clarify which device is the host and what the remote clients are actually responsible for.',
      },
      {
        slug: 'release-operations-source-of-truth',
        step: '04',
        body: 'Close with the operational rule that keeps website, downloads, and updates aligned.',
      },
    ],
    articleRoleLabel: 'Role',
    articleAudienceLabel: 'Best for',
    articleCoverageTitle: 'This article covers',
    articleWhyTitle: 'Why this matters',
    articleContinueTitle: 'Continue reading',
    articleActionsTitle: 'After this note',
    articleActionsHeadline: 'Use docs for reference, and changelog for shipped reality.',
    articleActionsBody:
      'The journal explains the product judgment. The documentation and release history show how that judgment turns into install, update, and operating behavior.',
  },
  zh: {
    identityTitle: '这是公开产品刊物，不是内容流',
    identityBody:
      '这里专门用来解释产品判断、发布运维和远程产品边界，让客户、管理员和后续贡献者都能用同一套说法理解 ContextGo。',
    principlesTitle: '编辑原则',
    principles: [
      '每篇文章都要讲清楚产品判断，而不是只发一条功能动态。',
      '只有真正影响安装、更新或支持体系的运维变化，才值得进入这里。',
      '远程访问、release 流程和上下文建模必须使用同一套明确的产品模型。',
    ],
    themesTitle: '当前主题',
    themes: [
      {
        title: '先讲产品模型，再讲功能列表',
        body: '先把产品边界解释清楚，后续能力才不会像零散 feature。',
      },
      {
        title: '版本事实来源，本身就是产品信任的一部分',
        body: '用户需要一个唯一地方理解版本、安装包和更新行为。',
      },
      {
        title: '远程访问不能混淆主机与客户端心智',
        body: '桌面端继续是主机，浏览器和移动端继续是远程使用面。',
      },
    ],
    featuredCardLabel: '核心文章',
    featurePointsLabel: '这篇会讲清楚',
    audienceLabel: '适合谁看',
    pathLabel: '阅读路径',
    pathTitle: '按正确顺序读懂这套产品模型',
    pathBody:
      '先理解 ContextGo 的产品边界，再理解远程访问模型，最后收口到 release 来源规则，这样对外叙事和对内运维才不会分裂。',
    pathItems: [
      {
        slug: 'why-we-built-contextgo',
        step: '01',
        body: '先看清楚 ContextGo 为什么存在、想解决什么问题，以及它真正要做成什么产品。',
      },
      {
        slug: 'context-before-agents',
        step: '02',
        body: '先理解为什么 ContextGo 不是从一个空白助手界面开始，而是从上下文层开始。',
      },
      {
        slug: 'desktop-host-mobile-client',
        step: '03',
        body: '再把桌面主机与移动/浏览器客户端的职责边界讲清楚。',
      },
      {
        slug: 'release-operations-source-of-truth',
        step: '04',
        body: '最后收口到版本事实来源，让官网、下载和更新链路保持一致。',
      },
    ],
    articleRoleLabel: '文章角色',
    articleAudienceLabel: '适合谁看',
    articleCoverageTitle: '这篇文章覆盖',
    articleWhyTitle: '为什么重要',
    articleContinueTitle: '继续阅读',
    articleActionsTitle: '读完这篇之后',
    articleActionsHeadline: '查规范去文档，看实际发布去版本历史。',
    articleActionsBody: '这里负责讲清楚产品判断，文档负责提供结构化参考，版本历史负责说明真正已经交付了什么。',
  },
};

const articleSupplement: Record<SiteLocale, Record<string, BlogArticleSupplement>> = {
  en: {
    'why-we-built-contextgo': {
      role: 'Founding manifesto',
      audience: 'New users, investors, partners, contributors, and product readers',
      cardPoints: [
        'Why another AI chat shell is not enough for long-running work.',
        'What product fractures ContextGo is trying to close across agents, context, software, and devices.',
        'How mission, product definition, and execution model fit into one coherent direction.',
      ],
      coverage: [
        'The category problem behind ContextGo rather than a feature announcement.',
        'Why the product is built around harness, context, connectors, and the desktop-host execution model.',
        'What ContextGo still needs to prove before the vision can be considered real.',
      ],
      why: 'A product like ContextGo needs a public founding note so people understand the boundary before they evaluate individual features. Without that, the rest of the site reads like disconnected capability claims.',
      relatedSlugs: ['context-before-agents', 'desktop-host-mobile-client'],
    },
    'context-before-agents': {
      role: 'Foundational product note',
      audience: 'Product, solution, design, and early technical adopters',
      cardPoints: [
        'Why a blank chat box is the wrong starting point for a serious workflow product.',
        'What the “context layer” means in ContextGo, beyond retrieval or prompt stuffing.',
        'How this judgment changes connectors, runtime management, remote access, and product scope.',
      ],
      coverage: [
        'The product problem a generic assistant surface cannot solve on its own.',
        'Why ContextGo treats files, tasks, docs, channels, and runtime state as one connected context.',
        'What this means for roadmap priorities and what should not be treated as edge features.',
      ],
      why: 'If this model is not explicit, the rest of the product reads like an unrelated feature list. Once it is explicit, connectors, runtime operations, and remote access all align around the same product boundary.',
      relatedSlugs: ['desktop-host-mobile-client', 'release-operations-source-of-truth'],
    },
    'release-operations-source-of-truth': {
      role: 'Release architecture note',
      audience: 'Release engineering, support, admins, and anyone owning the download/update path',
      cardPoints: [
        'Why website downloads, GitHub releases, and desktop updates must read from one factual source.',
        'What belongs in `contextgo-releases` and what should stay on the website side.',
        'How this separation reduces support ambiguity and future deployment drift.',
      ],
      coverage: [
        'The operational cost of letting website, updater, and release artifacts drift apart.',
        'The exact boundary between release repository content and website content.',
        'How this model simplifies future troubleshooting and external distribution logic.',
      ],
      why: 'Users do not experience release architecture as an internal engineering detail. They experience it as trust: which version is real, where to download it, and whether the updater matches the website.',
      relatedSlugs: ['context-before-agents', 'desktop-host-mobile-client'],
    },
    'desktop-host-mobile-client': {
      role: 'Remote access model note',
      audience: 'Remote-access users, mobile-shell stakeholders, and deployment owners',
      cardPoints: [
        'Why mobile and browser clients should remain remote clients rather than second execution hosts.',
        'Where uploads, runtime execution, and local-file handling actually happen.',
        'How a clear host/client model shapes future tunnel, relay, and cloud-account behavior.',
      ],
      coverage: [
        'The host/client product model that should anchor all remote-access explanations.',
        'Why pretending the handset is a peer host confuses capability expectations.',
        'How this clarity changes product copy, architecture communication, and roadmap sequencing.',
      ],
      why: 'A fuzzy remote model makes users misread capabilities, support teams mis-explain failures, and roadmap discussions drift toward the wrong abstractions. A clear host/client story keeps product and operations aligned.',
      relatedSlugs: ['context-before-agents', 'release-operations-source-of-truth'],
    },
  },
  zh: {
    'why-we-built-contextgo': {
      role: '创始宣言',
      audience: '新用户、合作伙伴、贡献者以及关注产品方向的人',
      cardPoints: [
        '为什么“再做一个 AI 聊天壳”不足以承载长期工作。',
        'ContextGo 想关闭的是哪些断裂：Agent、上下文、软件系统和多端使用之间的断裂。',
        '使命、产品定义和执行模型为什么必须是一套连贯方向，而不是零散 feature。',
      ],
      coverage: [
        'ContextGo 所处的问题域，而不是一篇功能发布说明。',
        '为什么产品要围绕 harness、上下文、连接器和桌面主机执行模型来构建。',
        '在愿景真正成立之前，ContextGo 还需要继续证明什么。',
      ],
      why: '像 ContextGo 这样的产品，必须先有一篇对外的起点文章，把边界讲清楚。否则用户在看官网和能力点时，只会看到一堆零散功能，而看不到它到底想成为一个什么系统。',
      relatedSlugs: ['context-before-agents', 'desktop-host-mobile-client'],
    },
    'context-before-agents': {
      role: '产品基础文章',
      audience: '产品、解决方案、设计以及早期技术采用者',
      cardPoints: [
        '为什么一个空白聊天框不是严肃工作流产品的正确起点。',
        'ContextGo 所说的“上下文层”到底是什么，而不只是检索或提示词拼接。',
        '这个判断会怎样反向约束 connector、runtime、远程访问和产品边界。',
      ],
      coverage: [
        '通用助手界面单独存在时，为什么解决不了真实工作流的问题。',
        '为什么 ContextGo 要把文件、任务、文档、渠道和运行时状态视为一层联通上下文。',
        '这会怎样影响产品优先级，以及哪些能力不应该被当成边角功能。',
      ],
      why: '如果这层产品模型不先讲清楚，后面的能力都会像散落的功能点；一旦模型讲清楚，connector、runtime 运维和远程访问就会落在同一条产品边界上。',
      relatedSlugs: ['desktop-host-mobile-client', 'release-operations-source-of-truth'],
    },
    'release-operations-source-of-truth': {
      role: '发布架构文章',
      audience: '发布工程、支持团队、管理员以及负责下载/更新链路的人',
      cardPoints: [
        '为什么官网、GitHub Release 和桌面端更新必须读取同一个事实来源。',
        '什么内容应该进入 `contextgo-releases`，什么内容应该继续留在官网。',
        '这种分层怎样减少支持歧义和后续部署漂移。',
      ],
      coverage: [
        '当官网、updater 和 release 产物分裂时，运维成本会如何上升。',
        'release 仓库与站点内容之间应该如何划清边界。',
        '这套模型会怎样简化后续排障和对外分发逻辑。',
      ],
      why: '用户不会把 release 架构当成内部细节，他们感知到的是信任问题：哪个版本是真的、该去哪里下载、站点和 updater 看到的版本为什么不一致。',
      relatedSlugs: ['context-before-agents', 'desktop-host-mobile-client'],
    },
    'desktop-host-mobile-client': {
      role: '远程产品文章',
      audience: '远程访问用户、移动壳相关方以及部署负责人',
      cardPoints: [
        '为什么移动端和浏览器应该保持远程客户端角色，而不是第二执行主机。',
        '上传、运行时执行和本地文件处理到底发生在哪里。',
        '一个明确的 host/client 模型会怎样约束隧道、relay 和云账号设计。',
      ],
      coverage: [
        '所有远程访问说明都应当围绕哪一套 host/client 模型展开。',
        '为什么把手机描述成同级主机会让能力预期彻底混乱。',
        '这种澄清会怎样影响产品文案、架构沟通和路线排序。',
      ],
      why: '远程模型一旦模糊，用户会误判能力边界，支持团队会误讲故障原因，路线讨论也会跑偏。明确主机与客户端的故事，才能让产品和运维口径保持一致。',
      relatedSlugs: ['context-before-agents', 'release-operations-source-of-truth'],
    },
  },
};

const fallbackSupplement: Record<SiteLocale, BlogArticleSupplement> = {
  en: {
    role: 'Editorial note',
    audience: 'Product readers and operators',
    cardPoints: [
      'The product judgment behind the change.',
      'What this affects in real workflows.',
      'How it should shape future product or operational decisions.',
    ],
    coverage: [
      'The product or operational problem being addressed.',
      'The explicit boundary ContextGo is choosing.',
      'The practical consequence for users, admins, or release owners.',
    ],
    why: 'ContextGo should publish writing that helps people operate the product with the same mental model the team is using internally.',
    relatedSlugs: [],
  },
  zh: {
    role: '编辑文章',
    audience: '关注产品与运维的人',
    cardPoints: ['背后的产品判断是什么。', '它会影响哪些真实工作流。', '它应当怎样约束后续产品或运维决策。'],
    coverage: ['当前解决的产品或运维问题。', 'ContextGo 选择的明确边界。', '对用户、管理员或发布负责人的实际影响。'],
    why: 'ContextGo 对外发布的写作，应该让外部读者和内部团队使用同一套产品心智模型。',
    relatedSlugs: [],
  },
};

export const getBlogJournalCopy = (locale: SiteLocale): BlogJournalCopy => journalCopy[locale];

export const getBlogArticleSupplement = (locale: SiteLocale, slug: string): BlogArticleSupplement =>
  articleSupplement[locale][slug] ?? fallbackSupplement[locale];
