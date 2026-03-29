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
    title_start: '掌控你的上下文，',
    title_end: '释放 AI 潜能。',
    description: '连接本地知识与大语言模型的关键桥梁。安全地管理你的私有上下文，并通过标准协议服务于任何 AI 智能体。',
    download_btn: '免费下载',
    connect_btn: '连接 AI',
  },
  philosophy: {
    title: '为什么选择 ContextGo？',
    description_start: '在大模型时代，模型的智能程度取决于你提供的上下文质量。',
    description_end:
      'ContextGo 基于这样一个理念：人类需要一个专门的、本地优先的工具来整理、编辑和组织“外脑”，专门供 AI 消费。',
    points: ['本地优先 & 隐私安全', '为 LLM 上下文窗口优化', '标准化协议 (MCP, Skills)'],
    features: {
      private: { title: '隐私', desc: '数据保留在设备上。始终如一。' },
      editor: { title: '编辑器', desc: '轻量级 Markdown 编辑器，快速整理上下文。' },
      connect: { title: '连接', desc: '无缝传输上下文至 Claude, Cursor 等工具。' },
      manage: { title: '管理', desc: '高效组织知识库。' },
    },
  },
  connect: {
    badge: 'Connector Layer',
    title: '先连接你的上下文，再把它路由到任何地方。',
    description:
      'ContextGo 不只是把 AI 工具接起来。它为文档、笔记、云盘、聊天记录、数据库和工作区提供 connector layer，让你的上下文从分散碎片变成可复用的系统。',
    highlights: ['同时接入本地来源与云端应用', '为所有工作流提供统一上下文界面', '为 agent、检索与发布场景做好 connector 准备'],
    marquee_label: 'Connector 覆盖面',
    marquee_hint: '文件、知识库、聊天、文档与数据系统',
    connector_story_label: '为什么是 connector',
    connector_story_title: '你的上下文应该像基础设施一样流动，而不是藏在一堆标签页里。',
    connector_story_body:
      'Connector 让每个来源都能被 ContextGo 理解。接入之后，同一份上下文就可以被整理、重组、检索、发布，并交付给下一个需要它的 agent 或工作流。',
    features: [
      {
        title: '以 connector 为入口',
        desc: '从文件夹、知识工具、沟通系统和结构化数据里接入上下文，而不是逼用户迁移到单一存储模型。',
      },
      {
        title: '统一成可路由的一层',
        desc: '把分散来源归一到共享的上下文层，供 agent、自动化流程和人工审阅共同消费。',
      },
      {
        title: '下游能力可重复复用',
        desc: '同一份已连接的上下文可以服务聊天、检索、发布、同步和未来团队工作流，不再每次手工重建。',
      },
    ],
    panel_label: '上下文管线',
    panel_title: 'Connector 是 ContextGo 的入口引擎。',
    panel_body:
      '先把来源接进来，整理成一层一致的上下文，再向外路由给 AI 产品、检索流程、远端客户端，以及后续的发布渠道。',
    workflow: [
      {
        title: '从重要来源统一接入',
        desc: '桌面文件夹、笔记、云文档、聊天系统和结构化存储都通过 connector 进入，而不是依赖复制粘贴。',
      },
      {
        title: '归一成一个上下文图层',
        desc: 'ContextGo 会把参差不齐的来源整理成更适合搜索、审阅、排序和服务的一致上下文界面。',
      },
      {
        title: '再路由给 agent 与输出',
        desc: '连接完成后，同一份上下文可以继续流向 AI 会话、远端客户端、connector 驱动的流程以及发布场景。',
      },
    ],
    use_case_label: '使用场景',
    use_cases: [
      {
        title: '连接产品知识',
        desc: '把 PRD、文档、更新记录、工单和内部说明接到同一个界面里，让产品上下文不再散落在十几个标签页之间。',
      },
      {
        title: '连接团队记忆',
        desc: '通过 connector 把埋在聊天工具、会议记录、知识库和共享云盘里的决策重新捞出来，不让它们沉进历史。',
      },
      {
        title: '连接运营数据',
        desc: '把表格、看板、导出结果和结构化记录变成可复用的上下文，而不是每个流程都手工贴一次截图或摘要。',
      },
    ],
  },
  download: {
    center_badge: '选择你的设备',
    title: '获取 ContextGo',
    description:
      '在一个页面里找到适合你设备的最新版 ContextGo。桌面端、Linux 和 Android 可直接下载安装，iPhone / iPad 与 HarmonyOS 则会带你前往对应的官方安装入口。',
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
    manifest_note: '下载页更新于：{{date}}',
    manifest_pending: '正在准备下载信息',
    system_requirements_label: '适用环境',
    permissions_label: '安装说明',
    asset_block_label: '下载详情',
    asset_file_label: '文件',
    asset_size_label: '大小',
    asset_unknown: '未知',
    sha256_label: '校验码',
    sha256_missing: '稍后补充',
    no_direct_asset: '这个平台的直链安装包还在准备中。',
    source_release: '官方发布',
    source_tag: '最新版本',
    release_notes_action: '查看版本说明',
    release_source_note: '下载信息同步自：{{repo}}',
    note_release: {
      title: '桌面端、Linux 与 Android',
      body: '这几个平台会优先提供可直接下载安装的版本，你可以在这里查看文件信息、体积和校验值。',
    },
    note_ios: {
      title: 'iPhone / iPad',
      body: 'iOS 版本会带你前往更适合的官方安装路径，例如 App Store、TestFlight 或网页入口。',
    },
    note_harmony: {
      title: 'HarmonyOS',
      body: 'HarmonyOS 会优先跳转到官方分发渠道；如果后续提供直链安装包，也会在这里展示。',
    },
  },
  footer: {
    tagline: '管理你的上下文，赋能你的 AI。',
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
