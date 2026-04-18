import type { BlogCollectionMap } from '../types';

export const draftBlogCollections: BlogCollectionMap = {
  "en": {
    "schemaVersion": 1,
    "locale": "en",
    "exportedAt": "1970-01-01T00:00:00.000Z",
    "blog": {
      "badge": "Blog",
      "title": "ContextGo Product Journal and Operational Notes",
      "description": "This journal explains ContextGo's product model, remote-access boundaries, and release-operational decisions so the public story matches the real delivery model.",
      "featuredLabel": "Journal brief",
      "featuredDescription": "Each note should explain the product boundary ContextGo is choosing, how it changes real usage, and why it also matters operationally.",
      "entries": [
        {
          "slug": "context-before-agents",
          "eyebrow": "Product Model",
          "title": "Why ContextGo starts from context before agents",
          "summary": "ContextGo does not start from a chat box. It starts from a working context layer that connects files, tasks, docs, channels, and runtime state.",
          "readingTime": "7 min",
          "publishedAt": "2026-03-30"
        },
        {
          "slug": "release-operations-source-of-truth",
          "eyebrow": "Release Operations",
          "title": "Release operations should flow through contextgo-releases",
          "summary": "Website downloads, GitHub releases, and desktop updates should read from one factual source. Otherwise users cannot tell which version is actually real.",
          "readingTime": "7 min",
          "publishedAt": "2026-03-30"
        },
        {
          "slug": "desktop-host-mobile-client",
          "eyebrow": "Remote Product",
          "title": "Desktop host, mobile client: keep the product model explicit",
          "summary": "Remote access only stays coherent when the product is explicit: the desktop remains the real execution host, while browser and mobile remain remote clients.",
          "readingTime": "7 min",
          "publishedAt": "2026-03-30"
        }
      ]
    },
    "articles": {
      "context-before-agents": {
        "slug": "context-before-agents",
        "eyebrow": "Product Model",
        "title": "Why ContextGo starts from context before agents",
        "summary": "ContextGo does not start from a chat box. It starts from a working context layer that connects files, tasks, docs, channels, and runtime state.",
        "readingTime": "7 min",
        "publishedAt": "2026-03-30",
        "html": "<div class=\"editorial-note\"><p class=\"editorial-note-label\">Core position</p><p>Without a connected context layer, agents remain surface-level assistants. Once that layer exists, they can participate inside real workflows.</p></div>\n<h2 id=\"why-a-blank-chat-box-is-not-enough\">Why a blank chat box is not enough</h2>\n<p>A generic chat surface is easy to demo because it compresses the story into one promise: ask anything. The problem appears when that story touches real work. Files live on the local machine, design notes live in docs, decisions live in channels, task state lives in external systems, and execution depends on the host runtime.</p>\n<p>That means users are not mainly missing another interface for asking questions. They are missing an operational layer that connects the working context. If that layer does not exist, even a strong model stays trapped in one-off question answering.</p>\n<p>ContextGo starts from that layer. It is not a chat-first product that later accumulates connectors. It is a context-first product that makes connectors, runtime operations, and remote use part of the foundation.</p>\n<h2 id=\"what-contextgo-means-by-context-layer\">What ContextGo means by “context layer”</h2>\n<p>The context layer is not just retrieval and it is not just stuffing a few documents into a prompt. It should be a persistent working structure that can be reused, updated, and acted on over time.</p>\n<p>At minimum, it should connect:</p>\n<ol>\n<li>the files, docs, and reference material relevant to the task</li>\n<li>the surrounding decisions, conversations, comments, and channel history</li>\n<li>the machine, runtime, and connectors needed to actually run the work</li>\n<li>the remote surfaces that need to reuse the same context later, including desktop, WebUI, and remote clients</li>\n</ol>\n<p>Once those objects are connected, an agent stops being a temporary helper that sees one snapshot. It becomes a participant inside an actual workspace.</p>\n<h2 id=\"how-this-changes-the-product-boundary\">How this changes the product boundary</h2>\n<p>As soon as you accept that the product is really about the context layer, several boundaries become much clearer.</p>\n<p>Connectors stop being decorative integrations. They become the way scattered source material and operating surfaces enter the product. Runtime management stops looking like implementation plumbing and starts looking like a requirement for real execution. Remote access stops being an optional convenience and becomes part of how the same context layer is safely reused from somewhere else.</p>\n<p>The reverse is also true. Some things should not become the center of the product story. A flashy assistant surface, a growing pile of prompt presets, or a vague claim that the model is smarter may all be useful, but they should not replace the real product boundary.</p>\n<h2 id=\"what-this-means-for-users-and-operators\">What this means for users and operators</h2>\n<p>For users, this judgment changes expectations. They should expect ContextGo to assemble context, not just respond. They should expect to connect tasks, materials, execution, and history, instead of re-explaining everything every time.</p>\n<p>For operators and admins, the same judgment means the website, docs, and release behavior all need to describe one coherent model. You cannot tell the market that the product is an always-available AI workspace and then quietly depend on desktop-hosted execution without explaining where work actually runs.</p>\n<p>That is why future product decisions should keep answering the same question: does this capability strengthen the context layer, or does it only add another AI entry point on the surface?</p>\n<h2 id=\"how-to-keep-reading-the-model\">How to keep reading the model</h2>\n<p>If you accept that context comes before the agent surface, the next two notes become easier to read in the right order.</p>\n<p>Read <em>Desktop host, mobile client: keep the product model explicit</em> next, because the remote model decides where that context layer really lives. Then read <em>Release operations should flow through contextgo-releases</em>, because the release source determines how external users understand version truth, downloads, and updates.</p>\n<p>Taken together, those three notes form the current public product model ContextGo should keep consistent.</p>"
      },
      "release-operations-source-of-truth": {
        "slug": "release-operations-source-of-truth",
        "eyebrow": "Release Operations",
        "title": "Release operations should flow through contextgo-releases",
        "summary": "Website downloads, GitHub releases, and desktop updates should read from one factual source. Otherwise users cannot tell which version is actually real.",
        "readingTime": "7 min",
        "publishedAt": "2026-03-30",
        "html": "<div class=\"editorial-note\"><p class=\"editorial-note-label\">Core position</p><p>Release architecture is not an internal detail from the user&#x27;s perspective. It is a trust question: which version is real, where to download it, and whether the updater matches the website.</p></div>\n<h2 id=\"why-version-truth-needs-a-single-source\">Why version truth needs a single source</h2>\n<p>As soon as the website, GitHub release page, download center, and desktop updater read from different places, the product creates a familiar support problem: every surface looks official, but users cannot tell which version is actually current.</p>\n<p>That ambiguity is expensive. A user may see one version on the site, another in the app, and a third asset name on GitHub. Support teams then waste time answering a preliminary question before any real troubleshooting can begin: which version are we even talking about?</p>\n<p>The value of <code>contextgo-releases</code> is that it becomes the single factual source for installable product versions. Anything related to artifacts, checksums, manifests, and updater-readable release data should converge there.</p>\n<h2 id=\"what-the-release-repository-should-actually-contain\">What the release repository should actually contain</h2>\n<p>The release repository is the right place for:</p>\n<ol>\n<li>downloadable binary artifacts</li>\n<li>checksums, manifests, and artifact metadata</li>\n<li>version-level release notes summaries</li>\n<li>a stable public structure that the website and desktop updater can read</li>\n</ol>\n<p>It is not the right place for long-form docs, product essays, or website brand pages. Those belong on the site because they are responsible for explanation, education, and public product narrative rather than artifact truth.</p>\n<p>Once that boundary is explicit, the website and the release repository stop contaminating each other. The website explains the product and operating model. The release repository explains what was actually shipped in a specific release.</p>\n<h2 id=\"why-website-downloads-and-desktop-updates-need-to-align\">Why website downloads and desktop updates need to align</h2>\n<p>Users do not naturally separate “website logic,” “updater logic,” and “GitHub release logic.” They experience one product: the website offers a download and the desktop app offers an update.</p>\n<p>Those two surfaces should therefore read the same release truth:</p>\n<ol>\n<li>the website download center reads artifact and version information from the release repository</li>\n<li>the desktop updater reads its manifest from the same source</li>\n<li>support starts with the release record first, then verifies site or client behavior</li>\n</ol>\n<p>That keeps the product stable even while the site design, download-page copy, and updater interaction continue to evolve. The underlying version fact remains singular.</p>\n<h2 id=\"how-this-changes-support-and-troubleshooting\">How this changes support and troubleshooting</h2>\n<p>Once release truth is unified, the troubleshooting order becomes much simpler.</p>\n<p>Support no longer has to begin by guessing whether the site is stale, the client is reading the wrong manifest, or the Git tag is mismatched. They can start from the release record and then trace synchronization issues outward.</p>\n<p>It also makes future download pages, auto-update flows, and release broadcasts easier to standardize. Each surface stops maintaining its own local truth and starts consuming one shared release record.</p>\n<h2 id=\"the-long-term-payoff\">The long-term payoff</h2>\n<p>If a public product wants long-term trust, it needs the external story and the installable truth to stay aligned. A single-source release model may look like an operational decision, but it directly shapes brand credibility, support cost, and update experience.</p>\n<p>So this is not just repository hygiene. It is a product-distribution boundary. If ContextGo wants docs, blog, and downloads to each have a clear public role, it also needs release truth to converge just as clearly.</p>"
      },
      "desktop-host-mobile-client": {
        "slug": "desktop-host-mobile-client",
        "eyebrow": "Remote Product",
        "title": "Desktop host, mobile client: keep the product model explicit",
        "summary": "Remote access only stays coherent when the product is explicit: the desktop remains the real execution host, while browser and mobile remain remote clients.",
        "readingTime": "7 min",
        "publishedAt": "2026-03-30",
        "html": "<div class=\"editorial-note\"><p class=\"editorial-note-label\">Core position</p><p>The value of browser and mobile access is remote use of the desktop host, not the illusion of a second peer execution environment.</p></div>\n<h2 id=\"start-by-making-the-hostclient-model-explicit\">Start by making the host/client model explicit</h2>\n<p>As soon as a product includes browser access, a mobile shell, and remote control, it becomes easy to slip into a softer but misleading story: describe mobile as if it were another independent host so the product sounds more “available everywhere.”</p>\n<p>That creates the wrong expectations quickly. Users start assuming the phone can execute the same work locally, that files and runtimes exist there as peers to the desktop, and that connectivity only matters for sync rather than for access to the actual host.</p>\n<p>The clearer ContextGo model is simpler: the desktop remains the real execution host, while browser and mobile surfaces are remote clients. They give the user access to the host workspace from somewhere else; they do not duplicate the host plane.</p>\n<h2 id=\"where-upload-execution-and-local-file-handling-really-happen\">Where upload, execution, and local-file handling really happen</h2>\n<p>Once that model is explicit, capability boundaries become easier to explain.</p>\n<p>Files selected from a phone should upload into the desktop host and continue from there. Tasks launched from the WebUI still execute on the host side. Runtime discovery, tool access, and environment dependencies still orbit the desktop machine.</p>\n<p>That does not reduce the value of remote clients. It protects the value by aligning the promise with the actual system behavior.</p>\n<h2 id=\"why-the-phone-should-not-be-described-as-a-second-execution-host\">Why the phone should not be described as a second execution host</h2>\n<p>If the phone is described as a peer host, many practical details become awkward to explain.</p>\n<p>Why do some tools only run on the desktop machine? Why do connector permissions still depend on the host environment? Why does a remote upload ultimately flow back into the host? Why does some work still require the desktop device to stay online?</p>\n<p>Those explanations start sounding like patches rather than expressions of a coherent product model. Worse, the team can get pulled into the wrong roadmap questions, such as whether it should simulate a second local execution environment on mobile rather than making remote access itself better.</p>\n<h2 id=\"how-this-shapes-the-future-architecture\">How this shapes the future architecture</h2>\n<p>Once the desktop-host / remote-client relationship is explicit, cloud identity, device registration, tunnel behavior, relay architecture, and WebUI behavior all become easier to explain.</p>\n<p>The control plane can keep improving with better device discovery, stronger remote connectivity, and smoother authentication. That does not require pretending the compute plane has moved into the cloud or onto the handset.</p>\n<p>This is useful because product, engineering, and support can all use the same language. When the language is stable, users understand the boundary better and the team can prioritize the right work.</p>\n<h2 id=\"what-the-public-docs-and-copy-need-to-do\">What the public docs and copy need to do</h2>\n<p>If ContextGo adopts a desktop-host / mobile-client model, the website, docs, download pages, and mobile-access explanations should all reflect it together.</p>\n<p>Any page that talks about browser access, mobile uploads, or remote tasks should say where work actually runs. That prevents users from forming the wrong expectation during evaluation and keeps support from having to correct the story later.</p>\n<p>Remote-access products are damaged less by constraints than by ambiguity. Making the host/client relationship explicit is itself part of the product quality.</p>"
      }
    }
  },
  "zh": {
    "schemaVersion": 1,
    "locale": "zh",
    "exportedAt": "1970-01-01T00:00:00.000Z",
    "blog": {
      "badge": "博客",
      "title": "ContextGo 产品刊物与操作说明",
      "description": "这里公开解释 ContextGo 的产品模型、远程访问边界和发布运维判断，让官网叙事、产品行为与真实交付链路保持一致。",
      "featuredLabel": "刊物说明",
      "featuredDescription": "每篇文章都应该回答三个问题：ContextGo 选择了什么边界、它会怎样影响真实使用，以及为什么它对发布或运维同样重要。",
      "entries": [
        {
          "slug": "context-before-agents",
          "eyebrow": "产品模型",
          "title": "为什么 ContextGo 先做上下文，再谈 Agent",
          "summary": "ContextGo 的真正起点不是一个聊天框，而是一层把文件、任务、文档、渠道和运行时状态接通的工作上下文。",
          "readingTime": "7 分钟",
          "publishedAt": "2026-03-30"
        },
        {
          "slug": "release-operations-source-of-truth",
          "eyebrow": "发布运维",
          "title": "发布运维应该统一收口到 contextgo-releases",
          "summary": "官网下载、GitHub Release 和桌面端更新都应该读取同一个事实来源，否则用户无法判断哪个版本才是真的。",
          "readingTime": "7 分钟",
          "publishedAt": "2026-03-30"
        },
        {
          "slug": "desktop-host-mobile-client",
          "eyebrow": "远程产品",
          "title": "桌面主机，移动端客户端，这个产品模型要说清楚",
          "summary": "远程访问要成立，前提是产品先明确：桌面端继续是真正的执行主机，移动端和浏览器继续是远程客户端。",
          "readingTime": "7 分钟",
          "publishedAt": "2026-03-30"
        }
      ]
    },
    "articles": {
      "context-before-agents": {
        "slug": "context-before-agents",
        "eyebrow": "产品模型",
        "title": "为什么 ContextGo 先做上下文，再谈 Agent",
        "summary": "ContextGo 的真正起点不是一个聊天框，而是一层把文件、任务、文档、渠道和运行时状态接通的工作上下文。",
        "readingTime": "7 分钟",
        "publishedAt": "2026-03-30",
        "html": "<div class=\"editorial-note\"><p class=\"editorial-note-label\">核心判断</p><p>如果上下文层没有先接通，Agent 只能停留在问答表面；一旦上下文层接通，Agent 才能进入真实工作流。</p></div>\n<h2 id=\"一个空白聊天框为什么不够\">一个空白聊天框为什么不够</h2>\n<p>通用聊天界面很容易演示，因为它把能力压缩成一句简单承诺：“你可以问任何问题”。但只要进入真实工作环境，这种叙事就会立刻失效。文件在本地磁盘里，设计说明在文档里，决策记录在消息渠道里，任务状态在第三方系统里，真正的执行又依赖机器上的 runtime 和工具链。</p>\n<p>这意味着用户真正缺的，并不是另一个会回答问题的窗口，而是一层能把工作上下文真正接起来的基础设施。如果这个前提没有先成立，再强的模型也只能做离散问答，很难进入真实工作流。</p>\n<p>ContextGo 的起点，正是这层“联通上下文”。我们不是先做一个聊天框，再逐步补 connector；而是先让连接、上下文整理、运行环境和远程使用都成立，再让 Agent 在这层基础上工作。</p>\n<h2 id=\"contextgo-所说的上下文层到底是什么\">ContextGo 所说的“上下文层”到底是什么</h2>\n<p>这里的上下文层，不只是给模型塞一段检索结果，也不是把几份文档拼进提示词里。它应该是一层长期存在、可以持续被使用和更新的工作结构。</p>\n<p>它至少要覆盖几件事：</p>\n<ol>\n<li>当前任务相关的文件、文档和知识材料。</li>\n<li>与这个任务有关的历史决策、对话、评论和渠道记录。</li>\n<li>任务要运行在哪台主机、使用什么 runtime、访问哪些连接器。</li>\n<li>这层上下文如何被不同入口重复使用，例如桌面端、WebUI 和远程客户端。</li>\n</ol>\n<p>当这些对象被连成一层之后，Agent 才不是“拿到一段临时上下文就回答一次”，而是能够在一个真实工作空间里持续推进事情。</p>\n<h2 id=\"这会怎样反向约束产品边界\">这会怎样反向约束产品边界</h2>\n<p>一旦承认 ContextGo 的核心是上下文层，很多边界就会变得非常明确。</p>\n<p>connector 不是装饰性集成，而是把散落在各个系统里的材料和操作面接进来。runtime 管理不是底层细节，而是保证 Agent 真能在正确环境里执行工作。远程访问也不是附属能力，而是为了让同一个上下文层可以从别的设备上被安全使用。</p>\n<p>反过来说，有些东西就不应该被当成产品中心。比如一个花哨的聊天界面、堆叠越来越多的 prompt preset，或者只强调“模型更聪明了”。这些都可能有价值，但它们不应该替代 ContextGo 的真正产品边界。</p>\n<h2 id=\"这对用户和管理员意味着什么\">这对用户和管理员意味着什么</h2>\n<p>对用户来说，这个判断决定了他们在 ContextGo 里看到的不是孤立对话，而是一整套可操作的工作环境。用户会期待自己能把任务、资料、历史和执行都接到一起，而不是每次都从头解释一遍背景。</p>\n<p>对管理员和部署者来说，这个判断意味着产品说明、文档和发布运维都必须围绕同一套模型展开。你不能在官网上说产品是“随时随地的 AI 工作台”，却在实际行为里又要求一切依赖桌面主机本地环境而没有说明。</p>\n<p>因此产品叙事、文档结构和后续路线，都要持续回答同一个问题：这项能力是不是在增强上下文层，而不是只在表面上增加一个 AI 入口。</p>\n<h2 id=\"后续应该怎么读这套产品模型\">后续应该怎么读这套产品模型</h2>\n<p>如果你先认可“上下文层先于 Agent”这件事，后面的两篇文章就会更容易理解。</p>\n<p>先读《桌面主机，移动端客户端，这个产品模型要说清楚》，因为远程访问模型决定了这层上下文到底运行在哪里、由谁承载。再读《发布运维应该统一收口到 contextgo-releases》，因为发布来源会决定外部用户如何理解版本、下载和更新的真实来源。</p>\n<p>这三篇放在一起，才是 ContextGo 当前对外应该保持一致的一套产品说法。</p>"
      },
      "release-operations-source-of-truth": {
        "slug": "release-operations-source-of-truth",
        "eyebrow": "发布运维",
        "title": "发布运维应该统一收口到 contextgo-releases",
        "summary": "官网下载、GitHub Release 和桌面端更新都应该读取同一个事实来源，否则用户无法判断哪个版本才是真的。",
        "readingTime": "7 分钟",
        "publishedAt": "2026-03-30",
        "html": "<div class=\"editorial-note\"><p class=\"editorial-note-label\">核心判断</p><p>对用户来说，release 架构不是内部实现，而是信任问题：哪个版本是真的，去哪里下载，桌面更新是否和官网一致。</p></div>\n<h2 id=\"为什么版本事实来源必须单一\">为什么版本事实来源必须单一</h2>\n<p>一旦官网、GitHub Release 页面、下载中心和桌面端更新各自读不同地方，产品就会出现一种非常典型的支持问题：每个地方都“看起来像官方”，但用户无法判断哪个才是当前版本。</p>\n<p>这会直接带来歧义。用户可能在官网看到一个版本号，在桌面端看到另一个，在 GitHub 上又找到第三种产物命名。对支持团队来说，这意味着排障时先要解决“我们现在在讨论哪个版本”。</p>\n<p><code>contextgo-releases</code> 的价值，就是成为唯一的产品版本事实来源。凡是跟“可安装产物、校验值、manifest、更新来源”有关的东西，都应该围绕这个仓库收口。</p>\n<h2 id=\"release-仓库到底承载什么\">release 仓库到底承载什么</h2>\n<p>release 仓库最适合承载的是这些内容：</p>\n<ol>\n<li>可下载安装的二进制安装包。</li>\n<li>对应的 checksum、manifest 和版本产物元数据。</li>\n<li>版本级 release notes 摘要。</li>\n<li>给下载中心和桌面 updater 读取的稳定公开结构。</li>\n</ol>\n<p>它不适合承载的是长文档、博客正文和官网品牌页面。这些内容应该继续保留在站点侧，因为它们承担的是解释、教育和品牌职责，而不是作为安装事实来源。</p>\n<p>把这层边界分清楚之后，站点和 release 仓库就不会互相污染。官网负责讲清楚产品、文档和操作说明；release 仓库负责讲清楚某个版本到底发布了什么产物。</p>\n<h2 id=\"官网下载与桌面更新为什么要对齐\">官网下载与桌面更新为什么要对齐</h2>\n<p>对外产品体验里，用户并不会主动区分“这是站点逻辑、这是 updater 逻辑、这是 GitHub Release 逻辑”。他们感受到的是一个统一产品：官网提供下载，桌面端提供更新。</p>\n<p>因此这两个入口必须读取同一份版本事实。最理想的状态是：</p>\n<ol>\n<li>官网下载中心从 release 仓库读取版本与产物信息。</li>\n<li>桌面端更新检查从同一来源读取 manifest。</li>\n<li>支持团队在排障时，只需要先确认 release 仓库记录，再追踪站点或客户端表现。</li>\n</ol>\n<p>这样即使站点视觉、下载页文案和客户端交互在演进，底层版本事实仍然只有一份，不会因为某个页面缓存、某段脚本或者某份手工维护文案而漂移。</p>\n<h2 id=\"这会怎样改变支持与排障\">这会怎样改变支持与排障</h2>\n<p>一旦版本事实来源统一，很多问题的排查顺序都会变简单。</p>\n<p>支持团队不再需要先猜“是网站没更新，还是客户端读错了，还是 GitHub 上的 tag 不对”。他们可以先看 release 仓库记录，再去判断站点是否同步、客户端是否读取正确。</p>\n<p>这也会让未来的下载页、自动更新和版本广播更容易标准化。因为每个面都不是在维护自己的版本真相，而是在消费同一份发布记录。</p>\n<h2 id=\"长期收益是什么\">长期收益是什么</h2>\n<p>一个公开产品如果想长期建立信任，必须把“对外说法”和“可安装事实”绑在一起。release 仓库的单一来源模型，看起来像运维决策，实际上会反向影响品牌可信度、支持成本和更新体验。</p>\n<p>所以这不是简单的仓库整理问题，而是产品分发边界问题。ContextGo 要对外讲清楚文档、博客和下载的角色，就必须同时把 release 来源收口清楚。</p>"
      },
      "desktop-host-mobile-client": {
        "slug": "desktop-host-mobile-client",
        "eyebrow": "远程产品",
        "title": "桌面主机，移动端客户端，这个产品模型要说清楚",
        "summary": "远程访问要成立，前提是产品先明确：桌面端继续是真正的执行主机，移动端和浏览器继续是远程客户端。",
        "readingTime": "7 分钟",
        "publishedAt": "2026-03-30",
        "html": "<div class=\"editorial-note\"><p class=\"editorial-note-label\">核心判断</p><p>移动端和浏览器的价值在于远程使用桌面主机，而不是伪装成另一套同级执行环境。</p></div>\n<h2 id=\"先把主机和客户端关系说清楚\">先把主机和客户端关系说清楚</h2>\n<p>只要产品开始涉及浏览器使用、移动壳和远程访问，就很容易出现一种叙事滑坡：为了让产品听起来更“随时随地”，对外会慢慢把移动端描述成像另一台独立主机。</p>\n<p>这听起来方便，但会快速制造错误预期。用户会以为手机本地具备和桌面端同等级的执行能力，会以为文件、runtime 和任务都在手机本地完整存在，也会以为网络中断时仍能做同样的事情。</p>\n<p>ContextGo 当前更清晰的产品模型是：桌面端继续是真正的执行主机，浏览器和移动端是远程使用面。它们让用户从别处访问主机上的工作区，而不是复制出一套第二执行平面。</p>\n<h2 id=\"上传执行和本地文件到底发生在哪里\">上传、执行和本地文件到底发生在哪里</h2>\n<p>这个模型一旦说清楚，很多能力边界就不再含糊。</p>\n<p>移动端本地选中的文件，应该通过上传流进入桌面主机，再继续后续处理。WebUI 上发起的任务，真正执行仍然发生在主机侧。runtime 的发现、调用和环境依赖，也应当以桌面主机为中心。</p>\n<p>这并不是在削弱移动端或浏览器价值，恰恰相反，它是在保护价值。因为它让远程客户端承诺的事情和实际能做到的事情保持一致。</p>\n<h2 id=\"为什么不能把手机描述成第二执行主机\">为什么不能把手机描述成第二执行主机</h2>\n<p>一旦把手机描述成同级主机，产品就会很难解释很多现实细节。</p>\n<p>比如为什么某些本地工具只能在桌面端运行，为什么 connector 权限仍绑定主机环境，为什么远程上传最终要回到主机处理，为什么某些工作需要桌面在线。所有这些说明都会显得像补丁，而不是统一模型的一部分。</p>\n<p>更严重的是，这种说法会拖累路线判断。团队会在“是不是还需要再做一套移动本地执行环境”这类问题上反复摇摆，而不是持续强化远程体验本身。</p>\n<h2 id=\"这会怎样影响后续架构\">这会怎样影响后续架构</h2>\n<p>当桌面主机与远程客户端的关系被明确之后，云账号、设备注册、隧道、relay 和 WebUI 行为都会更容易解释。</p>\n<p>控制平面可以持续增强，例如更稳定的设备发现、更好的远程连接和更顺滑的认证流；但这不意味着计算平面已经上云，也不意味着执行主机已经转移到了手机本地。</p>\n<p>这种表述方式会让产品、工程和支持使用同一套语言。只要口径一致，用户就更容易理解能力边界，团队也更容易定义应该优先建设什么。</p>\n<h2 id=\"对外文案和文档应该怎样跟上\">对外文案和文档应该怎样跟上</h2>\n<p>如果 ContextGo 认定自己采用的是“桌面主机，移动端客户端”模型，那么官网、文档、下载页和移动说明都应该一起改口径。</p>\n<p>任何涉及移动访问、浏览器访问、上传流程和远程任务的页面，都应该明确写出工作真正运行在哪里。这样用户不会在购买或部署前形成错误期待，支持团队也不用在问题发生后再做二次教育。</p>\n<p>远程访问产品最怕的不是限制，而是口径模糊。把主机与客户端的关系说清楚，本身就是产品能力的一部分。</p>"
      }
    }
  }
};
