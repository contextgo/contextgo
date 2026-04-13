import type { BlogCollectionMap } from '../types';

export const draftBlogCollections: BlogCollectionMap = {
  en: {
    schemaVersion: 1,
    locale: 'en',
    exportedAt: '1970-01-01T00:00:00.000Z',
    blog: {
      badge: 'Blog',
      title: 'Product Notes and Operational Writing',
      description:
        'Use the blog for product rationale, architecture decisions, and release-operational changes that matter to users or admins.',
      featuredLabel: 'Editorial direction',
      featuredDescription:
        'ContextGo blog content should answer three questions clearly: what changed, why it matters, and how it affects real workflows.',
      entries: [
        {
          slug: 'context-before-agents',
          eyebrow: 'Product Model',
          title: 'Why ContextGo starts from context before agents',
          summary:
            'The product is not trying to create another chat surface first. It starts by connecting the working context so agents can operate inside real workflows.',
          readingTime: '4 min',
          publishedAt: '2026-03-30',
        },
        {
          slug: 'release-operations-source-of-truth',
          eyebrow: 'Release Operations',
          title: 'Release operations should flow through contextgo-releases',
          summary:
            'The website, download center, and in-app updater all become simpler when one release repository acts as the canonical product-release source of truth.',
          readingTime: '5 min',
          publishedAt: '2026-03-30',
        },
        {
          slug: 'desktop-host-mobile-client',
          eyebrow: 'Remote Product',
          title: 'Desktop host, mobile client: keep the product model explicit',
          summary:
            'Remote access only feels coherent when users understand that the desktop machine remains the host and the mobile shell stays a remote client.',
          readingTime: '5 min',
          publishedAt: '2026-03-30',
        },
      ],
    },
    articles: {
      'context-before-agents': {
        slug: 'context-before-agents',
        eyebrow: 'Product Model',
        title: 'Why ContextGo starts from context before agents',
        summary:
          'The product is not trying to create another chat surface first. It starts by connecting the working context so agents can operate inside real workflows.',
        readingTime: '4 min',
        publishedAt: '2026-03-30',
        html: '<h2 id="why-this-product-does-not-start-from-a-blank-chat-box">Why this product does not start from a blank chat box</h2>\n<p>A generic chat surface is easy to demo but weak in actual workflows because the context layer is missing. Files, docs, tasks, history, and channels are still scattered across tools.</p>\n<p>ContextGo is built around the idea that once the context layer is connected, agents stop being isolated assistants and start becoming participants in the workflow that already exists.</p>\n<h2 id="product-consequence">Product consequence</h2>\n<p>This product direction affects everything else: connectors, remote access, cloud identity, and runtime management are all there to make the context layer usable in real environments.</p>',
      },
      'release-operations-source-of-truth': {
        slug: 'release-operations-source-of-truth',
        eyebrow: 'Release Operations',
        title: 'Release operations should flow through contextgo-releases',
        summary:
          'The website, download center, and in-app updater all become simpler when one release repository acts as the canonical product-release source of truth.',
        readingTime: '5 min',
        publishedAt: '2026-03-30',
        html: '<h2 id="one-release-repository-reduces-ambiguity">One release repository reduces ambiguity</h2>\n<p>If the website, GitHub Release assets, and desktop updater all point at different places, users cannot tell which version is real. The release repository fixes that by becoming the single factual source for installable artifacts.</p>\n<p>This lets contextgo.io render download information from the same place the desktop client checks for updates.</p>\n<h2 id="what-belongs-in-the-release-repository">What belongs in the release repository</h2>\n<p>Build artifacts, checksums, manifests, and release notes belong there. Long-form docs, blog posts, and marketing pages do not. Those should stay on the website side.</p>',
      },
      'desktop-host-mobile-client': {
        slug: 'desktop-host-mobile-client',
        eyebrow: 'Remote Product',
        title: 'Desktop host, mobile client: keep the product model explicit',
        summary:
          'Remote access only feels coherent when users understand that the desktop machine remains the host and the mobile shell stays a remote client.',
        readingTime: '5 min',
        publishedAt: '2026-03-30',
        html: '<h2 id="avoid-describing-mobile-as-a-second-execution-host">Avoid describing mobile as a second execution host</h2>\n<p>The mobile shell is valuable because it lets users access their desktop-hosted workspace from elsewhere. That value disappears if the product story implies a full second runtime running locally on the phone.</p>\n<p>For uploads, control flows, and WebUI rendering, the right mental model is still remote access to the desktop host.</p>\n<h2 id="why-this-matters-for-roadmap-decisions">Why this matters for roadmap decisions</h2>\n<p>Once the product model is clear, cloud features, tunnel design, and relay architecture become easier to explain. The control plane can evolve without pretending the compute plane has moved into the cloud or onto the handset.</p>',
      },
    },
  },
  zh: {
    schemaVersion: 1,
    locale: 'zh',
    exportedAt: '1970-01-01T00:00:00.000Z',
    blog: {
      badge: '博客',
      title: '产品说明与运维写作',
      description: '博客用于承载产品思路、架构决策，以及对用户和管理员真正有影响的发布运维变化。',
      featuredLabel: '编辑方向',
      featuredDescription: 'ContextGo 的博客内容应该明确回答三个问题：改了什么、为什么重要、它如何影响真实工作流。',
      entries: [
        {
          slug: 'context-before-agents',
          eyebrow: '产品模型',
          title: '为什么 ContextGo 先做上下文，再谈 Agent',
          summary: '这个产品不是先造一个聊天框，而是先把工作上下文接通，让 Agent 能真正进入现实工作流。',
          readingTime: '4 分钟',
          publishedAt: '2026-03-30',
        },
        {
          slug: 'release-operations-source-of-truth',
          eyebrow: '发布运维',
          title: '发布运维应该统一收口到 contextgo-releases',
          summary: '当官网、下载中心和桌面端更新都读取同一个 release 仓库时，产品版本事实来源才会真正清晰。',
          readingTime: '5 分钟',
          publishedAt: '2026-03-30',
        },
        {
          slug: 'desktop-host-mobile-client',
          eyebrow: '远程产品',
          title: '桌面主机，移动端客户端，这个产品模型要说清楚',
          summary: '只有当用户理解桌面端仍是主机、移动端仍是远程控制面时，远程访问能力才会真正显得一致。',
          readingTime: '5 分钟',
          publishedAt: '2026-03-30',
        },
      ],
    },
    articles: {
      'context-before-agents': {
        slug: 'context-before-agents',
        eyebrow: '产品模型',
        title: '为什么 ContextGo 先做上下文，再谈 Agent',
        summary: '这个产品不是先造一个聊天框，而是先把工作上下文接通，让 Agent 能真正进入现实工作流。',
        readingTime: '4 分钟',
        publishedAt: '2026-03-30',
        html: '<h2 id="为什么不从空白聊天框开始">为什么不从空白聊天框开始</h2>\n<p>通用聊天界面很容易演示，但在真实工作流里往往乏力，因为文件、文档、任务、历史和渠道仍然是散的。</p>\n<p>ContextGo 的核心观点是，一旦上下文层被接通，Agent 就不再只是孤立回答问题的助手，而开始成为现有工作流里的参与者。</p>\n<h2 id="这会直接改变产品设计">这会直接改变产品设计</h2>\n<p>因此 connector、远程访问、云身份和 runtime 管理都不是边角功能，而是为了让上下文层在真实环境里可用而存在。</p>',
      },
      'release-operations-source-of-truth': {
        slug: 'release-operations-source-of-truth',
        eyebrow: '发布运维',
        title: '发布运维应该统一收口到 contextgo-releases',
        summary: '当官网、下载中心和桌面端更新都读取同一个 release 仓库时，产品版本事实来源才会真正清晰。',
        readingTime: '5 分钟',
        publishedAt: '2026-03-30',
        html: '<h2 id="一个-release-仓库可以减少歧义">一个 release 仓库可以减少歧义</h2>\n<p>如果官网、GitHub Release 产物和桌面端更新分别指向不同地方，用户很难判断哪一个才是真实版本。release 仓库的价值就在于成为唯一的产品版本事实来源。</p>\n<p>这样 contextgo.io 可以从与桌面端更新检查相同的来源读取下载信息。</p>\n<h2 id="什么内容应该放进-release-仓库">什么内容应该放进 release 仓库</h2>\n<p>二进制安装包、校验值、manifest 和 release notes 摘要属于 release 仓库。长文档、博客和官网内容不应该混进去，它们应该继续留在站点侧。</p>',
      },
      'desktop-host-mobile-client': {
        slug: 'desktop-host-mobile-client',
        eyebrow: '远程产品',
        title: '桌面主机，移动端客户端，这个产品模型要说清楚',
        summary: '只有当用户理解桌面端仍是主机、移动端仍是远程控制面时，远程访问能力才会真正显得一致。',
        readingTime: '5 分钟',
        publishedAt: '2026-03-30',
        html: '<h2 id="不要把移动端描述成第二套执行主机">不要把移动端描述成第二套执行主机</h2>\n<p>移动壳的价值在于让用户从别处访问桌面主机上的工作区。如果产品叙事暗示手机本地也运行了一整套同级执行环境，这个价值模型就会被说乱。</p>\n<p>对于上传、控制流和 WebUI 呈现，正确心智模型仍然是“远程访问桌面主机”。</p>\n<h2 id="这会影响后续路线设计">这会影响后续路线设计</h2>\n<p>一旦模型说清楚，云功能、隧道设计和 relay 架构都会更容易解释。控制平面可以持续演进，但不需要假装计算平面已经上云或转移到了手机本地。</p>',
      },
    },
  },
};
