export const zh = {
  navbar: {
    product: '介绍',
    connect: '连接',
    download: '下载',
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
    title: '连接你的 AI',
    description: 'ContextGo 架起了本地知识与 AI 智能体之间的桥梁。无缝连接你喜爱的工具，用你的私有上下文为它们赋能。',
    card_desc: 'Skills 集成的目标目录。',
  },
  download: {
    center_badge: '多平台下载中心',
    title: '下载 ContextGo',
    description:
      '在一个页面里接住最新 tag / release 的 ContextGo 分发。桌面端、Linux 和 Android 可以走直链下载，iPhone / iPad 与 HarmonyOS 则可以引流到你配置的官方安装路径。',
    mac_arch: '通用 (Apple Silicon & Intel)',
    win_arch: 'x64 / ARM64',
    download_action: '下载',
    version_label: '当前版本',
    version_pending: '等待正式 tag 发布',
    updated_label: '更新时间',
    source_label: '来源',
    source_none: '暂不可用',
    checksum_label: 'SHA256 覆盖',
    checksum_available: '已提供',
    checksum_missing: '等待 manifest',
    manifest_note: 'Release manifest 更新时间：{{date}}',
    manifest_pending: '等待 release manifest',
    system_requirements_label: '系统要求',
    permissions_label: '权限说明',
    asset_block_label: '发布资产',
    asset_file_label: '文件',
    asset_size_label: '大小',
    asset_unknown: '未知',
    sha256_label: 'SHA256',
    sha256_missing: '暂未发布',
    no_direct_asset: '当前平台还没有发布可直接下载的安装资产。',
    source_release: 'GitHub Release',
    source_tag: 'Git Tag',
    release_notes_action: '打开发布说明',
    release_source_note: '发布真相源：{{repo}}',
    note_release: {
      title: '桌面端、Linux 与 Android',
      body: '只要把签名后的安装包或 APK / AAB 挂到 GitHub Release，并附带 release manifest，这个页面就能自动对齐文件名、下载按钮、大小和 SHA256。',
    },
    note_ios: {
      title: 'iPhone / iPad',
      body: '建议走 App Store、TestFlight 或网页安装入口，不把公开直链 IPA 作为主路径。',
    },
    note_harmony: {
      title: 'HarmonyOS',
      body: '建议优先走 AppGallery Connect / AppGallery。后续如果挂了签名 HAP，也可以作为补充入口展示。',
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
