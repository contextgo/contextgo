export const zh = {
  navbar: {
    product: '介绍',
    connect: '连接',
    download: '下载',
    theme: {
      toggle: '主题',
      light: '浅色',
      dark: '深色',
      system: '跟随系统',
    },
  },
  hero: {
    title_start: '把上下文接通，',
    title_end: '让 Agent 开始工作。',
    description:
      'Agent 难落地，往往不是模型不够，而是上下文没到位。ContextGo 接通知识、任务、讨论与渠道，让 AI 在你现有的工作流里继续工作。',
    download_btn: '下载体验',
    connect_btn: '了解连接',
  },
  philosophy: {
    title: '上下文，决定 Agent 能走多远。',
    description_start: '没有上下文，Agent 只能回答。',
    description_end:
      '有了 ContextGo，它开始理解项目、延续讨论、进入渠道，并在真实工作流中持续工作。',
    points: ['先接通上下文，再谈 Agent 落地', '不改习惯，直接接入现有协作方式', '飞书 / Discord / Slack / Web 协同工作', '企业与个人共用一个 AI 工作台'],
    features: {
      private: { title: '上下文桥梁', desc: '把知识、任务、讨论和历史状态接成一层，让 Agent 真正接得上工作。' },
      editor: { title: '不改习惯', desc: '不用迁移团队工作方式，直接进入你已经在用的协作环境。' },
      connect: { title: '渠道协作', desc: '让 Agent 进入飞书、Discord、Slack 和 Web，一起讨论，一起推进。' },
      manage: { title: '统一工作台', desc: '把分散的 AI 能力、上下文资源和协作入口，收进同一个工作台。' },
    },
  },
  connect: {
    badge: 'Connector Layer',
    title: '先接入上下文，再接入一切。',
    description:
      '给文档、笔记、云盘、聊天和数据库，一层统一 connector。来源先接入。上下文再流向 Agent 与工作流。',
    highlights: ['本地与云端来源，一起接入', '一个上下文界面，服务所有工作流', '为 Agent、检索与发布准备好同一层上下文'],
    marquee_label: 'Connector 覆盖面',
    marquee_hint: '文件、知识库、聊天、文档与数据系统',
    connector_story_label: '为什么是 connector',
    connector_story_title: '上下文不该散在标签页里。',
    connector_story_body:
      '来源一旦接通，ContextGo 就能看见全局。同一份上下文，随后可被整理、检索、发布，再交给下一个 Agent 或流程。',
    features: [
      {
        title: '从重要来源开始',
        desc: '文件夹、知识工具、沟通系统和结构化数据，都能直接接入。不必先迁仓。',
      },
      {
        title: '统一成一层上下文',
        desc: '把分散来源汇成同一层上下文，供 Agent、流程和人工审阅共同使用。',
      },
      {
        title: '一次接入，持续复用',
        desc: '一次接入，持续复用。聊天、检索、发布、同步，都从同一份上下文开始。',
      },
    ],
    panel_label: '上下文管线',
    panel_title: 'Connector，让 ContextGo 先懂你的工作。',
    panel_body:
      '来源接进来，先整理成一致的上下文，再路由给 AI、检索、远端客户端和发布渠道。',
    workflow: [
      {
        title: '统一接入',
        desc: '桌面文件夹、笔记、云文档、聊天系统和结构化存储，都通过 connector 进入。',
      },
      {
        title: '统一理解',
        desc: '不同来源被整理成同一界面，更适合搜索、审阅、排序和服务。',
      },
      {
        title: '统一路由',
        desc: '同一份上下文，继续流向 AI 会话、远端客户端和发布场景。',
      },
    ],
    use_case_label: '使用场景',
    use_cases: [
      {
        title: '连接产品知识',
        desc: '把 PRD、文档、更新记录、工单和内部说明接到一起，让产品上下文不再散落。',
      },
      {
        title: '连接团队记忆',
        desc: '把聊天、会议、知识库和共享云盘里的决策重新找回来，不让它们沉进历史。',
      },
      {
        title: '连接运营数据',
        desc: '把表格、看板、导出结果和结构化记录变成可复用上下文，不再反复贴截图和摘要。',
      },
    ],
  },
  download: {
    center_badge: '选择你的设备',
    title: '获取 ContextGo',
    description:
      '桌面、移动与远程协作版 ContextGo。版本、校验与安装入口，都在这里。',
    mac_arch: '通用 (Apple Silicon & Intel)',
    win_arch: 'x64 / ARM64',
    download_action: '下载',
    version_label: '最新版本',
    version_pending: '新版本即将提供',
    updated_label: '发布时间',
    source_label: '获取方式',
    source_none: '即将提供',
    checksum_label: '文件校验',
    checksum_available: '已验证',
    checksum_missing: '即将提供',
    manifest_note: '安装信息最近更新于：{{date}}',
    manifest_pending: '新版本发布后，这里的安装信息会自动更新',
    system_requirements_label: '适配设备',
    permissions_label: '安装前须知',
    asset_block_label: '安装包信息',
    asset_file_label: '文件',
    asset_size_label: '大小',
    asset_unknown: '未知',
    sha256_label: '校验码',
    sha256_missing: '稍后补充',
    no_direct_asset: '这个平台的直链安装包还在准备中。',
    source_release: '官方发布',
    source_tag: '最新版本',
    release_notes_action: '查看版本说明',
    release_source_note: '版本说明与下载入口，与官方版本页保持同步',
    note_release: {
      title: '桌面端、Linux 与 Android',
      body: '这些平台会优先提供直链安装包。文件信息、体积和校验值，也会在这里展示。',
    },
    note_ios: {
      title: 'iPhone / iPad',
      body: 'iOS 会带你前往合适的官方安装路径，例如 App Store、TestFlight 或网页入口。',
    },
    note_harmony: {
      title: 'HarmonyOS',
      body: 'HarmonyOS 优先跳转官方分发渠道；若后续提供直链安装包，也会在这里出现。',
    },
  },
  footer: {
    tagline: '把上下文接通。把 Agent 用起来。',
    rights: 'ContextGo. 保留所有权利。',
    product: '产品',
    connect: '连接',
    download: '下载',
    privacy: '隐私政策',
    terms: '使用条款',
  },
  legal: {
    contactEmail: 'support@contextgo.io',
    privacy: {
      title: '隐私政策',
      lastUpdated: '最后更新：2026-02-12',
      sections: [
        {
          heading: '我们收集的信息',
          content: [
            '当你使用 Google 或 GitHub 登录时，我们可能会收集基础资料信息，例如昵称、邮箱、头像和第三方账号标识。',
            '我们还可能收集用于保障服务稳定与安全的必要技术信息和使用信息。',
          ],
        },
        {
          heading: '我们如何使用信息',
          content: [
            '我们使用这些信息来完成身份验证、提供核心功能、保障账户安全以及排查服务问题。',
            '我们不会出售你的个人信息。',
          ],
        },
        {
          heading: '信息共享与披露',
          content: [
            '我们仅在提供服务所必需、履行法律义务或保护用户与平台安全时共享相关信息。',
            'Google 与 GitHub 作为第三方登录提供方，会依据其各自隐私政策处理相关数据。',
          ],
        },
        {
          heading: '数据保留',
          content: [
            '我们仅在实现服务目的、满足法律义务或处理争议所需的期限内保留个人信息。',
            '在不再需要时，我们会在合理范围内删除或匿名化相关数据。',
          ],
        },
        {
          heading: '你的权利',
          content: [
            '你可以请求访问、更正或删除你的个人信息。',
            '你也可以随时在 Google 或 GitHub 账户设置中撤回对本服务的授权。',
          ],
        },
        {
          heading: '联系我们',
          content: ['如有隐私相关问题或请求，请联系 support@contextgo.io。'],
        },
      ],
    },
    terms: {
      title: '使用条款',
      lastUpdated: '最后更新：2026-02-12',
      sections: [
        {
          heading: '账号与访问',
          content: [
            '你可以使用我们支持的第三方账号进行登录，包括 Google 与 GitHub。',
            '你需要对账号安全和账号下发生的行为负责。',
          ],
        },
        {
          heading: '可接受使用',
          content: [
            '你不得滥用本服务，不得尝试未授权访问、攻击基础设施或将服务用于违法用途。',
            '如违反本条款，我们可暂停或终止你的访问权限。',
          ],
        },
        {
          heading: '知识产权',
          content: ['本服务及相关内容由 ContextGo 或其许可方所有，并受适用知识产权法律保护。'],
        },
        {
          heading: '免责声明与责任限制',
          content: [
            '本服务按现状和可用性提供，不提供任何形式的明示或默示担保。',
            '在法律允许的最大范围内，ContextGo 不对因使用本服务产生的间接、附带或后果性损失承担责任。',
          ],
        },
        {
          heading: '付费与订阅',
          content: ['ContextGo 当前不提供订阅付费服务。'],
        },
        {
          heading: '条款变更',
          content: [
            '我们可能不时更新本条款。更新后继续使用服务即表示你接受修订后的条款。',
            '如有法律相关问题，请联系 support@contextgo.io。',
          ],
        },
      ],
    },
  },
};
