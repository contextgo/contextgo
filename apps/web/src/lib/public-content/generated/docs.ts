import type { DocsCollectionMap } from '../types';

export const draftDocsCollections: DocsCollectionMap = {
  "en": {
    "schemaVersion": 1,
    "version": "draft",
    "locale": "en",
    "exportedAt": "1970-01-01T00:00:00.000Z",
    "docs": {
      "badge": "Documentation",
      "title": "ContextGo Docs",
      "description": "Customer-facing documentation for setup, agents, hooks, scheduled tasks, skill market, remote access, and release operations.",
      "featuredLabel": "Documentation structure",
      "featuredDescription": "ContextGo docs split into three layers: Guides explain how to start, Features explain what the product can do, and Operations explain how remote access, cloud identity, and release workflows actually work.",
      "categories": [
        {
          "id": "guides",
          "title": "Guides",
          "description": "Start here to understand the product model, install flow, and how users should approach the first working setup."
        },
        {
          "id": "features",
          "title": "Features",
          "description": "These docs explain the functional surfaces users actually operate: agents, hooks, schedules, runtimes, connectors, and the skill market."
        },
        {
          "id": "operations",
          "title": "Operations",
          "description": "These docs define cloud account behavior, remote-access mechanics, release operations, and troubleshooting guidance."
        }
      ],
      "entries": [
        {
          "slug": "quick-start",
          "eyebrow": "Quick Start",
          "title": "Set up ContextGo on your first desktop",
          "summary": "Install the desktop app, sign in, bind the current device, and confirm the local host is ready for mobile and browser access.",
          "readingTime": "5 min",
          "updatedAt": "2026-03-30",
          "category": "guides"
        },
        {
          "slug": "product-model",
          "eyebrow": "Product Model",
          "title": "Understand the ContextGo product model before you scale usage",
          "summary": "Clarify the relationship between desktop host, mobile shell, cloud account, WebUI, and the release repository before onboarding more devices or teammates.",
          "readingTime": "6 min",
          "updatedAt": "2026-03-30",
          "category": "guides"
        },
        {
          "slug": "agent-workspace",
          "eyebrow": "Agent",
          "title": "Agent entry, assistants, and the working model inside ContextGo",
          "summary": "Understand what the agent entry is for, how assistant management differs from agent entry, and why those concepts should not be collapsed into one vague settings bucket.",
          "readingTime": "7 min",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "agent-collaboration",
          "eyebrow": "Collaboration",
          "title": "Harness mode and agent collaboration workflows",
          "summary": "Explain how local harness mode coexists with remote workflows, and why agent collaboration is a first-class working style rather than an implementation detail.",
          "readingTime": "7 min",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "hooks-overview",
          "eyebrow": "Hooks",
          "title": "Use hooks to extend workflows at the right moment",
          "summary": "Hooks are the product mechanism for inserting controlled behavior around execution events. Users need a clear trigger model, not just a configuration form.",
          "readingTime": "6 min",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "scheduled-tasks",
          "eyebrow": "Scheduled Tasks",
          "title": "Scheduled tasks and cron-driven automation",
          "summary": "Explain how periodic execution works, what kinds of automation belong in scheduled tasks, and what users should watch for in long-running operations.",
          "readingTime": "6 min",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "skill-market",
          "eyebrow": "Skill Market",
          "title": "Skill Market and reusable capability packages",
          "summary": "Show users how the skill market expands what ContextGo can do, how to think about local versus downloadable skills, and how installation should stay trustworthy.",
          "readingTime": "6 min",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "runtime-management",
          "eyebrow": "Runtimes",
          "title": "Manage local runtimes and CLI health",
          "summary": "Install supported runtimes, repair broken CLI environments, and understand why a runtime can be installed but still not be usable yet.",
          "readingTime": "6 min",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "connectors-and-channels",
          "eyebrow": "Connectors",
          "title": "Connectors, channels, and publishing paths",
          "summary": "Explain how sources and channels fit into ContextGo, and why connectors are part of the product core rather than optional integrations.",
          "readingTime": "6 min",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "remote-access",
          "eyebrow": "Remote Access",
          "title": "How remote access works in ContextGo",
          "summary": "Understand the desktop-host model, why remote access depends on a stable device-side connection, and what users should expect on mobile.",
          "readingTime": "7 min",
          "updatedAt": "2026-03-30",
          "category": "operations"
        },
        {
          "slug": "cloud-account",
          "eyebrow": "Cloud Account",
          "title": "What the ContextGo cloud account syncs",
          "summary": "Clarify what the cloud layer is for, what gets linked to the account, and why it should not be confused with full cloud execution.",
          "readingTime": "6 min",
          "updatedAt": "2026-03-30",
          "category": "operations"
        },
        {
          "slug": "updates-and-troubleshooting",
          "eyebrow": "Updates",
          "title": "Updates, releases, and common troubleshooting paths",
          "summary": "Document how in-app updates relate to the website download center and release repository, and give users a single operational troubleshooting entry point.",
          "readingTime": "7 min",
          "updatedAt": "2026-03-30",
          "category": "operations"
        }
      ]
    },
    "articles": {
      "quick-start": {
        "slug": "quick-start",
        "eyebrow": "Quick Start",
        "title": "Set up ContextGo on your first desktop",
        "summary": "Install the desktop app, sign in, bind the current device, and confirm the local host is ready for mobile and browser access.",
        "readingTime": "5 min",
        "updatedAt": "2026-03-30",
        "category": "guides",
        "html": "<h2 id=\"install-the-desktop-host-first\">Install the desktop host first</h2>\n<p>ContextGo starts from the desktop app because the desktop machine is the real execution host. It owns the local workspace, the WebUI runtime, and the remote-access bridge.</p>\n<p>For direct installs, use the download center on contextgo.io. The website reads release artifacts from contextgo/contextgo-releases, so the download page and in-app update flow point at the same version source.</p>\n<h2 id=\"sign-in-and-bind-the-device\">Sign in and bind the device</h2>\n<p>Use the cloud-account entry in the desktop app to sign in with GitHub or Google. Once the browser flow completes, ContextGo registers the current desktop as a cloud-linked device.</p>\n<p>The cloud account does not move execution into the cloud. It links identity, device registration, and lightweight sync metadata so your devices can find each other.</p>\n<ul>\n<li>Desktop remains the host</li>\n<li>Cloud account links identity and devices</li>\n<li>Mobile and web discover devices through the cloud layer</li>\n</ul>\n<h2 id=\"confirm-the-local-host-is-healthy\">Confirm the local host is healthy</h2>\n<p>After sign-in, confirm the WebUI can be opened locally and the device appears as active. If you plan to use remote access, make sure the remote status is provisioned or otherwise explicitly enabled for your environment.</p>\n<p>If a corporate environment blocks helper processes or networking tools, test on another machine before assuming the product model is wrong. The most common failures here are local policy, endpoint protection, or missing permissions.</p>"
      },
      "product-model": {
        "slug": "product-model",
        "eyebrow": "Product Model",
        "title": "Understand the ContextGo product model before you scale usage",
        "summary": "Clarify the relationship between desktop host, mobile shell, cloud account, WebUI, and the release repository before onboarding more devices or teammates.",
        "readingTime": "6 min",
        "updatedAt": "2026-03-30",
        "category": "guides",
        "html": "<h2 id=\"contextgo-is-not-just-a-chat-ui\">ContextGo is not just a chat UI</h2>\n<p>The product starts from context infrastructure, not from a standalone chat surface. Connectors, agents, hooks, scheduled tasks, and channel publishing all exist to keep context and execution close to the real workflow.</p>\n<p>That is why the documentation center cannot stop at install steps. Users also need a clear explanation of what runs where and how the feature surfaces relate to one another.</p>\n<h2 id=\"desktop-host-cloud-control-plane-mobile-client\">Desktop host, cloud control plane, mobile client</h2>\n<p>The desktop app remains the execution host. The cloud account links identity and devices. Mobile and browser clients operate as control surfaces that discover and connect back to those hosts.</p>\n<p>Release operations stay separate again: contextgo/contextgo-releases is the product-release source of truth for installable artifacts, checksums, and release history.</p>\n<ul>\n<li>Desktop owns execution</li>\n<li>Cloud owns identity and device discovery</li>\n<li>Release repository owns artifact truth</li>\n</ul>\n<h2 id=\"how-to-read-the-rest-of-the-docs\">How to read the rest of the docs</h2>\n<p>Read Guides first if you are onboarding. Read Features when you are configuring agents, hooks, scheduled tasks, or the skill market. Read Operations when you are enabling remote access, investigating device status, or preparing releases.</p>"
      },
      "agent-workspace": {
        "slug": "agent-workspace",
        "eyebrow": "Agent",
        "title": "Agent entry, assistants, and the working model inside ContextGo",
        "summary": "Understand what the agent entry is for, how assistant management differs from agent entry, and why those concepts should not be collapsed into one vague settings bucket.",
        "readingTime": "7 min",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"agent-entry-is-the-execution-facing-surface\">Agent entry is the execution-facing surface</h2>\n<p>The agent entry should be treated as the place where users pick or launch the active working mode. It is the operational surface for starting work, not just a catalog of saved assistant definitions.</p>\n<p>If the UI mixes agent entry, remote access, and assistant management under one ambiguous label, users cannot tell whether they are choosing a runtime, choosing a workflow, or editing a preset.</p>\n<h2 id=\"assistants-are-managed-definitions-not-the-whole-runtime-story\">Assistants are managed definitions, not the whole runtime story</h2>\n<p>Assistant management belongs to the configuration layer. It defines reusable presets, capabilities, instructions, or runtime associations. That is different from the main working surface where the user chooses how to execute the next task.</p>\n<p>This distinction matters even more when multiple runtimes are installed, because the runtime layer, the assistant layer, and the active execution surface should remain separate in the information architecture.</p>\n<ul>\n<li>Agent entry: start work</li>\n<li>Assistant management: configure reusable definitions</li>\n<li>Runtime management: install and repair execution backends</li>\n</ul>\n<h2 id=\"recommended-information-architecture\">Recommended information architecture</h2>\n<p>For users, the cleanest mental model is usually: work with agents from the main surface, manage assistants in configuration, and manage runtimes in a dedicated runtime area. This keeps product structure coherent as more providers and workflows are added.</p>"
      },
      "agent-collaboration": {
        "slug": "agent-collaboration",
        "eyebrow": "Collaboration",
        "title": "Harness mode and agent collaboration workflows",
        "summary": "Explain how local harness mode coexists with remote workflows, and why agent collaboration is a first-class working style rather than an implementation detail.",
        "readingTime": "7 min",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"harness-mode-is-a-real-product-workflow\">Harness mode is a real product workflow</h2>\n<p>Local harness mode should be kept as a supported collaboration model, not treated as a temporary development artifact. It gives users an immediate way to structure multi-agent work around the local machine they already trust.</p>\n<p>That is especially valuable for users who need an out-of-the-box collaboration pattern before they have a full remote orchestration or cloud-hosted workflow in place.</p>\n<h2 id=\"how-it-fits-with-remote-workflows\">How it fits with remote workflows</h2>\n<p>Remote workflow support does not replace harness mode. The right product story is coexistence: local harness mode for direct, device-local coordination, and remote workflow support for distributed or browser-mediated control paths.</p>\n<p>Once this is documented clearly, users stop reading the two modes as competing architectures. They become two ways to coordinate the same host-centric execution model.</p>\n<h2 id=\"what-users-need-to-know-operationally\">What users need to know operationally</h2>\n<p>Collaboration mode documentation should answer which machine executes work, where files live, how runtime availability is checked, and what remote clients can or cannot do compared with the local desktop host.</p>"
      },
      "hooks-overview": {
        "slug": "hooks-overview",
        "eyebrow": "Hooks",
        "title": "Use hooks to extend workflows at the right moment",
        "summary": "Hooks are the product mechanism for inserting controlled behavior around execution events. Users need a clear trigger model, not just a configuration form.",
        "readingTime": "6 min",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"what-a-hook-is-in-product-terms\">What a hook is in product terms</h2>\n<p>A hook is a controlled extension point in the workflow. It lets ContextGo run additional logic around a meaningful event instead of forcing users to manually repeat the same coordination step every time.</p>\n<p>This can include validation, formatting, notifications, routing, or post-processing, depending on what surfaces the product exposes.</p>\n<h2 id=\"document-triggers-before-implementation-details\">Document triggers before implementation details</h2>\n<p>Users first need to understand when a hook can run: before work starts, after output arrives, when a publish action happens, or when a task reaches a state transition. Without that model, hook configuration looks arbitrary.</p>\n<p>Once the trigger model is clear, the rest of the document can explain inputs, outputs, and safety boundaries.</p>\n<ul>\n<li>What event triggers the hook</li>\n<li>What context the hook receives</li>\n<li>What side effects the hook is allowed to produce</li>\n</ul>\n<h2 id=\"why-hooks-matter-for-contextgo\">Why hooks matter for ContextGo</h2>\n<p>Hooks are a bridge between context-aware work and repeatable automation. They make it possible to keep human review in the loop while still standardizing the repetitive parts of a workflow.</p>"
      },
      "scheduled-tasks": {
        "slug": "scheduled-tasks",
        "eyebrow": "Scheduled Tasks",
        "title": "Scheduled tasks and cron-driven automation",
        "summary": "Explain how periodic execution works, what kinds of automation belong in scheduled tasks, and what users should watch for in long-running operations.",
        "readingTime": "6 min",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"scheduled-tasks-are-recurring-workflows\">Scheduled tasks are recurring workflows</h2>\n<p>A scheduled task should be described as a recurring workflow with defined timing, execution context, and output behavior. The point is not just to fire a timer, but to repeatedly run a meaningful context-aware action.</p>\n<p>Examples include recurring sync, periodic review, automated publish preparation, or routine context extraction from connected systems.</p>\n<h2 id=\"document-execution-boundaries-clearly\">Document execution boundaries clearly</h2>\n<p>Users need to know what host executes the task, whether the machine must stay online, and which runtime or credentials the task depends on. Without that information, cron-like configuration becomes unreliable in real usage.</p>\n<p>Scheduled tasks should also document how failures are surfaced and whether a missed run is retried, skipped, or queued.</p>\n<h2 id=\"best-fit-use-cases\">Best-fit use cases</h2>\n<p>The strongest use cases are routine, repeatable operations that benefit from context but do not require a human to sit and click through the same sequence every day.</p>"
      },
      "skill-market": {
        "slug": "skill-market",
        "eyebrow": "Skill Market",
        "title": "Skill Market and reusable capability packages",
        "summary": "Show users how the skill market expands what ContextGo can do, how to think about local versus downloadable skills, and how installation should stay trustworthy.",
        "readingTime": "6 min",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"skills-extend-workflow-capability\">Skills extend workflow capability</h2>\n<p>The skill market is not just an add-on gallery. It is the mechanism that lets ContextGo adopt domain-specific workflows, instructions, or packaged capabilities without forcing every feature into the main product binary.</p>\n<p>That keeps the platform extensible while still presenting a coherent user experience.</p>\n<h2 id=\"installation-trust-matters\">Installation trust matters</h2>\n<p>Users need to understand whether a skill is built-in, local, or downloaded. They should also know whether a skill only adds prompts and instructions, or whether it brings code, scripts, or network-facing behavior with it.</p>\n<p>Good documentation makes it clear what is being installed, where it lives, and how to remove or update it safely.</p>\n<ul>\n<li>Built-in skill versus downloaded skill</li>\n<li>What files or behavior a skill introduces</li>\n<li>How updates and removals are handled</li>\n</ul>\n<h2 id=\"why-this-is-core-to-the-product\">Why this is core to the product</h2>\n<p>A strong skill market turns ContextGo from a fixed feature set into a product that can adapt to new domains without turning the main interface into a cluttered platform switchboard.</p>"
      },
      "runtime-management": {
        "slug": "runtime-management",
        "eyebrow": "Runtimes",
        "title": "Manage local runtimes and CLI health",
        "summary": "Install supported runtimes, repair broken CLI environments, and understand why a runtime can be installed but still not be usable yet.",
        "readingTime": "6 min",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"installed-is-not-the-same-as-ready\">Installed is not the same as ready</h2>\n<p>ContextGo can install or repair supported local runtimes, but a successful install only means the CLI exists on the machine. Some runtimes still need provider login or API configuration before they can actually run work.</p>\n<p>The product should continue to keep these states separate in the UI so users do not read a green install result as a guarantee that every runtime is fully authenticated and ready.</p>\n<h2 id=\"repair-flows-should-be-conservative\">Repair flows should be conservative</h2>\n<p>A repair action is meant to restore the expected CLI installation path, clear obviously broken local caches, and then re-run detection. It should not silently rewrite unrelated user tools or global configuration beyond the runtime it owns.</p>\n<p>If your team supports multiple runtimes, keep the runtime manager explicit about which providers are supported and which ones still need user action after installation.</p>\n<h2 id=\"recommended-operational-model\">Recommended operational model</h2>\n<p>Treat runtime installation as a product convenience layer on top of official vendor CLIs. This keeps ContextGo responsible for discovery, install orchestration, repair, and status display, while leaving provider authentication in the official path that users already trust.</p>"
      },
      "connectors-and-channels": {
        "slug": "connectors-and-channels",
        "eyebrow": "Connectors",
        "title": "Connectors, channels, and publishing paths",
        "summary": "Explain how sources and channels fit into ContextGo, and why connectors are part of the product core rather than optional integrations.",
        "readingTime": "6 min",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"connectors-are-the-intake-layer\">Connectors are the intake layer</h2>\n<p>Connectors are how ContextGo sees the real working context. Files, docs, drives, chats, and structured systems all enter through this layer before agents, hooks, or scheduled tasks can do useful work.</p>\n<p>That is why connector documentation should not read like a simple list of integrations. It should explain how connected sources become reusable context across multiple workflows.</p>\n<h2 id=\"channels-are-where-work-gets-routed-outward\">Channels are where work gets routed outward</h2>\n<p>Channels represent the outward side of the workflow: publishing, team communication, or delivery surfaces. In many cases, the same context that was ingested through connectors later exits through one or more channels.</p>\n<p>This makes connectors and channels two ends of the same product story: context comes in, gets shaped, and then moves to the place where action happens.</p>\n<h2 id=\"what-users-need-to-understand\">What users need to understand</h2>\n<p>Users should know which systems are supported, what level of access is needed, and how connected context feeds agents, scheduled tasks, remote sessions, or publication flows.</p>"
      },
      "remote-access": {
        "slug": "remote-access",
        "eyebrow": "Remote Access",
        "title": "How remote access works in ContextGo",
        "summary": "Understand the desktop-host model, why remote access depends on a stable device-side connection, and what users should expect on mobile.",
        "readingTime": "7 min",
        "updatedAt": "2026-03-30",
        "category": "operations",
        "html": "<h2 id=\"desktop-is-the-source-of-truth\">Desktop is the source of truth</h2>\n<p>ContextGo remote access is not a separate cloud-hosted copy of your app. The desktop machine keeps running the real workspace, tools, files, and WebUI session.</p>\n<p>Mobile and browser clients connect back to that desktop host through the remote layer. This is why a device can appear online, unavailable, or not provisioned depending on the state of the host and the remote bridge.</p>\n<h2 id=\"why-a-stable-device-side-connection-matters\">Why a stable device-side connection matters</h2>\n<p>A public remote page only works when the desktop host has an active outbound connection to the official cloud relay. The hosted experience depends on the device keeping that authenticated relay session alive.</p>\n<p>The underlying transport can evolve, but the product principle does not change: the device side still has to remain connected and authenticated before the remote page becomes usable.</p>\n<ul>\n<li>Desktop host publishes availability</li>\n<li>Cloud account maps devices to the signed-in user</li>\n<li>Remote page becomes useful only when the host is reachable</li>\n</ul>\n<h2 id=\"what-mobile-actually-runs\">What mobile actually runs</h2>\n<p>The mobile shell is a remote control surface. It reuses the existing WebUI and host-side workflows instead of replacing the desktop host with a separate mobile-native execution model.</p>\n<p>That means uploads, runtime execution, and local workspace access still terminate on the desktop side. Mobile acts as the control surface, not the primary compute environment.</p>"
      },
      "cloud-account": {
        "slug": "cloud-account",
        "eyebrow": "Cloud Account",
        "title": "What the ContextGo cloud account syncs",
        "summary": "Clarify what the cloud layer is for, what gets linked to the account, and why it should not be confused with full cloud execution.",
        "readingTime": "6 min",
        "updatedAt": "2026-03-30",
        "category": "operations",
        "html": "<h2 id=\"identity-not-full-migration\">Identity, not full migration</h2>\n<p>The cloud account exists to bind a user identity to one or more desktop devices and to support multi-device discovery. It is the control plane, not the execution plane.</p>\n<p>In practical terms, cloud sign-in helps ContextGo know which desktop devices belong to you, whether a browser session is valid, and whether a mobile or web client can enumerate the same device list.</p>\n<h2 id=\"what-can-sync-across-devices\">What can sync across devices</h2>\n<p>The current cloud layer is suited for lightweight state such as language preference, device registration, and remote capability metadata. It should not be described as syncing the entire desktop workspace.</p>\n<p>As the product matures, more lightweight preferences can move into the cloud account without changing the core principle that local execution stays on the desktop.</p>\n<ul>\n<li>Language preference</li>\n<li>Signed-in browser session state</li>\n<li>Device registration and remote capability state</li>\n</ul>\n<h2 id=\"what-does-not-automatically-move-to-the-cloud\">What does not automatically move to the cloud</h2>\n<p>Workspace files, local runtimes, active host processes, and host-side WebUI state still live on the desktop machine. If a user expects a full cloud-hosted clone of the desktop, the product positioning needs to be explicit that this is not the default model.</p>"
      },
      "updates-and-troubleshooting": {
        "slug": "updates-and-troubleshooting",
        "eyebrow": "Updates",
        "title": "Updates, releases, and common troubleshooting paths",
        "summary": "Document how in-app updates relate to the website download center and release repository, and give users a single operational troubleshooting entry point.",
        "readingTime": "7 min",
        "updatedAt": "2026-03-30",
        "category": "operations",
        "html": "<h2 id=\"one-version-source-should-serve-everything\">One version source should serve everything</h2>\n<p>Users should be able to trust that the desktop updater, the website download center, and the GitHub release page are describing the same version truth. That is the reason contextgo/contextgo-releases exists as a dedicated release repository.</p>\n<p>If the website says one thing and the in-app updater says another, the release pipeline is not coherent enough yet.</p>\n<h2 id=\"common-failure-categories\">Common failure categories</h2>\n<p>The troubleshooting entry should cover the real user-facing failures: browser login does not complete, remote status is unavailable, device binding does not refresh, update checks flash an error, or a runtime is installed but still unusable.</p>\n<p>This kind of page is especially important because users do not care which internal subsystem failed. They care about the operational symptom they can see.</p>\n<ul>\n<li>Login and browser-session failures</li>\n<li>Device status and remote availability failures</li>\n<li>Runtime detection and authentication failures</li>\n<li>Update and release-distribution failures</li>\n</ul>\n<h2 id=\"what-this-page-should-always-tell-the-user\">What this page should always tell the user</h2>\n<p>A good troubleshooting page tells the user what the symptom means, what the likely cause categories are, and what to check next in the least destructive order.</p>"
      }
    }
  },
  "zh": {
    "schemaVersion": 1,
    "version": "draft",
    "locale": "zh",
    "exportedAt": "1970-01-01T00:00:00.000Z",
    "docs": {
      "badge": "文档中心",
      "title": "ContextGo 文档",
      "description": "面向客户的产品文档，覆盖初始化、Agent、Hooks、定时任务、技能市场、远程访问和发布运维。",
      "featuredLabel": "文档结构",
      "featuredDescription": "ContextGo 文档分成三层：Guides 讲如何开始，Features 讲产品具体能力，Operations 讲远程访问、云身份和发布运维如何真正工作。",
      "categories": [
        {
          "id": "guides",
          "title": "Guides",
          "description": "先从这里理解产品模型、安装链路，以及第一次上手时应该怎么建立起可工作的环境。"
        },
        {
          "id": "features",
          "title": "Features",
          "description": "这一层说明用户真正会操作的能力面：Agents、Hooks、定时任务、Runtimes、Connectors 和技能市场。"
        },
        {
          "id": "operations",
          "title": "Operations",
          "description": "这一层说明云账号、远程访问、发布运维和排障路径。"
        }
      ],
      "entries": [
        {
          "slug": "quick-start",
          "eyebrow": "快速开始",
          "title": "在第一台桌面设备上完成 ContextGo 初始化",
          "summary": "安装桌面端、登录云账号、绑定当前设备，并确认本地主机已经为移动端和浏览器访问准备完成。",
          "readingTime": "5 分钟",
          "updatedAt": "2026-03-30",
          "category": "guides"
        },
        {
          "slug": "product-model",
          "eyebrow": "产品模型",
          "title": "先理解 ContextGo 的产品模型，再扩大使用范围",
          "summary": "先厘清桌面主机、移动壳、云账号、WebUI 和 release 仓库之间的关系，再去扩展更多设备和团队使用。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-03-30",
          "category": "guides"
        },
        {
          "slug": "agent-workspace",
          "eyebrow": "Agent",
          "title": "Agent 入口、Assistants 管理与工作模型",
          "summary": "理解 Agent 入口是干什么的、Assistants 管理和它有什么区别，以及为什么这些概念不应该混在一个模糊设置里。",
          "readingTime": "7 分钟",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "agent-collaboration",
          "eyebrow": "协作模式",
          "title": "Harness 模式与 Agent 协作工作流",
          "summary": "解释本地 harness 模式如何与远端 workflow 共存，以及为什么 Agent 协作模式是产品的一等工作方式。",
          "readingTime": "7 分钟",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "hooks-overview",
          "eyebrow": "Hooks",
          "title": "在合适的时机用 Hooks 扩展工作流",
          "summary": "Hooks 是在执行事件附近插入受控行为的机制。用户需要看到清晰的触发模型，而不是一个孤立配置表单。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "scheduled-tasks",
          "eyebrow": "定时任务",
          "title": "定时任务与 Cron 驱动自动化",
          "summary": "解释周期执行是如何工作的、哪些自动化适合放进定时任务，以及长时间运行场景下用户应该关注什么。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "skill-market",
          "eyebrow": "技能市场",
          "title": "技能市场与可复用能力包",
          "summary": "让用户理解技能市场如何扩展 ContextGo、如何看待本地 skill 与下载 skill，以及安装信任边界应该怎么讲。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "runtime-management",
          "eyebrow": "运行时",
          "title": "本地运行时与 CLI 健康管理",
          "summary": "安装支持的运行时、修复损坏的 CLI 环境，并理解为什么“已安装”并不等于“已可用”。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "connectors-and-channels",
          "eyebrow": "Connectors",
          "title": "Connectors、渠道与发布路径",
          "summary": "解释来源接入和渠道发布如何构成同一条产品链路，以及为什么 Connectors 不只是可选集成。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-03-30",
          "category": "features"
        },
        {
          "slug": "remote-access",
          "eyebrow": "远程访问",
          "title": "ContextGo 的远程访问到底是怎么工作的",
          "summary": "理解桌面主机模型、为什么远程访问依赖设备侧稳定连接，以及移动端应该向用户呈现什么预期。",
          "readingTime": "7 分钟",
          "updatedAt": "2026-03-30",
          "category": "operations"
        },
        {
          "slug": "cloud-account",
          "eyebrow": "云账号",
          "title": "ContextGo 云账号到底同步了什么",
          "summary": "澄清云层的职责、账号会绑定哪些状态，以及为什么它不应该被描述成完整的云执行环境。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-03-30",
          "category": "operations"
        },
        {
          "slug": "updates-and-troubleshooting",
          "eyebrow": "更新与排障",
          "title": "更新、版本发布与常见排障入口",
          "summary": "把桌面端内更新、官网下载页和 release 仓库之间的关系讲清楚，并给用户一个统一的运维排障入口。",
          "readingTime": "7 分钟",
          "updatedAt": "2026-03-30",
          "category": "operations"
        }
      ]
    },
    "articles": {
      "quick-start": {
        "slug": "quick-start",
        "eyebrow": "快速开始",
        "title": "在第一台桌面设备上完成 ContextGo 初始化",
        "summary": "安装桌面端、登录云账号、绑定当前设备，并确认本地主机已经为移动端和浏览器访问准备完成。",
        "readingTime": "5 分钟",
        "updatedAt": "2026-03-30",
        "category": "guides",
        "html": "<h2 id=\"先安装桌面主机\">先安装桌面主机</h2>\n<p>ContextGo 的起点是桌面端，因为桌面设备才是真正的执行主机。它持有本地工作区、WebUI 运行时和远程访问桥接能力。</p>\n<p>直链安装包应从 contextgo.io 下载中心进入。网站读取的是 contextgo/contextgo-releases 里的版本产物，因此下载页和桌面端内的更新链路应该指向同一份版本事实来源。</p>\n<h2 id=\"登录并绑定设备\">登录并绑定设备</h2>\n<p>通过桌面端里的云账号入口，使用 GitHub 或 Google 登录。浏览器流程完成后，ContextGo 会把当前桌面设备注册成云端账号下的一台设备。</p>\n<p>云账号并不是把执行搬到云端，而是把身份、设备注册和轻量同步状态绑定起来，让多台设备能够相互发现。</p>\n<ul>\n<li>桌面端仍然是执行主机</li>\n<li>云账号负责身份与设备绑定</li>\n<li>移动端和网页通过云层发现同一批设备</li>\n</ul>\n<h2 id=\"确认本地主机状态正常\">确认本地主机状态正常</h2>\n<p>登录之后，先确认 WebUI 能在本地打开，设备状态显示为 active。如果你要用远程访问，再继续确认 remote 状态已经 provisioned，或者至少在你的环境中被显式启用。</p>\n<p>如果企业环境会拦截辅助进程或网络工具，先换设备验证，不要第一时间怀疑产品模型本身。这里最常见的问题仍然是本地安全策略、终端防护或缺少权限。</p>"
      },
      "product-model": {
        "slug": "product-model",
        "eyebrow": "产品模型",
        "title": "先理解 ContextGo 的产品模型，再扩大使用范围",
        "summary": "先厘清桌面主机、移动壳、云账号、WebUI 和 release 仓库之间的关系，再去扩展更多设备和团队使用。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-03-30",
        "category": "guides",
        "html": "<h2 id=\"contextgo-不只是一个聊天界面\">ContextGo 不只是一个聊天界面</h2>\n<p>这个产品的起点是上下文基础设施，而不是一个孤立聊天框。Connectors、Agent、Hooks、定时任务和渠道发布，都是为了让上下文和执行继续贴近真实工作流。</p>\n<p>因此文档中心不能只停留在安装步骤，也必须把“功能是怎么互相配合的”讲清楚。</p>\n<h2 id=\"桌面主机云控制平面移动客户端\">桌面主机、云控制平面、移动客户端</h2>\n<p>桌面端仍然是执行主机。云账号负责身份与设备发现。移动端和浏览器端是控制面，用来发现并连接这些主机。</p>\n<p>版本运维又是另一条线：contextgo/contextgo-releases 是安装包、校验值和版本历史的事实来源。</p>\n<ul>\n<li>桌面端负责执行</li>\n<li>云端负责身份与设备发现</li>\n<li>release 仓库负责产物事实来源</li>\n</ul>\n<h2 id=\"后面的文档怎么读\">后面的文档怎么读</h2>\n<p>如果你是第一次上手，先读 Guides。如果你要配置 Agent、Hooks、定时任务或技能市场，读 Features。如果你在做远程访问、设备排查或发版运维，读 Operations。</p>"
      },
      "agent-workspace": {
        "slug": "agent-workspace",
        "eyebrow": "Agent",
        "title": "Agent 入口、Assistants 管理与工作模型",
        "summary": "理解 Agent 入口是干什么的、Assistants 管理和它有什么区别，以及为什么这些概念不应该混在一个模糊设置里。",
        "readingTime": "7 分钟",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"agent-入口是面向执行的工作面\">Agent 入口是面向执行的工作面</h2>\n<p>Agent 入口应该被视为用户选择或启动当前工作模式的地方。它是执行面，不应该只是一个保存配置的列表页。</p>\n<p>如果界面把 Agent 入口、远程访问和 Assistants 管理全部混在一起，用户就很难分辨自己现在是在选工作方式、选 Runtime，还是在改预设。</p>\n<h2 id=\"assistants-是配置层不是全部工作面\">Assistants 是配置层，不是全部工作面</h2>\n<p>Assistants 管理属于配置层，负责保存可复用的定义、能力、指令或 Runtime 绑定。它和真正开始执行工作的主界面是不同层次。</p>\n<p>特别是在支持多个 Runtime 之后，这个区分会更加重要，因为 Runtime 层、Assistant 层和当前执行层必须保持分离。</p>\n<ul>\n<li>Agent 入口：开始工作</li>\n<li>Assistants 管理：维护可复用定义</li>\n<li>Runtime 管理：安装与修复执行后端</li>\n</ul>\n<h2 id=\"推荐的信息架构\">推荐的信息架构</h2>\n<p>对用户来说，最清晰的模型通常是：在主工作面里使用 Agent，在配置区管理 Assistants，在独立 Runtime 区管理底层执行后端。这样随着 provider 和工作流增多，信息架构才不会变形。</p>"
      },
      "agent-collaboration": {
        "slug": "agent-collaboration",
        "eyebrow": "协作模式",
        "title": "Harness 模式与 Agent 协作工作流",
        "summary": "解释本地 harness 模式如何与远端 workflow 共存，以及为什么 Agent 协作模式是产品的一等工作方式。",
        "readingTime": "7 分钟",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"harness-模式是一种真实的产品工作流\">Harness 模式是一种真实的产品工作流</h2>\n<p>本地 harness 模式不应该被当成临时开发技巧，而应该被保留成受支持的协作模型。它让用户在自己已经信任的本机环境里，快速进入多 Agent 协作。</p>\n<p>这对还没有完整远端编排环境的用户尤其重要，因为它提供了一种开箱即用的协作实践。</p>\n<h2 id=\"它如何和远端-workflow-共存\">它如何和远端 workflow 共存</h2>\n<p>远端 workflow 并不是用来替代 harness 模式的。正确的产品叙事是兼容共存：本地 harness 负责设备内直接协作，远端 workflow 负责分布式或浏览器侧控制链路。</p>\n<p>一旦文档把这点说清楚，用户就不会把两者误读成冲突的技术路线，而会理解成同一套主机模型上的两种协作方式。</p>\n<h2 id=\"用户最需要知道什么\">用户最需要知道什么</h2>\n<p>协作模式文档必须回答：哪台机器在执行、文件在哪里、Runtime 怎么检测、远端客户端相对本地主机有哪些能力边界。</p>"
      },
      "hooks-overview": {
        "slug": "hooks-overview",
        "eyebrow": "Hooks",
        "title": "在合适的时机用 Hooks 扩展工作流",
        "summary": "Hooks 是在执行事件附近插入受控行为的机制。用户需要看到清晰的触发模型，而不是一个孤立配置表单。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"从产品角度看-hook-是什么\">从产品角度看 Hook 是什么</h2>\n<p>Hook 是工作流中的一个受控扩展点。它让 ContextGo 能在关键事件附近自动执行额外逻辑，而不是让用户每次重复做同样的协调动作。</p>\n<p>它可以承担校验、格式整理、通知、路由或后处理，具体取决于产品暴露了哪些触发点。</p>\n<h2 id=\"先讲触发模型再讲实现细节\">先讲触发模型，再讲实现细节</h2>\n<p>用户首先需要知道 Hook 会在什么时候运行，例如开始前、输出后、发布动作发生时，或任务状态切换时。没有这个模型，Hook 配置就会显得很随机。</p>\n<p>触发模型清楚之后，再去解释输入、输出和安全边界，用户才容易真正理解。</p>\n<ul>\n<li>什么事件会触发 Hook</li>\n<li>Hook 会收到哪些上下文</li>\n<li>Hook 被允许产生什么副作用</li>\n</ul>\n<h2 id=\"为什么它对-contextgo-很重要\">为什么它对 ContextGo 很重要</h2>\n<p>Hooks 把上下文工作和可重复自动化连接起来，让产品既能保留人工审阅，又能把重复步骤标准化。</p>"
      },
      "scheduled-tasks": {
        "slug": "scheduled-tasks",
        "eyebrow": "定时任务",
        "title": "定时任务与 Cron 驱动自动化",
        "summary": "解释周期执行是如何工作的、哪些自动化适合放进定时任务，以及长时间运行场景下用户应该关注什么。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"定时任务是周期性工作流\">定时任务是周期性工作流</h2>\n<p>定时任务应该被描述成有固定时间、执行上下文和输出行为的周期性工作流，而不只是“触发一个定时器”。</p>\n<p>典型场景包括周期同步、定期审阅、自动生成发布准备内容，或者从已接入系统里按节奏抽取上下文。</p>\n<h2 id=\"执行边界必须说明白\">执行边界必须说明白</h2>\n<p>用户需要知道是哪台主机在执行任务、机器是否必须在线，以及它依赖哪套 Runtime 或凭证。没有这些说明，Cron 配置在真实环境里很容易变得不可靠。</p>\n<p>定时任务还需要说明失败如何呈现，以及漏跑之后是重试、跳过，还是排队等待下一次机会。</p>\n<h2 id=\"最适合的使用方式\">最适合的使用方式</h2>\n<p>它最适合那些规律性强、可重复、需要上下文但不需要人每天手工点一遍的工作。</p>"
      },
      "skill-market": {
        "slug": "skill-market",
        "eyebrow": "技能市场",
        "title": "技能市场与可复用能力包",
        "summary": "让用户理解技能市场如何扩展 ContextGo、如何看待本地 skill 与下载 skill，以及安装信任边界应该怎么讲。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"skill-在产品里承担什么角色\">Skill 在产品里承担什么角色</h2>\n<p>技能市场不只是一个附加组件列表，而是让 ContextGo 在不把所有能力都塞进主二进制的情况下，继续吸收领域化工作流和能力包的机制。</p>\n<p>这让平台保持可扩展，同时还能保留统一体验。</p>\n<h2 id=\"安装信任边界很重要\">安装信任边界很重要</h2>\n<p>用户需要知道当前 skill 是内置的、本地的，还是下载的；也需要知道它只是补充提示词和说明，还是会带来脚本、代码或联网行为。</p>\n<p>好的文档应该把“安装了什么、它放在哪里、如何更新和移除”讲清楚。</p>\n<ul>\n<li>内置 skill 与下载 skill 的区别</li>\n<li>skill 会引入哪些文件或行为</li>\n<li>如何更新和卸载</li>\n</ul>\n<h2 id=\"为什么这是核心能力\">为什么这是核心能力</h2>\n<p>一个好的技能市场会让 ContextGo 从固定功能集合变成可持续适配新领域的平台，而不是把主界面堆成一个杂乱开关板。</p>"
      },
      "runtime-management": {
        "slug": "runtime-management",
        "eyebrow": "运行时",
        "title": "本地运行时与 CLI 健康管理",
        "summary": "安装支持的运行时、修复损坏的 CLI 环境，并理解为什么“已安装”并不等于“已可用”。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"安装成功不等于立即可用\">安装成功不等于立即可用</h2>\n<p>ContextGo 可以帮助用户安装或修复本地运行时，但安装成功只代表 CLI 已经在机器上存在。有些 runtime 仍然需要用户完成官方登录或 API 配置，才能真正开始工作。</p>\n<p>产品界面应该继续把这两类状态分开显示，避免用户把“安装完成”误读成“已经完成认证并可立即运行”。</p>\n<h2 id=\"修复动作应该足够克制\">修复动作应该足够克制</h2>\n<p>修复的目标应该是恢复受支持 CLI 的安装路径、清理明显损坏的本地缓存，并重新执行检测。它不应该静默篡改用户无关的全局工具链或其他配置。</p>\n<p>如果产品支持多种 runtime，就应该明确告诉用户哪些 provider 已接入自动安装，哪些 provider 仍然需要额外手工动作。</p>\n<h2 id=\"推荐的运维模型\">推荐的运维模型</h2>\n<p>把 runtime 安装层视为官方 CLI 之上的产品便利能力。这样 ContextGo 负责发现、安装编排、修复和状态展示，而 provider 认证仍然走用户已经熟悉的官方路径。</p>"
      },
      "connectors-and-channels": {
        "slug": "connectors-and-channels",
        "eyebrow": "Connectors",
        "title": "Connectors、渠道与发布路径",
        "summary": "解释来源接入和渠道发布如何构成同一条产品链路，以及为什么 Connectors 不只是可选集成。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-03-30",
        "category": "features",
        "html": "<h2 id=\"connectors-是输入层\">Connectors 是输入层</h2>\n<p>Connectors 是 ContextGo 看到真实工作上下文的入口。文件、文档、云盘、聊天和结构化系统，都先通过这一层进入，后面的 Agent、Hooks 和定时任务才能真正有用。</p>\n<p>所以 connector 文档不应该只是“支持了哪些集成”的列表，而应该解释接入后的上下文会如何被复用。</p>\n<h2 id=\"渠道是输出层\">渠道是输出层</h2>\n<p>渠道代表上下文流出去的方向，例如发布、团队沟通或投递面。很多时候，前面接入的上下文，最终会通过一个或多个渠道继续流向下一步工作。</p>\n<p>这让 Connectors 和渠道形成同一条产品叙事：上下文先接进来，再被整理，再流向行动发生的地方。</p>\n<h2 id=\"用户最需要知道什么\">用户最需要知道什么</h2>\n<p>用户应该知道支持哪些系统、接入需要什么权限，以及接入后的上下文如何流向 Agent、定时任务、远程会话或发布流程。</p>"
      },
      "remote-access": {
        "slug": "remote-access",
        "eyebrow": "远程访问",
        "title": "ContextGo 的远程访问到底是怎么工作的",
        "summary": "理解桌面主机模型、为什么远程访问依赖设备侧稳定连接，以及移动端应该向用户呈现什么预期。",
        "readingTime": "7 分钟",
        "updatedAt": "2026-03-30",
        "category": "operations",
        "html": "<h2 id=\"桌面端才是事实主机\">桌面端才是事实主机</h2>\n<p>ContextGo 的远程访问不是在云端重新起一份应用副本。真正的工作区、工具、文件和 WebUI 会话仍然运行在桌面设备上。</p>\n<p>移动端和浏览器端只是通过远程层连接回桌面主机。所以设备才会出现 online、unavailable 或 not provisioned 这类状态，取决于主机和远程桥接的健康度。</p>\n<h2 id=\"为什么设备侧稳定连接很重要\">为什么设备侧稳定连接很重要</h2>\n<p>公开 remote 入口只有在桌面主机对官方 cloud relay 建立稳定的出站连接之后才有意义。官方云层负责登录、设备发现和中继控制；浏览器真正进入的仍应是桌面端自己暴露的 WebUI。</p>\n<p>底层传输可以继续演进，但产品原则不会变。无论实现细节如何，设备侧都必须持续在线并完成认证，remote 页面才真正可用。</p>\n<ul>\n<li>桌面主机负责发布可用性</li>\n<li>云账号负责把设备映射到用户</li>\n<li>只有主机可达时，remote 页面才真正可用</li>\n</ul>\n<h2 id=\"移动端真正运行的是什么\">移动端真正运行的是什么</h2>\n<p>移动壳的定位是远程控制面。它复用现有 WebUI 和主机侧流程，而不是把桌面执行模型替换成一套新的手机本地执行模型。</p>\n<p>这意味着上传、运行时执行和本地工作区访问，最终还是落在桌面端。移动端是使用面，不是主计算面。</p>"
      },
      "cloud-account": {
        "slug": "cloud-account",
        "eyebrow": "云账号",
        "title": "ContextGo 云账号到底同步了什么",
        "summary": "澄清云层的职责、账号会绑定哪些状态，以及为什么它不应该被描述成完整的云执行环境。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-03-30",
        "category": "operations",
        "html": "<h2 id=\"绑定身份不是整体迁云\">绑定身份，不是整体迁云</h2>\n<p>云账号的职责是把一个用户身份和一台或多台桌面设备绑定起来，并支持多端发现。这是控制平面，不是执行平面。</p>\n<p>落到产品上，云登录让 ContextGo 能知道哪些桌面设备属于你、浏览器会话是否还有效，以及移动端或网页是否应该展示同一份设备列表。</p>\n<h2 id=\"什么状态适合跨设备同步\">什么状态适合跨设备同步</h2>\n<p>当前云层更适合承载轻量状态，例如语言偏好、设备注册和远程能力元数据。不应该把它表述成“完整同步整台桌面工作区”。</p>\n<p>随着产品演进，可以继续把更多轻量偏好放进云账号，但不应该改变“执行仍留在桌面端”的核心原则。</p>\n<ul>\n<li>语言偏好</li>\n<li>浏览器登录会话状态</li>\n<li>设备注册与远程能力状态</li>\n</ul>\n<h2 id=\"什么不会自动上云\">什么不会自动上云</h2>\n<p>工作区文件、本地 runtime、主机进程和主机侧 WebUI 状态，默认仍然留在桌面设备上。如果用户期待的是一份完整托管在云端的桌面副本，产品表述必须明确这不是默认模型。</p>"
      },
      "updates-and-troubleshooting": {
        "slug": "updates-and-troubleshooting",
        "eyebrow": "更新与排障",
        "title": "更新、版本发布与常见排障入口",
        "summary": "把桌面端内更新、官网下载页和 release 仓库之间的关系讲清楚，并给用户一个统一的运维排障入口。",
        "readingTime": "7 分钟",
        "updatedAt": "2026-03-30",
        "category": "operations",
        "html": "<h2 id=\"一份版本来源服务所有更新入口\">一份版本来源，服务所有更新入口</h2>\n<p>用户应该能够相信桌面端更新、官网下载页和 GitHub 版本页说的是同一件事。这就是 contextgo/contextgo-releases 存在的原因，它是安装产物的事实来源。</p>\n<p>如果官网显示一套版本、桌面端里又显示另一套，就说明发布链路还没有真正收口。</p>\n<h2 id=\"最常见的故障类别\">最常见的故障类别</h2>\n<p>这个排障入口应该覆盖用户真正能感知到的问题：浏览器登录没完成、remote 状态 unavailable、设备绑定没刷新、更新检查中途闪失败，或者 Runtime 已安装但仍不可用。</p>\n<p>用户并不关心内部到底是哪一个子系统报错，他们只关心眼前的运维症状。</p>\n<ul>\n<li>登录和浏览器会话问题</li>\n<li>设备状态与远程访问问题</li>\n<li>Runtime 检测与认证问题</li>\n<li>更新与版本分发问题</li>\n</ul>\n<h2 id=\"这类页面必须提供什么\">这类页面必须提供什么</h2>\n<p>好的排障文档必须告诉用户：这个现象意味着什么、最可能的原因类别有哪些、下一步应该按什么最不具破坏性的顺序检查。</p>"
      }
    }
  }
};
