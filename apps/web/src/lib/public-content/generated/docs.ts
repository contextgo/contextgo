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
      "description": "Official product documentation for installation, agent workflows, automation, remote access, and release operations.",
      "featuredLabel": "Documentation layout",
      "featuredDescription": "Use Guides for initial setup, Features for day-to-day product capabilities, and Operations for account, remote access, updates, and troubleshooting.",
      "categories": [
        {
          "id": "guides",
          "title": "Guides",
          "description": "Read these pages before first use. They cover installation, account sign-in, device registration, and the basic product model."
        },
        {
          "id": "features",
          "title": "Features",
          "description": "These pages document the working surfaces in the product, including agents, hooks, scheduled tasks, runtimes, connectors, and skills."
        },
        {
          "id": "operations",
          "title": "Operations",
          "description": "These pages cover cloud account behavior, remote access, software updates, release sources, and common troubleshooting steps."
        }
      ],
      "entries": [
        {
          "slug": "quick-start",
          "eyebrow": "Quick Start",
          "title": "Set up ContextGo on your first desktop",
          "summary": "Install the desktop app, sign in, register the current device, and confirm that the local host is ready for browser or mobile access.",
          "readingTime": "5 min",
          "updatedAt": "2026-04-12",
          "category": "guides"
        },
        {
          "slug": "product-model",
          "eyebrow": "Product Model",
          "title": "Understand the ContextGo product model before you scale usage",
          "summary": "Review the role of the desktop host, cloud account, browser and mobile access, and the release repository before onboarding more devices or teammates.",
          "readingTime": "6 min",
          "updatedAt": "2026-04-12",
          "category": "guides"
        },
        {
          "slug": "agent-workspace",
          "eyebrow": "Agent",
          "title": "Work with agents, assistants, and runtimes",
          "summary": "Use the agent surface to start work, manage assistants as reusable definitions, and keep runtime management separate from task entry.",
          "readingTime": "7 min",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "agent-collaboration",
          "eyebrow": "Collaboration",
          "title": "Use harness mode and remote agent collaboration",
          "summary": "Understand when work stays on the local desktop, when remote clients can participate, and what to verify before starting a collaborative session.",
          "readingTime": "7 min",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "hooks-overview",
          "eyebrow": "Hooks",
          "title": "Configure hooks for workflow events",
          "summary": "Define when a hook runs, what context it receives, and how to roll out hook behavior without disrupting the main task flow.",
          "readingTime": "6 min",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "scheduled-tasks",
          "eyebrow": "Scheduled Tasks",
          "title": "Run scheduled tasks on a desktop host",
          "summary": "Configure recurring workflows, confirm host and runtime requirements, and review failures before relying on unattended execution.",
          "readingTime": "6 min",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "skill-market",
          "eyebrow": "Skill Market",
          "title": "Install and manage skills",
          "summary": "Review the source of each skill, understand what it adds to the product, and keep installation, updates, and removal predictable.",
          "readingTime": "6 min",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "runtime-management",
          "eyebrow": "Runtimes",
          "title": "Manage local runtimes and CLI status",
          "summary": "Install supported runtimes, repair broken CLI environments, and distinguish between installed, authenticated, and ready states.",
          "readingTime": "6 min",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "connectors-and-channels",
          "eyebrow": "Connectors",
          "title": "Use connectors and channels",
          "summary": "Connect external sources to the desktop host, route outputs to delivery channels, and document the access requirements for each integration.",
          "readingTime": "6 min",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "remote-access",
          "eyebrow": "Remote Access",
          "title": "Use remote access from the browser or mobile",
          "summary": "Confirm host availability, understand the device-to-cloud connection, and know what the remote client can and cannot do without the desktop host.",
          "readingTime": "7 min",
          "updatedAt": "2026-04-12",
          "category": "operations"
        },
        {
          "slug": "cloud-account",
          "eyebrow": "Cloud Account",
          "title": "Manage cloud account and device binding",
          "summary": "Use the cloud account for sign-in, device registration, and lightweight account-linked state without treating it as a full cloud execution environment.",
          "readingTime": "6 min",
          "updatedAt": "2026-04-12",
          "category": "operations"
        },
        {
          "slug": "updates-and-troubleshooting",
          "eyebrow": "Updates",
          "title": "Check updates and troubleshoot common failures",
          "summary": "Keep the website, the in-app updater, and the release repository aligned, then diagnose login, device, runtime, and update problems from one place.",
          "readingTime": "7 min",
          "updatedAt": "2026-04-12",
          "category": "operations"
        }
      ]
    },
    "articles": {
      "quick-start": {
        "slug": "quick-start",
        "eyebrow": "Quick Start",
        "title": "Set up ContextGo on your first desktop",
        "summary": "Install the desktop app, sign in, register the current device, and confirm that the local host is ready for browser or mobile access.",
        "readingTime": "5 min",
        "updatedAt": "2026-04-12",
        "category": "guides",
        "html": "<h2 id=\"before-you-begin\">Before you begin</h2>\n<p>ContextGo runs on a desktop host. Install and complete setup on the desktop app first. Browser and mobile access connect back to that host later.</p>\n<p>Before starting setup, confirm the following:</p>\n<ul>\n<li>You can install software on the current desktop.</li>\n<li>The desktop can open a browser window for sign-in.</li>\n<li>The network allows ContextGo to reach its account and update services.</li>\n</ul>\n<h2 id=\"1-install-the-desktop-app\">1. Install the desktop app</h2>\n<p>Open the download page on <code>contextgo.io</code> and install the desktop build for your platform. The website download page and the in-app updater both read release artifacts from <code>contextgo/contextgo-releases</code>.</p>\n<p>After installation, launch the app and allow the initial local services to start. On first run, ContextGo prepares the local workspace, the WebUI runtime, and the device-side components used for remote access.</p>\n<h2 id=\"2-sign-in-to-a-cloud-account\">2. Sign in to a cloud account</h2>\n<p>Use the cloud account entry in the desktop app to sign in with GitHub or Google. When the browser flow completes, the current desktop is registered to your account.</p>\n<p>The cloud account is used for identity, device registration, and lightweight account state. It does not move your workspace or runtime execution into the cloud.</p>\n<h2 id=\"3-verify-the-current-desktop\">3. Verify the current desktop</h2>\n<p>After sign-in, confirm the following in the desktop app:</p>\n<ul>\n<li>The current device appears in the signed-in account.</li>\n<li>Local WebUI opens successfully.</li>\n<li>Device status is shown as available or active.</li>\n</ul>\n<p>If you plan to use browser or mobile access, also confirm that remote access is enabled for the current device.</p>\n<h2 id=\"4-test-remote-access-if-needed\">4. Test remote access if needed</h2>\n<p>If remote access is part of your workflow, open the hosted web entry after the desktop host is online. The remote page only works when the registered desktop keeps its outbound connection available.</p>\n<p>On mobile, use the remote session as a control surface for the desktop host. Files, runtimes, and local tools still run on the desktop.</p>\n<h2 id=\"if-setup-does-not-complete\">If setup does not complete</h2>\n<p>Check the following in order:</p>\n<ol>\n<li>Confirm the desktop app can open the browser sign-in page.</li>\n<li>Confirm the account flow returns to ContextGo without an error.</li>\n<li>Confirm endpoint security or corporate policy is not blocking helper processes or network access.</li>\n<li>Retry the setup on a different machine if the current environment is heavily managed.</li>\n</ol>"
      },
      "product-model": {
        "slug": "product-model",
        "eyebrow": "Product Model",
        "title": "Understand the ContextGo product model before you scale usage",
        "summary": "Review the role of the desktop host, cloud account, browser and mobile access, and the release repository before onboarding more devices or teammates.",
        "readingTime": "6 min",
        "updatedAt": "2026-04-12",
        "category": "guides",
        "html": "<h2 id=\"core-components\">Core components</h2>\n<p>ContextGo is organized around four product components:</p>\n<ul>\n<li>Desktop host: the main execution environment for files, local tools, runtimes, and WebUI.</li>\n<li>Cloud account: the identity layer for sign-in, device registration, and account-linked discovery.</li>\n<li>Browser or mobile client: the remote control surface used to connect back to the desktop host.</li>\n<li>Release repository: the source for public installers, release notes, and downloadable artifacts.</li>\n</ul>\n<h2 id=\"what-runs-where\">What runs where</h2>\n<p>The desktop app remains the primary host. When you start a task, install a runtime, access local files, or use connectors tied to the machine, that work happens on the desktop.</p>\n<p>The cloud account does not replace the desktop host. It is used to identify the user, register devices, and make those devices available to browser or mobile clients.</p>\n<p>The browser and mobile clients are remote entry points. They are intended for controlling the host and viewing results, not for replacing the host with a separate cloud runtime.</p>\n<h2 id=\"release-source\">Release source</h2>\n<p>Public release assets are published from <code>contextgo/contextgo-releases</code>. The website download page and in-app update flow should reference the same release source.</p>\n<p>When checking a version mismatch, compare the website version, the in-app update version, and the latest published release in that repository.</p>\n<h2 id=\"recommended-reading-order\">Recommended reading order</h2>\n<p>Use the documentation in this order:</p>\n<ol>\n<li>Read <code>Quick Start</code> to complete first-device setup.</li>\n<li>Read <code>Features</code> pages when configuring agents, hooks, scheduled tasks, runtimes, connectors, or skills.</li>\n<li>Read <code>Operations</code> pages when managing account state, remote access, updates, or troubleshooting.</li>\n</ol>"
      },
      "agent-workspace": {
        "slug": "agent-workspace",
        "eyebrow": "Agent",
        "title": "Work with agents, assistants, and runtimes",
        "summary": "Use the agent surface to start work, manage assistants as reusable definitions, and keep runtime management separate from task entry.",
        "readingTime": "7 min",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"agent-surface\">Agent surface</h2>\n<p>Use the agent surface to start a task, choose a working mode, and select the active assistant for the current session. This is the main execution-facing page for day-to-day work.</p>\n<p>The agent surface should answer three questions clearly:</p>\n<ul>\n<li>Which assistant is active for this task</li>\n<li>Which runtime will execute the task</li>\n<li>Whether the current environment is ready to run</li>\n</ul>\n<h2 id=\"assistants\">Assistants</h2>\n<p>Assistants are reusable definitions. An assistant can include instructions, capabilities, preferred tools, and runtime associations. Use assistant management when you want to create, update, or remove these saved definitions.</p>\n<p>Changing an assistant should not change the runtime inventory on the machine. Assistant management is configuration work, not runtime administration.</p>\n<h2 id=\"runtimes\">Runtimes</h2>\n<p>Runtime management is a separate administrative area. Use it to install, repair, detect, or verify supported CLIs.</p>\n<p>If a runtime is installed but still requires provider login or API configuration, keep that state visible to the user. Installed does not always mean ready.</p>\n<h2 id=\"recommended-workflow\">Recommended workflow</h2>\n<p>Use this order when preparing a new machine:</p>\n<ol>\n<li>Confirm a supported runtime is installed and ready.</li>\n<li>Create or select an assistant definition.</li>\n<li>Open the agent surface and start work with that assistant.</li>\n</ol>"
      },
      "agent-collaboration": {
        "slug": "agent-collaboration",
        "eyebrow": "Collaboration",
        "title": "Use harness mode and remote agent collaboration",
        "summary": "Understand when work stays on the local desktop, when remote clients can participate, and what to verify before starting a collaborative session.",
        "readingTime": "7 min",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"local-collaboration\">Local collaboration</h2>\n<p>Harness mode is the local collaboration model. Use it when the desktop host is the main workspace and you want multiple agent roles or coordinated task flows on that machine.</p>\n<p>This mode is useful when local files, local tools, or installed runtimes are required for the task.</p>\n<h2 id=\"remote-collaboration\">Remote collaboration</h2>\n<p>Remote access extends the same host-based model. A browser or mobile client can connect to the desktop host, review status, and continue work without moving the workspace off the device.</p>\n<p>Remote collaboration depends on the host remaining online and authenticated. If the host is unavailable, the remote client cannot continue the session independently.</p>\n<h2 id=\"what-to-verify-before-starting\">What to verify before starting</h2>\n<p>Before starting a collaborative workflow, confirm the following:</p>\n<ul>\n<li>The desktop host has the required files and runtimes.</li>\n<li>Any assistants used by the workflow are already configured.</li>\n<li>Remote access is enabled if browser or mobile clients will participate.</li>\n</ul>\n<h2 id=\"operational-limits\">Operational limits</h2>\n<p>Keep these boundaries in mind:</p>\n<ul>\n<li>Task execution still happens on the desktop host.</li>\n<li>Files remain in the host workspace unless you move them explicitly.</li>\n<li>Runtime failures on the host affect both local and remote sessions.</li>\n</ul>"
      },
      "hooks-overview": {
        "slug": "hooks-overview",
        "eyebrow": "Hooks",
        "title": "Configure hooks for workflow events",
        "summary": "Define when a hook runs, what context it receives, and how to roll out hook behavior without disrupting the main task flow.",
        "readingTime": "6 min",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"what-a-hook-does\">What a hook does</h2>\n<p>A hook runs additional logic when a defined workflow event occurs. Common uses include validation, formatting, routing, notification, and post-processing.</p>\n<p>Use hooks when the same follow-up step needs to happen consistently around a task or publish action.</p>\n<h2 id=\"trigger-points\">Trigger points</h2>\n<p>Document the trigger point before configuring a hook. A hook should make it clear whether it runs:</p>\n<ul>\n<li>before a task starts</li>\n<li>after output is produced</li>\n<li>when a publish action is requested</li>\n<li>when a task changes state</li>\n</ul>\n<h2 id=\"hook-inputs-and-outputs\">Hook inputs and outputs</h2>\n<p>For each hook, record the following:</p>\n<ul>\n<li>The event that triggers it</li>\n<li>The context it can read</li>\n<li>The side effects it is allowed to produce</li>\n<li>The failure behavior when the hook does not complete</li>\n</ul>\n<h2 id=\"rollout-guidance\">Rollout guidance</h2>\n<p>Start with hooks that are easy to verify and easy to disable. Review logs or outputs after each change. For production workflows, avoid large hook chains until each step has been tested independently.</p>"
      },
      "scheduled-tasks": {
        "slug": "scheduled-tasks",
        "eyebrow": "Scheduled Tasks",
        "title": "Run scheduled tasks on a desktop host",
        "summary": "Configure recurring workflows, confirm host and runtime requirements, and review failures before relying on unattended execution.",
        "readingTime": "6 min",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"what-a-scheduled-task-is\">What a scheduled task is</h2>\n<p>A scheduled task runs a saved workflow on a recurring schedule. Use it for routine operations such as sync jobs, periodic reviews, report generation, or repeatable publish preparation.</p>\n<p>Each task should define its schedule, required runtime, expected inputs, and expected outputs.</p>\n<h2 id=\"host-requirements\">Host requirements</h2>\n<p>Scheduled tasks run on the desktop host. Before enabling a recurring task, confirm the following:</p>\n<ul>\n<li>The host remains powered on when the task is due.</li>\n<li>The required runtime is installed and authenticated.</li>\n<li>The task has access to the files, connectors, or credentials it needs.</li>\n</ul>\n<p>If the host is offline, the scheduled task cannot complete at the expected time.</p>\n<h2 id=\"failure-handling\">Failure handling</h2>\n<p>Document how the task behaves when a run is missed or fails. At minimum, users should know whether the next run is skipped, retried, or executed at the next scheduled time only.</p>\n<h2 id=\"recommended-use\">Recommended use</h2>\n<p>Use scheduled tasks for repeatable work with stable inputs. Avoid using them for workflows that require frequent manual approval unless the approval step is clearly separated from the scheduled run.</p>"
      },
      "skill-market": {
        "slug": "skill-market",
        "eyebrow": "Skill Market",
        "title": "Install and manage skills",
        "summary": "Review the source of each skill, understand what it adds to the product, and keep installation, updates, and removal predictable.",
        "readingTime": "6 min",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"skill-sources\">Skill sources</h2>\n<p>Skills can be built in, stored locally, or downloaded from a published source. Before installation, the product should show which type you are installing.</p>\n<p>Use that source label to decide whether the skill can be trusted in the current environment.</p>\n<h2 id=\"what-a-skill-can-add\">What a skill can add</h2>\n<p>A skill can add prompts, instructions, configuration, scripts, or other packaged behavior. The install screen should make it clear what files are added and whether any executable content is included.</p>\n<p>Before enabling a downloaded skill, review:</p>\n<ul>\n<li>the publisher or source</li>\n<li>the files or actions introduced by the package</li>\n<li>whether the skill requires network access or external tools</li>\n</ul>\n<h2 id=\"update-and-removal\">Update and removal</h2>\n<p>Keep skill lifecycle operations explicit. Users should be able to see the installed version, apply an update, or remove the skill without affecting unrelated product configuration.</p>\n<h2 id=\"recommended-administration\">Recommended administration</h2>\n<p>For managed environments, install new skills on a test machine first. After review, roll them out to production devices that use the same runtime and security policy.</p>"
      },
      "runtime-management": {
        "slug": "runtime-management",
        "eyebrow": "Runtimes",
        "title": "Manage local runtimes and CLI status",
        "summary": "Install supported runtimes, repair broken CLI environments, and distinguish between installed, authenticated, and ready states.",
        "readingTime": "6 min",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"runtime-states\">Runtime states</h2>\n<p>Treat runtime status as a sequence of states:</p>\n<ul>\n<li>Not installed</li>\n<li>Installed</li>\n<li>Authenticated or configured</li>\n<li>Ready</li>\n</ul>\n<p>An installed runtime may still be unusable until provider login or API configuration has been completed.</p>\n<h2 id=\"install-and-repair\">Install and repair</h2>\n<p>Use runtime management to install supported CLIs, re-run detection, and repair a broken installation path. Repair should stay limited to the runtime being managed.</p>\n<p>Do not treat repair as a general cleanup tool for the whole machine. It should not overwrite unrelated developer tools or global configuration.</p>\n<h2 id=\"readiness-checklist\">Readiness checklist</h2>\n<p>Before starting work with a runtime, confirm:</p>\n<ul>\n<li>the CLI is detected</li>\n<li>required provider login is complete</li>\n<li>required API keys or configuration are available</li>\n<li>the runtime can pass a basic health check</li>\n</ul>\n<h2 id=\"administrative-note\">Administrative note</h2>\n<p>ContextGo manages discovery, installation, repair, and status display. Provider authentication should still follow the official workflow for that provider.</p>"
      },
      "connectors-and-channels": {
        "slug": "connectors-and-channels",
        "eyebrow": "Connectors",
        "title": "Use connectors and channels",
        "summary": "Connect external sources to the desktop host, route outputs to delivery channels, and document the access requirements for each integration.",
        "readingTime": "6 min",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"connectors\">Connectors</h2>\n<p>Connectors bring external context into ContextGo. A connector can provide files, documents, shared drives, chat content, or structured system data to the desktop host.</p>\n<p>For each connector, document:</p>\n<ul>\n<li>the source system</li>\n<li>the access method and required permissions</li>\n<li>the scope of content exposed to agents or automation</li>\n</ul>\n<h2 id=\"channels\">Channels</h2>\n<p>Channels send output to a destination such as a publishing target, notification path, or delivery surface. A workflow may use one or more channels after content has been processed locally.</p>\n<h2 id=\"typical-flow\">Typical flow</h2>\n<p>The common pattern is:</p>\n<ol>\n<li>Connect a source system.</li>\n<li>Use the imported context in an agent task, hook, or scheduled task.</li>\n<li>Deliver the result through a configured channel.</li>\n</ol>\n<h2 id=\"access-guidance\">Access guidance</h2>\n<p>Grant the minimum permissions required for the intended workflow. If a connector or channel requires elevated access, record that requirement before enabling it on production devices.</p>"
      },
      "remote-access": {
        "slug": "remote-access",
        "eyebrow": "Remote Access",
        "title": "Use remote access from the browser or mobile",
        "summary": "Confirm host availability, understand the device-to-cloud connection, and know what the remote client can and cannot do without the desktop host.",
        "readingTime": "7 min",
        "updatedAt": "2026-04-12",
        "category": "operations",
        "html": "<h2 id=\"host-requirements\">Host requirements</h2>\n<p>Remote access depends on a registered desktop host. The desktop keeps the real workspace, files, local tools, runtimes, and active WebUI session.</p>\n<p>Before opening a remote session, confirm:</p>\n<ul>\n<li>the desktop is signed in</li>\n<li>the device is registered to the current account</li>\n<li>remote access is enabled or provisioned</li>\n<li>the host has an active network connection</li>\n</ul>\n<h2 id=\"connection-model\">Connection model</h2>\n<p>The remote client does not run a separate hosted copy of ContextGo. It connects through the account and relay layer back to the desktop host.</p>\n<p>If the host loses connectivity or exits the session, the remote client cannot continue the task independently.</p>\n<h2 id=\"mobile-behavior\">Mobile behavior</h2>\n<p>The mobile app or mobile browser session is a control surface for the host. Uploads, file access, runtime execution, and connector access still resolve on the desktop side.</p>\n<h2 id=\"if-remote-access-is-unavailable\">If remote access is unavailable</h2>\n<p>Check the following in order:</p>\n<ol>\n<li>Confirm the correct account is signed in.</li>\n<li>Confirm the desktop device is shown in the device list.</li>\n<li>Confirm the host is online and has not lost its outbound connection.</li>\n<li>Confirm local security or network policy is not blocking the device-side connection.</li>\n</ol>"
      },
      "cloud-account": {
        "slug": "cloud-account",
        "eyebrow": "Cloud Account",
        "title": "Manage cloud account and device binding",
        "summary": "Use the cloud account for sign-in, device registration, and lightweight account-linked state without treating it as a full cloud execution environment.",
        "readingTime": "6 min",
        "updatedAt": "2026-04-12",
        "category": "operations",
        "html": "<h2 id=\"what-the-cloud-account-is-used-for\">What the cloud account is used for</h2>\n<p>The cloud account is used for:</p>\n<ul>\n<li>account sign-in</li>\n<li>desktop device registration</li>\n<li>device discovery from browser or mobile clients</li>\n<li>lightweight account-linked preferences and metadata</li>\n</ul>\n<p>The cloud account is not the primary execution environment for your workspace.</p>\n<h2 id=\"what-can-sync\">What can sync</h2>\n<p>Examples of account-linked state include language preference, device registration, browser session state, and remote capability metadata.</p>\n<h2 id=\"what-remains-local\">What remains local</h2>\n<p>Workspace files, installed runtimes, active host processes, and local WebUI state remain on the desktop host unless an explicit product flow moves them elsewhere.</p>\n<h2 id=\"device-management\">Device management</h2>\n<p>When troubleshooting account state, confirm which devices are currently registered and which account is active on each client. Most remote-access issues are easier to diagnose after verifying device binding first.</p>"
      },
      "updates-and-troubleshooting": {
        "slug": "updates-and-troubleshooting",
        "eyebrow": "Updates",
        "title": "Check updates and troubleshoot common failures",
        "summary": "Keep the website, the in-app updater, and the release repository aligned, then diagnose login, device, runtime, and update problems from one place.",
        "readingTime": "7 min",
        "updatedAt": "2026-04-12",
        "category": "operations",
        "html": "<h2 id=\"release-source-of-truth\">Release source of truth</h2>\n<p>Public releases are published to <code>contextgo/contextgo-releases</code>. The website download page and the desktop updater should both point to that same release source.</p>\n<p>If the website version and the in-app update version do not match, treat that as a release pipeline issue first.</p>\n<h2 id=\"recommended-troubleshooting-order\">Recommended troubleshooting order</h2>\n<p>Use the least destructive checks first:</p>\n<ol>\n<li>Confirm account sign-in and browser callback behavior.</li>\n<li>Confirm the expected device is registered and online.</li>\n<li>Confirm remote access status if the issue appears in the browser or mobile client.</li>\n<li>Confirm runtime detection and provider authentication.</li>\n<li>Confirm the release version shown by the website and updater.</li>\n</ol>\n<h2 id=\"common-issue-groups\">Common issue groups</h2>\n<p>Use this page as the entry point for the following symptoms:</p>\n<ul>\n<li>browser sign-in does not complete</li>\n<li>device binding does not refresh</li>\n<li>remote access shows unavailable</li>\n<li>a runtime is installed but cannot run work</li>\n<li>update checks fail or show an unexpected version</li>\n</ul>\n<h2 id=\"when-to-compare-versions\">When to compare versions</h2>\n<p>Compare release versions when:</p>\n<ul>\n<li>the website offers one installer version and the desktop app shows another</li>\n<li>a user reports an update that cannot be downloaded</li>\n<li>a published release is missing from the download page</li>\n</ul>"
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
      "description": "ContextGo 官方产品文档，覆盖安装、Agent 工作流、自动化、远程访问与版本运维。",
      "featuredLabel": "文档结构",
      "featuredDescription": "Guides 用于完成初始配置，Features 用于查阅日常功能，Operations 用于处理账号、远程访问、更新和排障。",
      "categories": [
        {
          "id": "guides",
          "title": "Guides",
          "description": "首次使用前先阅读这里，完成安装、登录、设备注册，并理解基础产品模型。"
        },
        {
          "id": "features",
          "title": "Features",
          "description": "这一层说明日常会操作的功能，包括 Agents、Hooks、定时任务、运行时、Connectors 和技能。"
        },
        {
          "id": "operations",
          "title": "Operations",
          "description": "这一层说明云账号、远程访问、软件更新、版本来源和常见排障步骤。"
        }
      ],
      "entries": [
        {
          "slug": "quick-start",
          "eyebrow": "快速开始",
          "title": "在第一台桌面设备上完成 ContextGo 初始化",
          "summary": "安装桌面端、登录账号、注册当前设备，并确认这台主机已经可以提供本地或远程访问。",
          "readingTime": "5 分钟",
          "updatedAt": "2026-04-12",
          "category": "guides"
        },
        {
          "slug": "product-model",
          "eyebrow": "产品模型",
          "title": "先理解 ContextGo 的产品模型，再扩大使用范围",
          "summary": "在接入更多设备或团队成员之前，先明确桌面主机、云账号、浏览器/移动端入口和发布仓库各自承担的职责。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-04-12",
          "category": "guides"
        },
        {
          "slug": "agent-workspace",
          "eyebrow": "Agent",
          "title": "使用 Agent、Assistants 与运行时",
          "summary": "在 Agent 页面开始工作，在 Assistants 中维护可复用定义，并把运行时管理与任务入口区分开来。",
          "readingTime": "7 分钟",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "agent-collaboration",
          "eyebrow": "协作模式",
          "title": "使用 Harness 模式和远程协作",
          "summary": "明确哪些协作发生在本地桌面端，哪些场景可以通过远程入口接入，以及开始协作前应检查什么。",
          "readingTime": "7 分钟",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "hooks-overview",
          "eyebrow": "Hooks",
          "title": "为工作流事件配置 Hooks",
          "summary": "先明确 Hook 在什么事件上触发，再定义它能读取什么上下文、能执行哪些动作，以及如何安全上线。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "scheduled-tasks",
          "eyebrow": "定时任务",
          "title": "在桌面主机上运行定时任务",
          "summary": "为周期性工作流设置计划时间，确认主机和运行时条件，并在投入长期使用前检查失败处理方式。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "skill-market",
          "eyebrow": "技能市场",
          "title": "安装和管理技能",
          "summary": "先确认技能来源，再了解它会向产品增加什么能力，并把安装、更新和移除过程保持在可控范围内。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "runtime-management",
          "eyebrow": "运行时",
          "title": "管理本地运行时与 CLI 状态",
          "summary": "安装和修复受支持的运行时，并把“已安装”“已认证”“已就绪”这些状态明确区分开。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "connectors-and-channels",
          "eyebrow": "Connectors",
          "title": "使用 Connectors 与渠道",
          "summary": "把外部来源接入桌面主机，再把处理结果投递到目标渠道，并为每种集成记录清楚权限要求。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-04-12",
          "category": "features"
        },
        {
          "slug": "remote-access",
          "eyebrow": "远程访问",
          "title": "在浏览器或移动端使用远程访问",
          "summary": "先确认桌面主机可用，再理解设备到云层的连接方式，并明确远程客户端在没有主机时无法独立工作。",
          "readingTime": "7 分钟",
          "updatedAt": "2026-04-12",
          "category": "operations"
        },
        {
          "slug": "cloud-account",
          "eyebrow": "云账号",
          "title": "管理云账号与设备绑定",
          "summary": "使用云账号完成登录、设备注册和轻量状态同步，但不要把它理解成完整的云端执行环境。",
          "readingTime": "6 分钟",
          "updatedAt": "2026-04-12",
          "category": "operations"
        },
        {
          "slug": "updates-and-troubleshooting",
          "eyebrow": "更新与排障",
          "title": "检查更新并处理常见故障",
          "summary": "让官网、应用内更新和发布仓库保持一致，并从同一个入口排查登录、设备、运行时和更新问题。",
          "readingTime": "7 分钟",
          "updatedAt": "2026-04-12",
          "category": "operations"
        }
      ]
    },
    "articles": {
      "quick-start": {
        "slug": "quick-start",
        "eyebrow": "快速开始",
        "title": "在第一台桌面设备上完成 ContextGo 初始化",
        "summary": "安装桌面端、登录账号、注册当前设备，并确认这台主机已经可以提供本地或远程访问。",
        "readingTime": "5 分钟",
        "updatedAt": "2026-04-12",
        "category": "guides",
        "html": "<h2 id=\"开始前请先确认\">开始前请先确认</h2>\n<p>ContextGo 以桌面端作为主机。浏览器端和移动端只是连接入口，真正的工作区、文件和运行时仍然在桌面设备上。</p>\n<p>开始安装前，先确认以下条件：</p>\n<ul>\n<li>当前桌面设备允许安装应用。</li>\n<li>可以正常打开浏览器完成登录。</li>\n<li>当前网络没有拦截 ContextGo 的登录或更新请求。</li>\n</ul>\n<h2 id=\"1-安装桌面端\">1. 安装桌面端</h2>\n<p>从 <code>contextgo.io</code> 下载对应平台的桌面安装包并完成安装。官网的下载页和应用内更新都应读取 <code>contextgo/contextgo-releases</code> 中的发布产物。</p>\n<p>首次启动时，应用会准备本地工作区、WebUI 运行环境，以及远程访问所需的设备侧服务。</p>\n<h2 id=\"2-登录云账号\">2. 登录云账号</h2>\n<p>在桌面端中通过 GitHub 或 Google 登录。浏览器回跳完成后，当前设备会注册到你的 ContextGo 账号下。</p>\n<p>这个账号主要用于身份识别、设备注册和轻量状态同步，不负责托管你的本地工作区或运行时。</p>\n<h2 id=\"3-检查当前设备状态\">3. 检查当前设备状态</h2>\n<p>登录完成后，确认以下项目正常：</p>\n<ul>\n<li>当前设备出现在账号设备列表中。</li>\n<li>本地 WebUI 可以正常打开。</li>\n<li>设备状态显示为可用或在线。</li>\n</ul>\n<p>如果后续要从浏览器或移动端访问，还要继续确认远程访问已经启用。</p>\n<h2 id=\"4-按需测试远程访问\">4. 按需测试远程访问</h2>\n<p>如果你的使用方式包含远程访问，请在桌面主机保持在线的情况下打开网页入口进行测试。只有桌面主机保持连接，远程页面才可用。</p>\n<p>移动端访问也是同一套主机模型。上传、文件访问和运行时执行，最终仍然落在桌面设备上。</p>\n<h2 id=\"初始化失败时怎么检查\">初始化失败时怎么检查</h2>\n<p>建议按这个顺序排查：</p>\n<ol>\n<li>确认桌面端能正常拉起浏览器登录页。</li>\n<li>确认浏览器登录完成后能正确回到 ContextGo。</li>\n<li>检查本机安全策略、终端防护或企业网络策略是否拦截辅助进程或网络请求。</li>\n<li>如当前设备环境受限较多，换一台普通网络环境的机器重新验证。</li>\n</ol>"
      },
      "product-model": {
        "slug": "product-model",
        "eyebrow": "产品模型",
        "title": "先理解 ContextGo 的产品模型，再扩大使用范围",
        "summary": "在接入更多设备或团队成员之前，先明确桌面主机、云账号、浏览器/移动端入口和发布仓库各自承担的职责。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-04-12",
        "category": "guides",
        "html": "<h2 id=\"核心组成\">核心组成</h2>\n<p>ContextGo 由四个部分组成：</p>\n<ul>\n<li>桌面主机：负责文件、工具、运行时和本地 WebUI。</li>\n<li>云账号：负责登录、设备注册和账号关联状态。</li>\n<li>浏览器/移动端：用于连接桌面主机的远程入口。</li>\n<li>发布仓库：用于公开安装包、版本记录和下载产物。</li>\n</ul>\n<h2 id=\"各部分分别做什么\">各部分分别做什么</h2>\n<p>真正执行任务的是桌面端。无论是本地文件访问、运行时调用，还是依赖本机环境的连接器，都发生在桌面主机上。</p>\n<p>云账号不负责替代桌面端执行，它主要负责把设备和账号关联起来，并让网页端或移动端能够找到这些设备。</p>\n<p>浏览器端和移动端是访问入口，不是独立的云端运行环境。</p>\n<h2 id=\"版本来源\">版本来源</h2>\n<p>公开发布的安装包统一来自 <code>contextgo/contextgo-releases</code>。官网下载页和应用内更新应该引用同一份版本来源。</p>\n<p>如果你发现官网版本和应用内更新版本不一致，应先按发布链路问题处理。</p>\n<h2 id=\"建议阅读顺序\">建议阅读顺序</h2>\n<p>建议按下面的顺序阅读文档：</p>\n<ol>\n<li>先读 <code>快速开始</code>，完成第一台设备配置。</li>\n<li>再读 <code>Features</code>，配置 Agent、Hooks、定时任务、运行时、Connectors 或技能。</li>\n<li>最后读 <code>Operations</code>，处理账号、远程访问、更新和排障。</li>\n</ol>"
      },
      "agent-workspace": {
        "slug": "agent-workspace",
        "eyebrow": "Agent",
        "title": "使用 Agent、Assistants 与运行时",
        "summary": "在 Agent 页面开始工作，在 Assistants 中维护可复用定义，并把运行时管理与任务入口区分开来。",
        "readingTime": "7 分钟",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"agent-页面\">Agent 页面</h2>\n<p>Agent 页面用于开始任务、选择当前工作方式，以及确认本次任务使用的 Assistant 和运行时。这里应该是日常工作的入口页。</p>\n<p>这个页面至少要让用户看清三件事：</p>\n<ul>\n<li>当前任务使用哪个 Assistant</li>\n<li>当前任务由哪个运行时执行</li>\n<li>当前环境是否已经具备执行条件</li>\n</ul>\n<h2 id=\"assistants\">Assistants</h2>\n<p>Assistants 是可复用定义。一个 Assistant 可以包含指令、能力、常用工具和推荐运行时等配置。创建、修改或删除这些定义，应在 Assistants 管理区域完成。</p>\n<p>修改 Assistant 不应直接改变本机的运行时安装状态。它属于配置管理，不属于运行时运维。</p>\n<h2 id=\"运行时\">运行时</h2>\n<p>运行时管理应放在独立区域，用于安装、修复、检测和校验受支持的 CLI。</p>\n<p>如果某个运行时已经安装，但还缺少 provider 登录或 API 配置，应继续显示为“未就绪”，不要和“已安装”混为一谈。</p>\n<h2 id=\"推荐使用顺序\">推荐使用顺序</h2>\n<p>新设备上建议按这个顺序准备：</p>\n<ol>\n<li>先确认运行时已安装并通过基本检查。</li>\n<li>再创建或选择一个 Assistant。</li>\n<li>最后回到 Agent 页面开始任务。</li>\n</ol>"
      },
      "agent-collaboration": {
        "slug": "agent-collaboration",
        "eyebrow": "协作模式",
        "title": "使用 Harness 模式和远程协作",
        "summary": "明确哪些协作发生在本地桌面端，哪些场景可以通过远程入口接入，以及开始协作前应检查什么。",
        "readingTime": "7 分钟",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"本地协作\">本地协作</h2>\n<p>Harness 模式用于桌面主机上的本地协作。适合需要多个 Agent 角色、但又依赖本机文件、工具或运行时的工作流。</p>\n<p>如果主要工作内容都在当前桌面设备上，这通常是最直接的协作方式。</p>\n<h2 id=\"远程协作\">远程协作</h2>\n<p>远程访问是在同一套主机模型上增加浏览器端或移动端入口。它可以查看状态、继续任务或参与控制，但不会把工作区从桌面端迁走。</p>\n<p>如果桌面主机离线或失去连接，远程客户端也无法单独继续执行。</p>\n<h2 id=\"开始协作前的检查项\">开始协作前的检查项</h2>\n<p>开始协作前，建议先确认：</p>\n<ul>\n<li>桌面主机已经具备所需文件和运行时。</li>\n<li>本次使用的 Assistant 已经配置完成。</li>\n<li>如果需要远程参与，远程访问功能已经启用。</li>\n</ul>\n<h2 id=\"使用边界\">使用边界</h2>\n<p>使用协作模式时，默认遵循以下边界：</p>\n<ul>\n<li>真正执行任务的是桌面主机。</li>\n<li>文件默认留在主机工作区内。</li>\n<li>主机运行时异常会同时影响本地和远程会话。</li>\n</ul>"
      },
      "hooks-overview": {
        "slug": "hooks-overview",
        "eyebrow": "Hooks",
        "title": "为工作流事件配置 Hooks",
        "summary": "先明确 Hook 在什么事件上触发，再定义它能读取什么上下文、能执行哪些动作，以及如何安全上线。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"hook-的作用\">Hook 的作用</h2>\n<p>Hook 用于在指定工作流事件发生时自动执行额外步骤。常见用途包括校验、格式整理、通知、路由和后处理。</p>\n<p>如果某个动作会在每次任务前后重复出现，就适合优先考虑用 Hook 处理。</p>\n<h2 id=\"触发点\">触发点</h2>\n<p>配置 Hook 前，应先明确它是在以下哪类事件上触发：</p>\n<ul>\n<li>任务开始前</li>\n<li>任务输出生成后</li>\n<li>执行发布动作时</li>\n<li>任务状态变化时</li>\n</ul>\n<h2 id=\"输入与输出\">输入与输出</h2>\n<p>每个 Hook 至少要定义清楚以下内容：</p>\n<ul>\n<li>由什么事件触发</li>\n<li>可以读取哪些上下文</li>\n<li>允许产生哪些副作用</li>\n<li>失败后如何处理</li>\n</ul>\n<h2 id=\"上线建议\">上线建议</h2>\n<p>先从容易验证、容易关闭的 Hook 开始。每次修改后先检查输出和日志，再逐步接入更长的自动化链路。正式环境中，不建议一次性启用过多串联 Hook。</p>"
      },
      "scheduled-tasks": {
        "slug": "scheduled-tasks",
        "eyebrow": "定时任务",
        "title": "在桌面主机上运行定时任务",
        "summary": "为周期性工作流设置计划时间，确认主机和运行时条件，并在投入长期使用前检查失败处理方式。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"什么是定时任务\">什么是定时任务</h2>\n<p>定时任务用于按固定周期执行一条已保存的工作流。适合放入周期同步、定期审阅、报表生成或重复性的发布准备任务。</p>\n<p>每个任务都应明确计划时间、所需运行时、输入来源和预期输出。</p>\n<h2 id=\"主机要求\">主机要求</h2>\n<p>定时任务运行在桌面主机上。启用前请先确认：</p>\n<ul>\n<li>到点时主机保持开机。</li>\n<li>所需运行时已经安装并完成认证。</li>\n<li>任务使用的文件、连接器和凭证在主机上可用。</li>\n</ul>\n<p>如果主机离线，任务无法按计划执行。</p>\n<h2 id=\"失败处理\">失败处理</h2>\n<p>要提前说明任务漏跑或执行失败后的行为。至少应让用户知道，下次是重试、跳过，还是仅等待下一次计划时间。</p>\n<h2 id=\"推荐用法\">推荐用法</h2>\n<p>定时任务适合输入稳定、步骤固定的工作。对于频繁依赖人工确认的流程，应把人工审批步骤和定时执行部分拆开配置。</p>"
      },
      "skill-market": {
        "slug": "skill-market",
        "eyebrow": "技能市场",
        "title": "安装和管理技能",
        "summary": "先确认技能来源，再了解它会向产品增加什么能力，并把安装、更新和移除过程保持在可控范围内。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"技能来源\">技能来源</h2>\n<p>技能可以来自内置内容、本地目录，或可下载的发布源。安装前应先看清当前技能属于哪一种来源。</p>\n<p>来源信息决定了你如何评估它是否适合当前环境。</p>\n<h2 id=\"技能会增加什么\">技能会增加什么</h2>\n<p>一个技能可能增加提示词、说明、配置、脚本，或其他打包行为。安装界面应明确说明会新增哪些文件，以及是否包含可执行内容。</p>\n<p>启用下载技能前，建议先检查：</p>\n<ul>\n<li>发布来源或发布者</li>\n<li>技能会引入哪些文件或动作</li>\n<li>是否依赖联网能力或外部工具</li>\n</ul>\n<h2 id=\"更新与移除\">更新与移除</h2>\n<p>技能生命周期操作应保持清晰。用户应能查看当前版本、执行更新，并在不影响其他配置的前提下移除该技能。</p>\n<h2 id=\"管理建议\">管理建议</h2>\n<p>在受控环境中，建议先在测试设备上安装并验证新技能，确认行为符合预期后，再部署到正式使用的主机。</p>"
      },
      "runtime-management": {
        "slug": "runtime-management",
        "eyebrow": "运行时",
        "title": "管理本地运行时与 CLI 状态",
        "summary": "安装和修复受支持的运行时，并把“已安装”“已认证”“已就绪”这些状态明确区分开。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"运行时状态\">运行时状态</h2>\n<p>建议把运行时状态分为以下几类：</p>\n<ul>\n<li>未安装</li>\n<li>已安装</li>\n<li>已认证或已配置</li>\n<li>已就绪</li>\n</ul>\n<p>已安装并不一定代表可以立即执行任务。有些运行时仍然需要完成 provider 登录或 API 配置。</p>\n<h2 id=\"安装与修复\">安装与修复</h2>\n<p>运行时管理用于安装受支持的 CLI、重新检测状态，以及修复已损坏的安装路径。修复动作应只作用于当前运行时。</p>\n<p>不要把修复动作当作整机清理工具。它不应覆盖无关的开发工具或全局配置。</p>\n<h2 id=\"就绪检查\">就绪检查</h2>\n<p>正式开始任务前，建议至少确认：</p>\n<ul>\n<li>CLI 已被正确识别</li>\n<li>provider 登录已完成</li>\n<li>所需 API Key 或配置可用</li>\n<li>运行时能通过一次基础健康检查</li>\n</ul>\n<h2 id=\"管理说明\">管理说明</h2>\n<p>ContextGo 负责发现、安装、修复和状态展示。provider 认证仍建议沿用对应官方流程。</p>"
      },
      "connectors-and-channels": {
        "slug": "connectors-and-channels",
        "eyebrow": "Connectors",
        "title": "使用 Connectors 与渠道",
        "summary": "把外部来源接入桌面主机，再把处理结果投递到目标渠道，并为每种集成记录清楚权限要求。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-04-12",
        "category": "features",
        "html": "<h2 id=\"connectors\">Connectors</h2>\n<p>Connectors 用于把外部上下文引入 ContextGo。来源可以是文件、文档、共享盘、聊天内容或结构化系统数据。</p>\n<p>为每个 Connector 建议至少记录：</p>\n<ul>\n<li>来源系统是什么</li>\n<li>采用什么接入方式</li>\n<li>需要哪些权限</li>\n<li>接入后会向 Agent 或自动化暴露哪些内容</li>\n</ul>\n<h2 id=\"渠道\">渠道</h2>\n<p>渠道用于把结果发送到目标位置，例如发布面、通知路径或交付系统。一条工作流可以在本地处理完内容后，再通过一个或多个渠道输出。</p>\n<h2 id=\"典型链路\">典型链路</h2>\n<p>常见链路如下：</p>\n<ol>\n<li>接入来源系统。</li>\n<li>在 Agent、Hook 或定时任务中使用这些上下文。</li>\n<li>通过配置好的渠道输出结果。</li>\n</ol>\n<h2 id=\"权限建议\">权限建议</h2>\n<p>只授予当前工作流必需的最小权限。如果某个 Connector 或渠道需要高权限访问，启用前应先完成权限评估。</p>"
      },
      "remote-access": {
        "slug": "remote-access",
        "eyebrow": "远程访问",
        "title": "在浏览器或移动端使用远程访问",
        "summary": "先确认桌面主机可用，再理解设备到云层的连接方式，并明确远程客户端在没有主机时无法独立工作。",
        "readingTime": "7 分钟",
        "updatedAt": "2026-04-12",
        "category": "operations",
        "html": "<h2 id=\"主机要求\">主机要求</h2>\n<p>远程访问依赖一台已注册的桌面主机。真正的工作区、文件、本地工具、运行时和 WebUI 会话都保留在桌面设备上。</p>\n<p>在打开远程入口前，请先确认：</p>\n<ul>\n<li>桌面端已经登录账号</li>\n<li>当前设备已经完成注册</li>\n<li>远程访问已经启用或 provisioned</li>\n<li>主机保持联网状态</li>\n</ul>\n<h2 id=\"连接方式\">连接方式</h2>\n<p>远程客户端并不会启动一套独立托管在云端的 ContextGo，它只是通过账号和中继层回连桌面主机。</p>\n<p>如果桌面主机掉线、退出会话或失去连接，远程客户端也无法继续单独执行任务。</p>\n<h2 id=\"移动端行为\">移动端行为</h2>\n<p>移动端应用或手机浏览器页面，本质上都是桌面主机的控制面。上传、文件访问、运行时执行和 Connector 调用，最终仍落在桌面侧。</p>\n<h2 id=\"无法连接时怎么查\">无法连接时怎么查</h2>\n<p>建议按下面顺序检查：</p>\n<ol>\n<li>确认当前登录的是正确账号。</li>\n<li>确认目标桌面设备仍显示在设备列表中。</li>\n<li>确认主机在线且没有丢失出站连接。</li>\n<li>检查本地安全策略或网络策略是否阻断了设备侧连接。</li>\n</ol>"
      },
      "cloud-account": {
        "slug": "cloud-account",
        "eyebrow": "云账号",
        "title": "管理云账号与设备绑定",
        "summary": "使用云账号完成登录、设备注册和轻量状态同步，但不要把它理解成完整的云端执行环境。",
        "readingTime": "6 分钟",
        "updatedAt": "2026-04-12",
        "category": "operations",
        "html": "<h2 id=\"云账号的用途\">云账号的用途</h2>\n<p>云账号主要用于：</p>\n<ul>\n<li>登录账号</li>\n<li>注册桌面设备</li>\n<li>在浏览器端或移动端发现这些设备</li>\n<li>保存账号关联的轻量状态</li>\n</ul>\n<p>云账号不是工作区的主要执行环境。</p>\n<h2 id=\"会同步什么\">会同步什么</h2>\n<p>可同步的通常是语言偏好、设备注册信息、浏览器登录会话和远程能力元数据等轻量状态。</p>\n<h2 id=\"什么仍然保留在本地\">什么仍然保留在本地</h2>\n<p>工作区文件、已安装运行时、主机进程和本地 WebUI 状态，默认仍保留在桌面主机上，除非产品提供了明确的迁移流程。</p>\n<h2 id=\"设备管理\">设备管理</h2>\n<p>排查账号相关问题时，先确认当前账号下注册了哪些设备，以及每个客户端现在登录的是哪个账号。很多远程访问问题，先核对设备绑定会更容易定位。</p>"
      },
      "updates-and-troubleshooting": {
        "slug": "updates-and-troubleshooting",
        "eyebrow": "更新与排障",
        "title": "检查更新并处理常见故障",
        "summary": "让官网、应用内更新和发布仓库保持一致，并从同一个入口排查登录、设备、运行时和更新问题。",
        "readingTime": "7 分钟",
        "updatedAt": "2026-04-12",
        "category": "operations",
        "html": "<h2 id=\"统一版本来源\">统一版本来源</h2>\n<p>公开发布统一来自 <code>contextgo/contextgo-releases</code>。官网下载页和桌面端内的更新入口都应指向同一份发布来源。</p>\n<p>如果官网版本和应用内显示的更新版本不一致，应先按发布链路异常处理。</p>\n<h2 id=\"建议排查顺序\">建议排查顺序</h2>\n<p>建议优先按影响范围最小的顺序检查：</p>\n<ol>\n<li>先确认账号登录和浏览器回跳是否正常。</li>\n<li>再确认目标设备是否已注册且在线。</li>\n<li>如问题出现在网页端或移动端，再检查远程访问状态。</li>\n<li>再检查运行时识别和 provider 认证。</li>\n<li>最后核对官网版本、应用内版本和发布仓库版本是否一致。</li>\n</ol>\n<h2 id=\"常见问题类型\">常见问题类型</h2>\n<p>这个页面适合作为以下问题的统一入口：</p>\n<ul>\n<li>浏览器登录没有完成</li>\n<li>设备绑定没有刷新</li>\n<li>远程访问显示 unavailable</li>\n<li>运行时已安装但无法执行</li>\n<li>更新检查失败或版本异常</li>\n</ul>\n<h2 id=\"什么时候要核对版本\">什么时候要核对版本</h2>\n<p>出现以下情况时，建议直接对比版本来源：</p>\n<ul>\n<li>官网下载页显示一个版本，应用内更新显示另一个版本</li>\n<li>用户反馈有更新提示，但安装包无法下载</li>\n<li>发布仓库里已有版本，但官网还没有展示出来</li>\n</ul>"
      }
    }
  }
};
