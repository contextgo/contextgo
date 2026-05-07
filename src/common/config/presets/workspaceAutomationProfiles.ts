import {
  createManagedSlashCommandFromBuiltin,
  type BuiltinManagedSlashCommandId,
  type ManagedSlashCommandRecord,
  type SlashCommandTranslationResolver,
} from '@/common/chat/slash/library';
import type { AgentPackageWorkspaceAutomationProfile } from './agentPackageManifest';

export type WorkspaceBuiltinCommandSeed = {
  type: 'builtin';
  id: BuiltinManagedSlashCommandId;
  enabled: boolean;
  descriptionOverride?: string;
  templateOverride?: string;
};

export type WorkspaceCustomCommandSeed = {
  type: 'custom';
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  template: string;
};

export type WorkspaceCommandSeed = WorkspaceBuiltinCommandSeed | WorkspaceCustomCommandSeed;

export type WorkspaceAutomationScheduleSeed = {
  conversationSchedules: unknown[];
};

export type WorkspaceAutomationProfileDefinition = {
  label: string;
  commandSeeds: readonly WorkspaceCommandSeed[];
  scheduleSeed: WorkspaceAutomationScheduleSeed;
};

const DEFAULT_ENGINEERING_COMMAND_SEEDS: readonly WorkspaceBuiltinCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: true,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: true,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: true,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: true,
  },
] as const;

const CONTEXTGO_HARNESS_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  ...DEFAULT_ENGINEERING_COMMAND_SEEDS,
  {
    type: 'custom',
    id: 'harness-brainstorm',
    enabled: true,
    name: 'brainstorm',
    description: 'Turn a vague request into an explicit design before implementation.',
    template:
      'Use the `brainstorming` skill for this request. Explore the repository context, clarify the goal and constraints, compare a small number of approaches, then present a concrete design before editing files.',
  },
  {
    type: 'custom',
    id: 'harness-write-plan',
    enabled: true,
    name: 'write-plan',
    description: 'Write an implementation plan with concrete files, steps, and verification.',
    template:
      'Use the `writing-plans` skill for this request. Convert the approved requirements or spec into an implementation plan with explicit files, ordered steps, validation commands, and crisp checkpoints before coding.',
  },
  {
    type: 'custom',
    id: 'harness-execute-plan',
    enabled: true,
    name: 'execute-plan',
    description: 'Execute an implementation plan in a controlled, verifiable sequence.',
    template:
      'Use the `executing-plans` skill for this request. Review the plan critically first, then execute it step by step with visible checkpoints, targeted verification, and no skipped validation. If delegation is both supported and explicitly requested, prefer `subagent-driven-development`.',
  },
  {
    type: 'custom',
    id: 'harness-worktree',
    enabled: true,
    name: 'worktree',
    description: 'Prepare an isolated git worktree before risky or multi-step delivery.',
    template:
      'Use the `using-git-worktrees` skill for this request. Set up an isolated worktree only if this repository and runtime support it, verify the ignore and baseline state, then report the exact worktree path and readiness.',
  },
  {
    type: 'custom',
    id: 'harness-parallel',
    enabled: true,
    name: 'parallelize',
    description: 'Split independent work into parallel streams with clear integration boundaries.',
    template:
      'Use the `dispatching-parallel-agents` skill for this request. Break the work into independent streams, define ownership and verification for each stream, and only delegate when the runtime supports it and the user has asked for that style of execution.',
  },
  {
    type: 'custom',
    id: 'harness-request-review',
    enabled: true,
    name: 'request-review',
    description: 'Request a structured code review before moving forward or merging.',
    template:
      'Use the `requesting-code-review` skill for this request. Gather the relevant scope, diffs, and requirements, then prepare a focused review ask that prioritizes correctness, regressions, and missing tests.',
  },
  {
    type: 'custom',
    id: 'harness-apply-review',
    enabled: true,
    name: 'apply-review',
    description: 'Evaluate review feedback rigorously before implementing it.',
    template:
      'Use the `receiving-code-review` skill for this request. Verify each review item against the codebase, challenge incorrect assumptions with technical evidence, then implement confirmed fixes one item at a time with validation.',
  },
  {
    type: 'custom',
    id: 'harness-debug-root-cause',
    enabled: true,
    name: 'debug-root-cause',
    description: 'Investigate failures methodically before attempting fixes.',
    template:
      'Use the `systematic-debugging` skill for this request. Reproduce the issue, trace the evidence, identify the root cause, and only then propose or implement the smallest meaningful fix with validation.',
  },
  {
    type: 'custom',
    id: 'harness-finish-branch',
    enabled: true,
    name: 'finish-branch',
    description: 'Close out a development branch with verification and explicit integration choice.',
    template:
      'Use the `finishing-a-development-branch` skill for this request. Verify the final state first, then present the next-step options clearly and execute only the workflow the user chooses.',
  },
] as const;

const CLAUDE_ECC_LEGACY_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  ...DEFAULT_ENGINEERING_COMMAND_SEEDS,
  {
    type: 'custom',
    id: 'ecc-quality-gate',
    enabled: true,
    name: 'quality-gate',
    description: 'Run the ECC quality pipeline on demand for a file or project scope.',
    template:
      'Use the `verification-loop` skill for this request and apply the ECC quality-gate workflow to the relevant path or repository scope before reporting blockers.',
  },
  {
    type: 'custom',
    id: 'ecc-checkpoint',
    enabled: true,
    name: 'checkpoint',
    description: 'Capture a concise project checkpoint before continuing the next iteration.',
    template:
      'Use the `strategic-compact` skill for this request. Summarize the current checkpoint, open decisions, verification state, and the next execution slice before proceeding.',
  },
  {
    type: 'custom',
    id: 'ecc-resume-session',
    enabled: true,
    name: 'resume-session',
    description: 'Resume an ECC workflow with the right context, risks, and next actions.',
    template:
      'Use the `strategic-compact` and `codebase-onboarding` skills for this request. Reconstruct the relevant workspace context, active constraints, and next actions before doing new work.',
  },
] as const;

const STARTUP_STRATEGIST_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride: 'Frame the startup question, stage, target customer, and decision to be made before drafting.',
    templateOverride:
      'Restate the startup task, identify the product stage, target customer, decision horizon, and known evidence, then separate facts from assumptions and propose the shortest credible strategy workflow before drafting.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
    descriptionOverride:
      'Verify customer evidence, market assumptions, tradeoffs, and metric logic before presenting a strategy.',
    templateOverride:
      'Verify the current startup strategy output end to end. Re-check customer evidence, problem severity, segment choice, market assumptions, tradeoffs, defensibility, metric logic, and unresolved unknowns. Summarize what is grounded, what is inferred, and what still needs validation.',
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'startup-stress-idea',
    enabled: true,
    name: 'stress-idea',
    description:
      'Pressure-test a startup idea through customer pain, market logic, strategic choices, and failure risks.',
    template:
      'Use the `startup-founder-problem-framing`, `startup-strategic-diagnosis`, and `startup-startup-canvas` skills for this request. Start from the customer problem and current alternatives, test whether the timing and segment are credible, surface the biggest strategic risks and weak assumptions, then end with a blunt readout of what must be true for this idea to work.',
  },
  {
    type: 'custom',
    id: 'startup-design-canvas',
    enabled: true,
    name: 'design-canvas',
    description: 'Create a startup canvas that separates strategic choices from the business model.',
    template:
      'Use the `startup-startup-canvas` skill for this request. Draft a startup canvas that makes the vision, segment choice, value proposition, tradeoffs, growth motion, required capabilities, defensibility, cost structure, and revenue streams explicit. Keep strategy and business model connected but separate.',
  },
  {
    type: 'custom',
    id: 'startup-scan-market',
    enabled: true,
    name: 'scan-market',
    description: 'Assess market timing, alternatives, SWOT, and strategic pressure points for a startup concept.',
    template:
      'Use the `startup-strategic-diagnosis` and `startup-founder-problem-framing` skills for this request. Map the current alternatives, market timing, and SWOT picture for the idea, identify the most important external threats and internal weaknesses, and end with the strategic implications for focus, sequencing, and validation.',
  },
  {
    type: 'custom',
    id: 'startup-define-icp',
    enabled: true,
    name: 'define-icp',
    description: 'Define the beachhead customer with JTBD, buying context, needs, and disqualification rules.',
    template:
      'Use the `startup-ideal-customer-profile` and `startup-founder-problem-framing` skills for this request. Define the primary beachhead segment, document firmographic or role-based signals, explain the JTBD and buying context, identify the strongest needs and pain points, and make disqualification criteria explicit instead of pretending everyone is a fit.',
  },
  {
    type: 'custom',
    id: 'startup-shape-value-prop',
    enabled: true,
    name: 'shape-value-prop',
    description: 'Turn a target segment and problem into a sharp value proposition and positioning statement.',
    template:
      'Use the `startup-value-proposition`, `startup-founder-problem-framing`, and `startup-ideal-customer-profile` skills for this request. Build the value proposition through who, why, what before, how, what after, and alternatives, then finish with a concise positioning statement and the proof points still missing.',
  },
  {
    type: 'custom',
    id: 'startup-plan-gtm',
    enabled: true,
    name: 'plan-gtm',
    description: 'Build a startup go-to-market plan around the beachhead segment, message, channels, and early proof.',
    template:
      'Use the `startup-go-to-market-strategy`, `startup-ideal-customer-profile`, and `startup-value-proposition` skills for this request. Start from the beachhead segment, turn the value proposition into channel-ready messaging, choose the smallest credible distribution motion, define launch milestones and proof assets, and end with a 90-day GTM plan plus the metrics that will tell us if the motion is working.',
  },
  {
    type: 'custom',
    id: 'startup-set-north-star',
    enabled: true,
    name: 'set-north-star',
    description: 'Choose a North Star metric and input metrics that reflect real customer value.',
    template:
      'Use the `startup-north-star-metric` and `startup-go-to-market-strategy` skills for this request. Classify the business model first, recommend a single North Star metric that reflects customer value, define 3-5 input metrics the team can actually move, and explain how the metric system should influence product and GTM decisions.',
  },
  {
    type: 'custom',
    id: 'startup-write-founder-brief',
    enabled: true,
    name: 'write-founder-brief',
    description:
      'Synthesize the current startup strategy into a founder-ready brief with choices, risks, and next tests.',
    template:
      'Use the `startup-founder-brief`, `startup-startup-canvas`, `startup-strategic-diagnosis`, and `startup-go-to-market-strategy` skills for this request. Turn the current evidence into a tight founder brief that states the thesis, target segment, value proposition, growth motion, key metrics, strategic risks, and the next validation tests in a format that is usable for a cofounder, operator, or investor conversation.',
  },
] as const;

const DESIGN_DIRECTOR_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride:
      'Frame the design problem, product surface, audience, and current visual constraints before prescribing style.',
    templateOverride:
      'Restate the design task, identify whether this is a landing page, product surface, or design-system problem, separate hard constraints from taste preferences, and propose the shortest credible design workflow before drafting.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
    descriptionOverride:
      'Verify hierarchy, layout logic, consistency, accessibility, and implementation readiness before sign-off.',
    templateOverride:
      'Verify the current design output end to end. Re-check hierarchy, spacing logic, contrast, interaction consistency, responsiveness, component-system fit, and whether the guidance is actually implementable. Summarize what is resolved, what is still subjective, and what still blocks confident implementation.',
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'design-pick-style',
    enabled: true,
    name: 'pick-style',
    description: 'Choose the right visual archetype before drifting into generic UI output.',
    template:
      'Use the `design-style-archetype-selection` skill for this request. Classify the product, audience, trust level, and desired emotional tone first, recommend the strongest visual archetype plus one fallback, explain why the recommendation fits, and call out the anti-patterns that would make the UI feel generic or mismatched.',
  },
  {
    type: 'custom',
    id: 'design-draft-system',
    enabled: true,
    name: 'draft-design-system',
    description: 'Turn product context and references into a project-level DESIGN.md or design brief.',
    template:
      'Use the `design-style-archetype-selection` and `design-system-distillation` skills for this request. Choose the visual direction first, then distill it into a project-level design system that covers atmosphere, colors, typography, component language, layout rules, motion, and explicit do-not-do rules. Keep the output implementation-aware instead of brand-mood poetry.',
  },
  {
    type: 'custom',
    id: 'design-art-direct-page',
    enabled: true,
    name: 'art-direct-page',
    description: 'Art-direct a landing page or product surface with the right page lens and component discipline.',
    template:
      'Use the `design-system-distillation` skill plus either `design-landing-page-art-direction` or `design-product-surface-art-direction`, depending on the page type. Clarify the page goal first, choose the correct page lens, then produce a page-level art direction covering narrative or workflow structure, layout rhythm, hero or shell strategy, component priorities, motion, and the few design risks that could still derail implementation.',
  },
  {
    type: 'custom',
    id: 'design-critique-ui',
    enabled: true,
    name: 'critique-ui',
    description: 'Critique an existing UI with concrete findings and design-system-level fixes.',
    template:
      'Use the `design-ui-critique-and-polish` and `design-system-adaptation` skills for this request. Review the current UI critically, prioritize the most consequential visual and interaction issues, explain the underlying system problems instead of giving taste-only feedback, and end with a concrete polish plan that can actually be implemented.',
  },
  {
    type: 'custom',
    id: 'design-review-screenshot',
    enabled: true,
    name: 'review-screenshot',
    description:
      'Review screenshots with a first-scan read, severity-ranked findings, and minimal high-value redesign moves.',
    template:
      'Use the `design-screenshot-critique` and `design-ui-critique-and-polish` skills for this request. Start from what the screenshot communicates in the first five seconds, identify the highest-severity hierarchy, density, action-ranking, or consistency issues, explain the system causes, and finish with the smallest high-value redesign moves plus what should remain stable.',
  },
  {
    type: 'custom',
    id: 'design-absorb-figma-reference',
    enabled: true,
    name: 'absorb-figma-reference',
    description:
      'Translate the right Figma signals into first-party design rules without turning the result into a brand copy.',
    template:
      'Use the `design-figma-reference-absorption`, `design-system-adaptation`, and `design-system-distillation` skills for this request. Clarify why Figma is the reference, extract the structural signals that matter, separate what should be borrowed from what should stay out, and translate the result into first-party palette, type, component, layout, and motion rules with explicit no-copy guardrails.',
  },
  {
    type: 'custom',
    id: 'design-adapt-system',
    enabled: true,
    name: 'adapt-system',
    description: 'Translate a reference aesthetic into an existing design system without breaking product consistency.',
    template:
      'Use the `design-system-adaptation` and `design-system-distillation` skills for this request. Start from the existing design system or component constraints, identify what must stay stable, translate the desired reference style into compatible tokens and patterns, and make the preserved boundaries explicit so the result feels intentional instead of like a superficial skin.',
  },
  {
    type: 'custom',
    id: 'design-spec-component',
    enabled: true,
    name: 'spec-component',
    description:
      'Write a component-level visual spec with anatomy, variants, states, composition rules, and acceptance checks.',
    template:
      'Use the `design-component-visual-spec` and `design-handoff-brief` skills for this request. Define the component role first, then write a component-level visual spec covering anatomy, variants, spacing, typography, surface logic, interactive states, composition rules, guardrails, and acceptance checks so a frontend implementer can build it without guessing.',
  },
  {
    type: 'custom',
    id: 'design-write-handoff',
    enabled: true,
    name: 'write-handoff',
    description: 'Turn the chosen design direction into an implementation-ready handoff for frontend work.',
    template:
      'Use the `design-handoff-brief` skill together with any relevant design-direction skills already established for this request. Convert the chosen visual direction into a handoff that includes page goals, layout structure, tokens, component rules, responsive behavior, motion guidance, and acceptance checks that a frontend implementer can follow without guessing.',
  },
] as const;

const PM_WORKBENCH_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride: 'Frame the PM task, assumptions, and artifact path before drafting.',
    templateOverride:
      'Restate the product management task, separate facts from assumptions, identify the target artifact or decision, and propose a short execution plan before drafting anything.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'pm-discover',
    enabled: true,
    name: 'discover',
    description: 'Run evidence-led product discovery from outcome framing to next experiments.',
    template:
      'Use the `pm-discovery-process` and `pm-opportunity-solution-tree` skills for this request. Start from the desired outcome, separate evidence from assumptions, frame 2-4 real opportunities, and finish with a concrete discovery plan that includes the best next interviews, evidence gaps, and experiments.',
  },
  {
    type: 'custom',
    id: 'pm-strategy',
    enabled: true,
    name: 'strategy',
    description: 'Build product strategy from market context through opportunity choice and roadmap direction.',
    template:
      'Use the `pm-product-strategy`, `pm-opportunity-solution-tree`, `pm-roadmap-planning`, and `pm-company-research` skills for this request. Clarify the target market and customer, lock the strategic problem or opportunity, identify the core choices and tradeoffs, and finish with a strategy narrative plus roadmap direction. Keep strategy separate from detailed execution backlog.',
  },
  {
    type: 'custom',
    id: 'pm-write-prd',
    enabled: true,
    name: 'write-prd',
    description: 'Turn discovery context into a product requirements document with clear scope and success criteria.',
    template:
      'Use the `pm-prd-development` skill for this request. Convert the available context into a PRD with problem framing, target users, strategic context, solution outline, metrics, requirements, out-of-scope boundaries, dependencies, risks, and open questions. Make missing evidence explicit instead of faking certainty.',
  },
  {
    type: 'custom',
    id: 'pm-plan-roadmap',
    enabled: true,
    name: 'plan-roadmap',
    description: 'Build an outcome-driven roadmap with sequencing, dependencies, and confidence levels.',
    template:
      'Use the `pm-roadmap-planning` and `pm-prioritization-advisor` skills for this request. Turn goals, problems, and candidate initiatives into a roadmap that explains why each initiative exists, how the work is sequenced, what is now versus next versus later, and which tradeoffs remain unresolved.',
  },
  {
    type: 'custom',
    id: 'pm-prioritize',
    enabled: true,
    name: 'prioritize',
    description: 'Choose the right prioritization lens and rank initiatives with defensible tradeoffs.',
    template:
      'Use the `pm-prioritization-advisor` and `pm-feature-investment-advisor` skills for this request. Recommend the right prioritization framework for the current stage, score or compare the options with visible assumptions, and end with a ranked recommendation, rationale, and the decisions that still need evidence.',
  },
] as const;

const OFFICE_ANALYST_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride: 'Frame the office task, inputs, output format, and source-of-truth assumptions before acting.',
    templateOverride:
      'Restate the office analysis task, identify the input files and their likely roles, separate facts from assumptions, and propose the shortest reliable path before editing files or drafting the final answer.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
    descriptionOverride:
      'Verify figures, source consistency, document integrity, and unresolved risks before delivery.',
    templateOverride:
      'Verify the current office deliverable end to end. Re-check figures, source consistency, formula integrity, formatting expectations, and unresolved assumptions. Summarize what is confirmed, what is inferred, and what still needs manual review.',
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'office-analyze-sheet',
    enabled: true,
    name: 'analyze-sheet',
    description: 'Analyze a spreadsheet with template awareness, formula safety, and concise findings.',
    template:
      'Use the `office-spreadsheet-analysis`, `office-duckdb-read-file`, and `xlsx` skills for this request. Inspect the workbook structure first, preserve existing conventions, analyze the important sheets, surface anomalies and trends, and switch to DuckDB-style file querying when multiple sheets or large exports make SQL-style analysis more reliable.',
  },
  {
    type: 'custom',
    id: 'office-query-files',
    enabled: true,
    name: 'query-files',
    description: 'Run SQL-style analysis across local data files such as CSV, Parquet, JSON, and Excel.',
    template:
      'Use the `office-duckdb-query`, `office-duckdb-read-file`, and `office-duckdb-install` skills for this request. Prefer DuckDB-friendly SQL over ad-hoc scripting, read files directly when possible, keep large result sets bounded, and explain the business meaning of the final query results.',
  },
  {
    type: 'custom',
    id: 'office-join-files',
    enabled: true,
    name: 'join-files',
    description:
      'Join multiple office data files with grain checks, coverage diagnostics, and business-facing conclusions.',
    template:
      'Use the `office-cross-file-join-analysis`, `office-duckdb-query`, `office-duckdb-read-file`, and `office-duckdb-install` skills for this request. Inspect each file first, identify the real row grain and trustworthy join keys, validate duplicates or grain mismatches before joining, then run bounded DuckDB-friendly SQL and explain both the match coverage and the business meaning of the result.',
  },
  {
    type: 'custom',
    id: 'office-profile-data',
    enabled: true,
    name: 'profile-data',
    description: 'Profile a data file quickly to understand schema, row count, and what to query next.',
    template:
      'Use the `office-duckdb-read-file` and `office-duckdb-install` skills for this request. Inspect the file with DuckDB-style reading first, summarize the schema and row count, surface notable patterns or data quality risks, and propose the next SQL-style questions worth asking.',
  },
  {
    type: 'custom',
    id: 'office-summarize-docs',
    enabled: true,
    name: 'summarize-docs',
    description: 'Extract signal from PDFs and DOCX files, then return a decision-friendly summary.',
    template:
      'Use the `office-document-operations`, `office-briefing`, `pdf`, and `docx` skills for this request. Choose the right extraction path for each document, keep tracked changes or table structure in mind, and produce a concise summary with decisions, risks, and open questions.',
  },
  {
    type: 'custom',
    id: 'office-reconcile-sources',
    enabled: true,
    name: 'reconcile-sources',
    description: 'Cross-check numbers and statements across spreadsheets, PDFs, and memos before reporting out.',
    template:
      'Use the `office-source-reconciliation`, `xlsx`, `pdf`, and `docx` skills for this request. Identify the likely source of truth for each figure, compare overlapping numbers or statements across files, flag mismatches explicitly, and end with a clean reconciled view or a clear list of unresolved conflicts.',
  },
  {
    type: 'custom',
    id: 'office-drilldown-report',
    enabled: true,
    name: 'drilldown-report',
    description: 'Start from a KPI or management summary, then drill into the main drivers, segments, and anomalies.',
    template:
      'Use the `office-report-drilldown`, `office-duckdb-query`, and `office-source-reconciliation` skills for this request. Start from the headline metric or report claim, lock the period and metric definition, drill into the strongest segment cuts with bounded SQL-style analysis, rank the main contributors, and explain what likely moved versus what still needs stronger root-cause confirmation.',
  },
  {
    type: 'custom',
    id: 'office-write-report',
    enabled: true,
    name: 'write-report',
    description: 'Turn office analysis into a polished memo, summary, or report without losing traceability.',
    template:
      'Use the `office-report-drafting`, `office-briefing`, and `docx` skills for this request. Convert the current findings into a polished report with a crisp executive summary, evidence-backed sections, explicit assumptions, and clean next-step recommendations. If the user needs an editable document, optimize for a DOCX-friendly structure.',
  },
  {
    type: 'custom',
    id: 'office-query-pdf-tables',
    enabled: true,
    name: 'query-pdf-tables',
    description: 'Extract tables from PDFs, assess extraction quality, then analyze them with DuckDB-style queries.',
    template:
      'Use the `office-pdf-table-query`, `office-document-operations`, `office-duckdb-read-file`, `office-duckdb-query`, and `pdf` skills for this request. Inspect whether the PDF tables are extractable first, call out OCR or table-boundary risks, normalize the extracted structure carefully, then run bounded DuckDB-friendly SQL and summarize the findings with explicit reliability caveats.',
  },
] as const;

const FINANCE_ANALYST_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride:
      'Frame the finance task, periods, source files, and confidence risks before modeling or writing.',
    templateOverride:
      'Restate the finance task, identify the source files and reporting periods involved, separate reported facts from assumptions, and propose the shortest reliable path before modeling, querying files, or drafting a conclusion.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
    descriptionOverride:
      'Verify periods, formulas, source consistency, assumptions, and unresolved confidence gaps before delivery.',
    templateOverride:
      'Verify the current finance deliverable end to end. Re-check periods, units, formulas, statement consistency, assumptions, valuation sensitivities, and unresolved data-quality gaps. Summarize what is confirmed, what is assumed, and what still limits confidence.',
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'finance-analyze-financials',
    enabled: true,
    name: 'analyze-financials',
    description: 'Read financial statements together, then explain health, risk, and what needs follow-up.',
    template:
      'Use the `finance-financial-statement-analysis`, `finance-ratio-benchmarking`, `office-duckdb-read-file`, and `xlsx` skills for this request. Inspect the available statements first, read income statement, balance sheet, and cash flow together, benchmark the most important ratios with context, and finish with a clear explanation of financial health, main risks, and the highest-value follow-up question.',
  },
  {
    type: 'custom',
    id: 'finance-explain-variance',
    enabled: true,
    name: 'explain-variance',
    description: 'Explain actual versus budget or prior-period movement with materiality and driver logic.',
    template:
      'Use the `finance-budget-variance-analysis`, `office-duckdb-query`, and `office-source-reconciliation` skills for this request. Lock the comparison basis and materiality threshold first, isolate the few variances that matter most, explain the likely drivers, and end with a management-ready readout of what moved, what is noise, and what needs reforecasting or operating follow-up.',
  },
  {
    type: 'custom',
    id: 'finance-build-dcf',
    enabled: true,
    name: 'build-dcf',
    description: 'Turn financial inputs into a valuation range with scenarios, sensitivity, and confidence discipline.',
    template:
      'Use the `finance-dcf-valuation`, `finance-financial-statement-analysis`, `finance-ratio-benchmarking`, and `office-duckdb-query` skills for this request. Run a data-quality gate first, build explicit bull/base/bear assumptions, produce a bounded DCF-style fair-value view with sensitivity checks and relative-value sanity checks, then state the confidence level, key gaps, and margin-of-safety framing without pretending the output is a single certain answer.',
  },
  {
    type: 'custom',
    id: 'finance-compare-companies',
    enabled: true,
    name: 'compare-companies',
    description:
      'Compare multiple companies with a consistent ratio, quality, and valuation frame instead of ad-hoc scorecards.',
    template:
      'Use the `finance-comparable-valuation`, `finance-ratio-benchmarking`, `finance-financial-statement-analysis`, and `office-duckdb-query` skills for this request. Normalize the comparison frame first, compare the companies on profitability, leverage, growth quality, and valuation using consistent periods and metrics, then explain the tradeoffs clearly instead of forcing a fake single-winner score.',
  },
  {
    type: 'custom',
    id: 'finance-screen-investment',
    enabled: true,
    name: 'screen-investment',
    description: 'Screen one or more businesses against valuation, quality, and risk gates before deeper diligence.',
    template:
      'Use the `finance-investment-screening`, `finance-ratio-benchmarking`, `finance-dcf-valuation`, and `office-duckdb-query` skills for this request. Set the screening criteria explicitly first, run valuation, quality, and risk gates against the available inputs, classify each candidate as attractive, watchlist, or caution, and say which missing data still blocks stronger conviction.',
  },
  {
    type: 'custom',
    id: 'finance-forecast-business',
    enabled: true,
    name: 'forecast-business',
    description: 'Build a base, bull, and bear operating forecast from explicit business drivers.',
    template:
      'Use the `finance-forecast-scenario-planning`, `finance-budget-variance-analysis`, `office-duckdb-query`, and `xlsx` skills for this request. Identify the real operating drivers first, build a defensible base case, stress it into bull and bear cases with explicit assumption changes, and summarize the revenue, margin, or cash implications together with the most fragile parts of the forecast.',
  },
  {
    type: 'custom',
    id: 'finance-benchmark-saas',
    enabled: true,
    name: 'benchmark-saas',
    description: 'Turn raw SaaS operating numbers into a benchmarked health report with prioritized fixes.',
    template:
      'Use the `finance-saas-metrics` and `office-duckdb-query` skills for this request. Work with partial inputs if necessary, identify the company stage and segment, calculate the most important SaaS health metrics, benchmark them with context, and end with the two or three issues that deserve immediate action plus one metric that should anchor the next 90 days.',
  },
  {
    type: 'custom',
    id: 'finance-stress-test-thesis',
    enabled: true,
    name: 'stress-test-thesis',
    description:
      'Pressure-test an investment or operating thesis by attacking assumptions, invalidation points, and downside paths.',
    template:
      'Use the `finance-thesis-stress-test`, `finance-dcf-valuation`, `finance-financial-statement-analysis`, and `finance-investment-memo` skills for this request. Restate the current thesis first, identify the assumptions doing the most work, attack them from downside, execution, balance-sheet, and cycle perspectives, and end with explicit invalidation conditions, monitoring triggers, and what would actually increase conviction.',
  },
  {
    type: 'custom',
    id: 'finance-write-investment-memo',
    enabled: true,
    name: 'write-investment-memo',
    description: 'Convert current finance analysis into a structured investment memo or management brief.',
    template:
      'Use the `finance-investment-memo`, `finance-dcf-valuation`, `finance-ratio-benchmarking`, `office-source-reconciliation`, `docx`, and `pdf` skills for this request. Turn the current analysis into a disciplined memo with executive summary, data used, thesis, valuation or performance view, risk register, confidence level, and explicit gaps. Keep facts, assumptions, and inference visibly separate.',
  },
] as const;

const FIGMA_CLOSED_LOOP_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride:
      'Frame the Figma round-trip task, MCP connectivity, target file scope, and write-back risk before executing.',
    templateOverride:
      'Restate the Figma closed-loop task, identify whether this is a design-system sync, screen push, library sync, implementation handoff, or drift audit, confirm Figma MCP connectivity, list the target file keys, node ids, and code paths involved, and propose the smallest reversible execution path before touching any Figma file or repository asset.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
    descriptionOverride:
      'Verify Figma write-back results, library version impact, drift status, and traceability of implementation handoff before sign-off.',
    templateOverride:
      'Verify the current Figma closed-loop output end to end. Re-check that the affected Figma file key and node ids match the intended scope, that no library version was bumped without consent, that drift between code and Figma is recorded, and that every Figma write or implementation handoff has a traceable record (file key, node id, code path, executor, timestamp). Summarize what is confirmed, what is still pending review, and what should be rolled back.',
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'figma-new-file',
    enabled: true,
    name: 'figma-new-file',
    description: 'Bootstrap a new Figma file scaffold from project context with explicit ownership and intent.',
    template:
      'Use the `figma-file-bootstrap` skill for this request. Gather the project goal, target surface, intended owners, and naming conventions, confirm Figma MCP connectivity and write permission, then create a new Figma file scaffold with stated intent, branching policy, and a recorded link between the file key and the originating ContextGo workspace.',
  },
  {
    type: 'custom',
    id: 'figma-push-screen',
    enabled: true,
    name: 'figma-push-screen',
    description: 'Push a code-side page or screen structure into a Figma file as a frame or screen draft.',
    template:
      'Use the `figma-screen-generate` skill for this request. Inspect the target page or screen in code, choose the right Figma file key and parent frame, translate the structural layout into Figma frames with the correct components and tokens, and report back the new node ids, the originating code path, and any structural compromises that the design team should review.',
  },
  {
    type: 'custom',
    id: 'figma-sync-library',
    enabled: true,
    name: 'figma-sync-library',
    description: 'Sync project component library changes into the corresponding Figma library file.',
    template:
      'Use the `figma-library-sync` skill for this request. Diff the recent code-side component additions, removals, and structural changes against the linked Figma library, propose a safe library publish set, never bump library versions without explicit confirmation, and record the resolved file key, node ids, and component lineage in the closed-loop ledger.',
  },
  {
    type: 'custom',
    id: 'figma-sync-rules',
    enabled: true,
    name: 'figma-sync-rules',
    description: 'Sync DESIGN.md, tokens, and theme variables into Figma design system rules.',
    template:
      'Use the `figma-design-system-rules-sync` skill for this request. Read the project DESIGN.md, token files, and theme variables, diff them against the existing Figma design-system rules, propose the minimal rule set to update, surface conflicts that require human judgement, and end with a clear list of what was synced, what is still pending, and what should not be synced automatically.',
  },
  {
    type: 'custom',
    id: 'figma-implement',
    enabled: true,
    name: 'figma-implement',
    description: 'Generate implementation suggestions or code-change drafts from a Figma node, frame, or page.',
    template:
      'Use the `figma-implementation-handoff` skill for this request. Validate the supplied Figma URL, file key, and node id, fetch the structural and token information through Figma MCP, map the design intent to existing code patterns, and produce an implementation suggestion or scoped code-change draft with explicit assumptions, missing-token callouts, and a reviewable handoff record.',
  },
  {
    type: 'custom',
    id: 'figma-audit-drift',
    enabled: true,
    name: 'figma-audit-drift',
    description: 'Audit drift between code-side design system and Figma design system, then output a remediation plan.',
    template:
      'Use the `figma-drift-audit` skill for this request. Compare tokens, components, library version, and screen structure between the code-side design system and the linked Figma files, classify each drift item by severity and direction (code-only, figma-only, divergent), and end with a remediation plan that distinguishes auto-syncable items from items that require explicit design or engineering review.',
  },
] as const;

const EMPTY_SCHEDULE_SEED: WorkspaceAutomationScheduleSeed = {
  conversationSchedules: [],
};

const MARKETING_CREATIVE_STUDIO_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride:
      'Frame the campaign objective, brand context state, audience, channels, and constraints before producing creatives.',
    templateOverride:
      'Restate the marketing task, identify the campaign objective, target audience, channels, and locales, separate brand facts from assumptions, and propose the shortest reliable path before generating any creative output.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
    descriptionOverride:
      'Verify brand consistency, platform spec compliance, copy claims, and review gates before delivery.',
    templateOverride:
      'Verify the current campaign deliverable end to end. Re-check brand context alignment, theme pack consistency, per-platform spec compliance, copy claim substantiation, banned-term and mandatory-phrase coverage, locale variant integrity, and unresolved review gates. Summarize what is grounded, what is assumed, and what still needs operator or legal confirmation.',
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'marketing-normalize-brand',
    enabled: true,
    name: 'normalize-brand',
    description:
      'Normalize raw brand handbooks, official sites, and reference assets into a stable brand context object.',
    template:
      'Use the `marketing-context-normalizer` skill for this request. Inventory and categorize every brand source, distill identity, channel preferences, copy rules, visual primitives, and compliance markers, write the result back into `docs/brand/`, and surface unresolved gaps the operator still needs to confirm.',
  },
  {
    type: 'custom',
    id: 'marketing-build-theme',
    enabled: true,
    name: 'build-theme-pack',
    description:
      'Build a reusable brand theme pack or campaign theme overlay grounded in the normalized brand context.',
    template:
      'Use the `brand-theme-pack` and `marketing-context-normalizer` skills for this request. Decide whether the pack is a base theme or a campaign overlay, assemble palette, typography, motif, composition, and treatment rules from the brand context, map the theme to prioritized channels, write the pack into `docs/brand/themes/<theme-id>/`, and stamp every file with the brand context version.',
  },
  {
    type: 'custom',
    id: 'marketing-generate-ad-creative',
    enabled: true,
    name: 'generate-ad-creative',
    description: 'Generate paid-ad creative variants sized to platform specs from the brand theme pack and brief.',
    template:
      'Use the `ad-creative-builder` and `brand-theme-pack` skills for this request. Confirm the brand context, theme pack, campaign brief, and target channels first, decide the variant matrix, look up per-channel platform specs and tone, generate creative variants for each placement, apply per-vertical recipes when relevant, and flag claims needing proof and compliance gates needing legal review.',
  },
  {
    type: 'custom',
    id: 'marketing-generate-social-batch',
    enabled: true,
    name: 'generate-social-batch',
    description: 'Generate organic social asset batches across channels with per-platform tone and format.',
    template:
      'Use the `social-asset-batch` and `brand-theme-pack` skills for this request. Confirm inputs, decide the batch matrix, plan per-channel format from platform specs and channel tone, generate post variants with hook, caption, hashtags, visual direction, and alt text, sequence the batch by platform priority and stage, and flag review gates the operator must clear before publish.',
  },
  {
    type: 'custom',
    id: 'marketing-pair-visual-copy',
    enabled: true,
    name: 'pair-visual-copy',
    description: 'Pair visual direction and copy into structured deliverables (PDP, email, one-pager, hero KV pack).',
    template:
      'Use the `visual-copy-pairing` and `brand-theme-pack` skills for this request. Pick the module sequence for the surface type, decide claim, body, proof, hero direction, composition, and CTA together per module, resolve hierarchy and the single primary CTA, write the deliverable into `docs/campaigns/<campaign-id>/visual-copy/`, and flag any claims still needing proof or compliance review.',
  },
  {
    type: 'custom',
    id: 'marketing-generate-variant-set',
    enabled: true,
    name: 'generate-variant-set',
    description:
      'Expand an approved campaign deliverable into a structured variant matrix across the axes the brief declares.',
    template:
      'Use the `campaign-variant-generator` skill for this request. Confirm the approved source deliverable and declared axis scope, decide the variant matrix without multiplying axes blindly, generate per-cell variants with explicit source deltas, mark stale variants when the source moved, prefer per-vertical breakdowns when applicable, and flag locale and compliance review gates.',
  },
  {
    type: 'custom',
    id: 'marketing-review-campaign',
    enabled: true,
    name: 'review-campaign',
    description:
      'Run the marketing review checklist on the current campaign batch before handing assets off for publish.',
    template:
      'Walk through `docs/review-checklist.md` for the current campaign batch. Re-check brand alignment, claim substantiation, platform spec compliance, accessibility, banned-term coverage, mandatory-phrase coverage, locale variant integrity, and compliance overlays for regulated categories. End with a clear pass/blocked verdict, the issues that must be fixed before publish, and the items that should route to legal or native review.',
  },
] as const;

const MOTION_STUDIO_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride:
      'Frame the motion brief, channel targets, narrative arc, and reusable assets before scripting any scene.',
    templateOverride:
      'Restate the motion task, identify the channel formats and durations involved, separate hard brand or compliance constraints from creative preferences, and propose the shortest credible storyboard-first workflow before drafting scenes or render configs.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
    descriptionOverride:
      'Verify storyboard fidelity, render integrity, captioning, and channel-format compliance before publishing.',
    templateOverride:
      'Verify the current motion deliverable end to end. Re-check storyboard intent versus rendered output, scene timing, transition continuity, audio and subtitle sync, channel-format compliance, and contact-sheet sampling. Summarize what is locked, what still needs a re-render, and what blocks a confident publish decision.',
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'motion-storyboard-video',
    enabled: true,
    name: 'storyboard-video',
    description: 'Translate a motion brief into a code-driven storyboard with scenes, beats, and channel cutdowns.',
    template:
      'Use the `motion-storyboard` skill for this request. Clarify the motion goal, audience, channel formats, and brand guardrails first, then produce a storyboard with explicit scenes, beats, transitions, audio cues, and reusable scene recipes ready to feed into the render pipeline.',
  },
  {
    type: 'custom',
    id: 'motion-build-poster',
    enabled: true,
    name: 'build-motion-poster',
    description: 'Compose a motion poster with a single dominant idea, looping motion, and channel-ready exports.',
    template:
      'Use the `motion-poster-builder` and `motion-scene-builder` skills for this request. Lock the dominant message and channel placements first, design a single-scene motion poster with looping or short-form motion, define the variant matrix (vertical, square, banner) needed, and prepare the render config so the poster can be exported consistently across required formats.',
  },
  {
    type: 'custom',
    id: 'motion-render-video',
    enabled: true,
    name: 'render-video',
    description: 'Drive a storyboard through the code-driven render pipeline and produce review-ready MP4 outputs.',
    template:
      'Use the `motion-render-ops` and `motion-scene-builder` skills for this request. Validate the storyboard and scene inputs first, generate a reproducible render config, run the code-driven motion pipeline, capture render logs, and emit MP4 outputs plus a contact sheet that maps each scene to a render frame for review.',
  },
  {
    type: 'custom',
    id: 'motion-render-social-cut',
    enabled: true,
    name: 'render-social-cut',
    description: 'Re-cut an existing motion render into platform-specific social cutdowns with caption variants.',
    template:
      'Use the `motion-render-ops` and `motion-poster-builder` skills for this request. Identify the source render and target platforms first, plan the cutdown durations and aspect-ratio variants, regenerate scene timing where needed, run the social-cut render pipeline, and emit per-platform MP4s with the correct caption and end-card treatment.',
  },
  {
    type: 'custom',
    id: 'motion-qc-pass',
    enabled: true,
    name: 'motion-qc',
    description:
      'Run a structured QC pass on rendered motion assets, then return prioritized fixes and rerun guidance.',
    template:
      'Use the `motion-qc` and `motion-render-ops` skills for this request. Sample the contact sheet and key frames first, score the render against the QC rubric (timing, brand, audio, captioning, channel compliance), separate must-fix issues from polish notes, and end with a clear rerun plan or sign-off recommendation.',
  },
] as const;

const HYPERFRAMES_VIDEO_STUDIO_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride:
      'Frame the HyperFrames video job, render environment, source inputs, target format, project paths, and QC risks before authoring.',
    templateOverride:
      'Restate the HyperFrames video request, identify source type (website, article, data, generated media, or custom composition), target channel, dimensions, duration, required text, assets, render environment, workspace paths, and QC risks before creating or editing the composition.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
    descriptionOverride:
      'Verify HyperFrames render manifests, output files, dimensions, duration, subtitles, assets, and QC verdict before delivery.',
    templateOverride:
      'Use the `hyperframes-qc` skill for this request. Verify the current HyperFrames output end to end: manifest exists, render command is recorded, output file exists, dimensions/duration/fps match the brief, subtitles and exact text are readable, assets resolve locally, source lineage is recorded, and the QC verdict is clear before delivery.',
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'hyperframes-video-init',
    enabled: true,
    name: 'video-init',
    description: 'Initialize or normalize a HyperFrames video project in the workspace.',
    template:
      'Use the `hyperframes`, `hyperframes-cli`, `hyperframes-composition`, and `hyperframes-media` skills for this request. Check Node.js 22+, FFmpeg, and package runner availability, create or normalize a project under `docs/videos/projects/`, write the brief under `docs/videos/briefs/`, prepare asset folders, and end with preview/render commands plus missing dependency blockers.',
  },
  {
    type: 'custom',
    id: 'hyperframes-video-preview',
    enabled: true,
    name: 'video-preview',
    description: 'Preview a HyperFrames composition and report layout, timing, and asset issues.',
    template:
      'Use the `hyperframes`, `hyperframes-cli`, `hyperframes-composition`, and `hyperframes-media` skills for this request. Resolve the project path, run or prepare the HyperFrames preview command, inspect source-level layout/timing/asset issues, and report what must be fixed before rendering.',
  },
  {
    type: 'custom',
    id: 'hyperframes-video-render',
    enabled: true,
    name: 'video-render',
    description: 'Render a HyperFrames project to MP4/WebM and write a render manifest.',
    template:
      'Use the `hyperframes-cli` and `hyperframes-qc` skills for this request. Render the selected HyperFrames project into `docs/videos/renders/`, write or refresh a manifest under `docs/videos/manifests/`, preserve the exact render command, then run QC before delivery.',
  },
  {
    type: 'custom',
    id: 'hyperframes-url-to-video',
    enabled: true,
    name: 'url-to-video',
    description: 'Turn a website, landing page, product page, or docs URL into a HyperFrames video.',
    template:
      'Use the `website-to-hyperframes`, `website-to-video`, `hyperframes`, `hyperframes-registry`, `hyperframes-media`, `hyperframes-composition`, `hyperframes-cli`, and `hyperframes-qc` skills for this request. Extract the page hierarchy, plan a short script and scenes, prepare screenshots/assets, build the composition, render it, and QC text, crops, timing, and source fidelity.',
  },
  {
    type: 'custom',
    id: 'hyperframes-article-to-video',
    enabled: true,
    name: 'article-to-video',
    description: 'Turn an article, changelog, docs page, or report into a captioned HyperFrames video.',
    template:
      'Use the `article-to-video`, `hyperframes`, `hyperframes-composition`, `hyperframes-media`, `hyperframes-cli`, and `hyperframes-qc` skills for this request. Distill the source into hook, beats, evidence, and CTA, write exact visible captions, compose scenes, render, and QC factual alignment plus subtitle readability.',
  },
  {
    type: 'custom',
    id: 'hyperframes-data-to-video',
    enabled: true,
    name: 'data-to-video',
    description: 'Turn CSV, JSON, spreadsheet extracts, or report tables into animated chart videos.',
    template:
      'Use the `data-to-video`, `hyperframes`, `hyperframes-registry`, `hyperframes-composition`, `hyperframes-media`, `hyperframes-cli`, and `hyperframes-qc` skills for this request. Classify the data shape, record transformations, choose a chart recipe, animate labels and values, render, and QC units, labels, contrast, and timing.',
  },
  {
    type: 'custom',
    id: 'hyperframes-caption-video',
    enabled: true,
    name: 'caption-video',
    description: 'Add subtitles, title cards, lower thirds, or CTA overlays to a HyperFrames video composition.',
    template:
      'Use the `hyperframes`, `hyperframes-composition`, `hyperframes-media`, and `hyperframes-qc` skills for this request. Normalize captions and timing, add title cards or lower thirds with safe margins, prepare audio/subtitle assets if present, preview, render, and QC subtitle readability and timing.',
  },
  {
    type: 'custom',
    id: 'hyperframes-media-to-video',
    enabled: true,
    name: 'media-to-video',
    description: 'Compose generated images, generated videos, screenshots, and clips into a final HyperFrames video.',
    template:
      'Use the `ai-media-to-hyperframes`, `hyperframes`, `hyperframes-media`, `hyperframes-composition`, `hyperframes-cli`, and `hyperframes-qc` skills for this request. Inventory source assets and any AI Media Studio manifests, reject blocked inputs, plan title/montage/caption/end-card scenes, render the final video, and record source lineage in the render manifest.',
  },
  {
    type: 'custom',
    id: 'hyperframes-video-qc',
    enabled: true,
    name: 'video-qc',
    description: 'Run structured QC on HyperFrames render outputs and manifests.',
    template:
      'Use the `hyperframes-qc` skill for this request. Validate manifest, project path, output file, dimensions, duration, fps, exact text, subtitles, assets, audio, rights notes, and source lineage, then write a QC report under `docs/videos/qc/` with pass, pass-with-notes, rerender-required, or blocked verdict.',
  },
  {
    type: 'custom',
    id: 'hyperframes-video-package',
    enabled: true,
    name: 'video-package',
    description: 'Package a HyperFrames render with source, manifest, assets, and QC report for handoff.',
    template:
      'Use the `hyperframes-cli`, `hyperframes-media`, and `hyperframes-qc` skills for this request. Collect the project path, render output, manifest, key assets, source notes, and QC report, verify no required files are missing, and produce a handoff summary with rerender instructions.',
  },
] as const;

const HYPERFRAMES_VIDEO_STUDIO_SCHEDULE_SEED: WorkspaceAutomationScheduleSeed = {
  conversationSchedules: [
    {
      id: 'hyperframes-weekly-video-draft',
      name: 'HyperFrames weekly video draft',
      enabled: false,
      schedule: {
        kind: 'cron',
        expr: '0 10 * * 1',
        description: 'Mondays at 10:00',
      },
      message:
        'Use the `article-to-video`, `website-to-video`, or `data-to-video` skill depending on the newest workspace source. Draft one HyperFrames video candidate from recent changelog, docs, website, report, or data updates; write the brief under `docs/videos/briefs/` and stop before render unless the source is already approved.',
      conversationId: 'hyperframes-weekly-video-draft-template',
      conversationTitle: 'HyperFrames Weekly Video Draft',
      agentType: 'codex',
      createdBy: 'agent',
    },
    {
      id: 'hyperframes-weekly-render-qc',
      name: 'HyperFrames weekly render QC audit',
      enabled: false,
      schedule: {
        kind: 'cron',
        expr: '0 16 * * 5',
        description: 'Fridays at 16:00',
      },
      message:
        'Use the `hyperframes-qc` and `hyperframes-cli` skills. Audit `docs/videos/projects/`, `docs/videos/renders/`, `docs/videos/manifests/`, and `docs/videos/qc/`; report missing manifests, stale renders, missing local assets, dependency blockers, and outputs that need rerendering.',
      conversationId: 'hyperframes-weekly-render-qc-template',
      conversationTitle: 'HyperFrames Weekly Render QC Audit',
      agentType: 'codex',
      createdBy: 'agent',
    },
  ],
};

const REMOTION_VIDEO_STUDIO_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride:
      'Frame the Remotion brief, composition contract, asset sources, render target, and license risks before authoring TSX.',
    templateOverride:
      'Restate the Remotion task, identify target dimensions, fps, duration, composition ids, parameterization needs, Infermesh or source assets, output format, and license or credential risks. Propose the shortest Remotion-native workflow before editing project files or rendering.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
    descriptionOverride:
      'Verify Remotion render integrity, props, assets, captions, license status, and rerender reproducibility.',
    templateOverride:
      'Use the `remotion-qc` and `remotion-render-ops` skills for this request. Verify output dimensions, fps, duration, visible text, representative frames, audio, captions, Infermesh asset lineage, Remotion license status, and rerender command reproducibility before declaring the render ready.',
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'remotion-init',
    enabled: true,
    name: 'remotion-init',
    description: 'Bootstrap or normalize a Remotion project for a workspace video brief.',
    template:
      'Use the `remotion-project-bootstrap` and `remotion-best-practices` skills for this request. Confirm project id, package manager, target dimensions, fps, duration, scripts, and workspace paths, then scaffold or normalize the Remotion project and write project notes under `docs/videos/remotion/projects/`.',
  },
  {
    type: 'custom',
    id: 'remotion-studio',
    enabled: true,
    name: 'remotion-studio',
    description: 'Prepare or run Remotion Studio preview for a composition.',
    template:
      'Use the `remotion-render-ops` skill for this request. Verify dependencies, identify the composition id and props, start or prepare Remotion Studio, and capture preview findings before a still check or full render.',
  },
  {
    type: 'custom',
    id: 'remotion-still-check',
    enabled: true,
    name: 'remotion-still-check',
    description: 'Render representative still frames before a full Remotion render.',
    template:
      'Use the `remotion-render-ops` and `remotion-qc` skills for this request. Pick representative frames from the scene map, run still checks for the target composition and props, inspect for blank frames, missing assets, text mistakes, and layout overflow, then record findings in the render manifest.',
  },
  {
    type: 'custom',
    id: 'remotion-render',
    enabled: true,
    name: 'remotion-render',
    description: 'Run a local Remotion render and write a reproducible manifest.',
    template:
      'Use the `remotion-render-ops` skill for this request. Confirm still checks passed, run the local render with explicit composition id and input props, name the output deterministically, collect logs, and write or update the render manifest.',
  },
  {
    type: 'custom',
    id: 'remotion-ssr-render',
    enabled: true,
    name: 'remotion-ssr-render',
    description: 'Build or run an @remotion/renderer SSR workflow for parameterized video rendering.',
    template:
      'Use the `remotion-render-ops` and `remotion-composition` skills for this request. Separate browser Player code from server renderer code, wire typed props, run or draft the @remotion/renderer path, and record bundle, composition, props, output, and logs in the manifest.',
  },
  {
    type: 'custom',
    id: 'remotion-player-app',
    enabled: true,
    name: 'remotion-player-app',
    description: 'Embed Remotion Player into a React/Vite/Next preview or product surface.',
    template:
      'Use the `remotion-player-app` and `remotion-composition` skills for this request. Define the Player props contract, keep renderer APIs out of the browser bundle, add preview controls appropriate to the product surface, and document how Player preview differs from final render.',
  },
  {
    type: 'custom',
    id: 'remotion-captions',
    enabled: true,
    name: 'remotion-captions',
    description: 'Prepare captions, transcription imports, and caption rendering for a Remotion composition.',
    template:
      'Use the `remotion-captions` and `remotion-best-practices` skills for this request. Identify caption source, normalize SRT/VTT/JSON or Infermesh STT output, apply Remotion caption display rules, and verify timing and legibility in still checks and QC.',
  },
  {
    type: 'custom',
    id: 'remotion-ai-media',
    enabled: true,
    name: 'remotion-ai-media',
    description: 'Consume Infermesh / AI Media Studio generated assets in a Remotion project with lineage.',
    template:
      'Use the `remotion-ai-media` skill for this request. Treat Infermesh / AI Media Studio as the generation gateway, copy or reference generated assets into the Remotion project public assets, record task/model/source lineage under `docs/videos/remotion/assets/`, and link the asset ledger from the render manifest.',
  },
  {
    type: 'custom',
    id: 'remotion-lambda-plan',
    enabled: true,
    name: 'remotion-lambda-plan',
    description: 'Plan Remotion Lambda rendering requirements without deploying by default.',
    template:
      'Use the `remotion-lambda` and `remotion-render-ops` skills for this request. Confirm the user explicitly wants cloud rendering, then plan AWS account, region, permissions, Remotion license readiness, deployment steps, expected cost factors, and rollback. Do not deploy until the user confirms.',
  },
  {
    type: 'custom',
    id: 'remotion-qc',
    enabled: true,
    name: 'remotion-qc',
    description: 'Run Remotion output QC before publish or handoff.',
    template:
      'Use the `remotion-qc` skill for this request. Check output file, dimensions, fps, duration, visible text, representative frames, audio, captions, generated asset lineage, license risks, and rerender reproducibility. Return pass, warn, or blocked with exact next steps.',
  },
  {
    type: 'custom',
    id: 'remotion-package',
    enabled: true,
    name: 'remotion-package',
    description: 'Package Remotion source, assets, manifests, renders, and QC notes for handoff.',
    template:
      'Use the `remotion-render-ops`, `remotion-ai-media`, and `remotion-qc` skills for this request. Gather source paths, render outputs, manifests, asset ledgers, license notes, QC report, and rerender commands into a handoff summary without copying secrets.',
  },
] as const;

const REMOTION_VIDEO_STUDIO_SCHEDULE_SEED: WorkspaceAutomationScheduleSeed = {
  conversationSchedules: [
    {
      id: 'remotion-weekly-video-draft',
      name: 'Weekly Remotion video draft',
      enabled: false,
      schedule: {
        kind: 'cron',
        expr: '0 10 * * 1',
        description: 'Every Monday at 10:00',
      },
      message:
        'Use the Remotion Video Studio package to scan the latest workspace context, propose one draft video brief, identify needed Infermesh assets, and stop before editing or rendering unless approved.',
      conversationId: 'builtin-remotion-weekly-video-draft',
      conversationTitle: 'Weekly Remotion Video Draft',
      agentType: 'codex',
      createdBy: 'agent',
    },
    {
      id: 'remotion-render-qc-audit',
      name: 'Remotion render QC audit',
      enabled: false,
      schedule: {
        kind: 'cron',
        expr: '0 16 * * 5',
        description: 'Every Friday at 16:00',
      },
      message:
        'Use the `remotion-qc` skill to audit recent Remotion render manifests and QC reports, then summarize blocked renders, stale rerender commands, missing asset lineage, and license risks.',
      conversationId: 'builtin-remotion-render-qc-audit',
      conversationTitle: 'Remotion Render QC Audit',
      agentType: 'codex',
      createdBy: 'agent',
    },
    {
      id: 'remotion-template-asset-freshness',
      name: 'Remotion asset and template freshness',
      enabled: false,
      schedule: {
        kind: 'cron',
        expr: '0 11 1 * *',
        description: 'On the first day of each month at 11:00',
      },
      message:
        'Use the Remotion Video Studio package to review project templates, generated asset ledgers, source paths, and package scripts for staleness. Report refresh recommendations only.',
      conversationId: 'builtin-remotion-template-asset-freshness',
      conversationTitle: 'Remotion Asset Freshness',
      agentType: 'codex',
      createdBy: 'agent',
    },
  ],
};

const VISUAL_ARTIFACT_RUNNER_COMMAND_SEEDS: readonly WorkspaceCommandSeed[] = [
  {
    type: 'builtin',
    id: 'plan',
    enabled: true,
    descriptionOverride:
      'Frame the visual artifact request, classify the input shape, target artifact type, and audience before drafting.',
    templateOverride:
      'Restate the artifact request, identify the input shape (brief, report, PDF, structured data, theme override), the target artifact type (deck, PDF, infographic, handout), and the audience constraints, then propose the shortest credible execution path before generating the artifact.',
  },
  {
    type: 'builtin',
    id: 'tdd',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'code-review',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'security',
    enabled: false,
  },
  {
    type: 'builtin',
    id: 'verify',
    enabled: true,
    descriptionOverride:
      'Verify the produced artifact against pre-export and post-export QC checks, and surface any blocked failures or theme drift.',
    templateOverride:
      'Verify the produced visual artifact end to end using the artifact-qc skill. Re-run pre-export checks (font, image, overflow, hierarchy, theme tokens), refresh build-notes.md, assets.json, and failures.json, and call out any blocked failures, warnings, or theme drift before the artifact is shipped.',
  },
  {
    type: 'builtin',
    id: 'orchestrate',
    enabled: false,
  },
  {
    type: 'custom',
    id: 'var-deck-from-brief',
    enabled: true,
    name: 'deck-from-brief',
    description: 'Turn a brief into a deck artifact with normalized inputs, recipe, theme, build note, and QC.',
    template:
      'Use the `deck-from-brief` skill for this request. Normalize the brief, choose the smallest deck recipe that still expresses every key message, apply the theme, default to the pptx-static export mode, and produce the artifact alongside build-notes.md, assets.json, and failures.json. Hand off to morph-ppt only when narrative motion is explicitly required.',
  },
  {
    type: 'custom',
    id: 'var-deck-from-pdf',
    enabled: true,
    name: 'deck-from-pdf',
    description: 'Convert a PDF into a deck, choosing summary distillation or visual reconstruction with QC.',
    template:
      'Use the `pdf-to-deck` skill for this request. Classify the PDF as summary distillation or visual reconstruction first, record the decision in build-notes.md, extract content with citations, choose the recipe and theme, default to the pptx-static export mode, and produce the artifact alongside build-notes.md, assets.json, and failures.json.',
  },
  {
    type: 'custom',
    id: 'var-artifact-infographic',
    enabled: true,
    name: 'artifact-infographic',
    description: 'Turn a report or structured data input into an infographic with chart-family discipline.',
    template:
      'Use the `report-to-infographic` skill for this request. Detect the dominant data shape, choose the matching infographic recipe, apply the theme, default to the infographic export mode, run pre-export QC with attention to chart overflow and label legibility, and emit build-notes.md, assets.json, and failures.json.',
  },
  {
    type: 'custom',
    id: 'var-artifact-theme',
    enabled: true,
    name: 'artifact-theme',
    description: 'Apply or refresh a visual theme on an existing artifact spec without changing its recipe.',
    template:
      'Use the `deck-theme-apply` skill for this request. Validate the existing artifact spec carries a recipe, resolve the new theme tokens, apply them without touching content, re-run pre-export QC, re-export in the original mode, and update build-notes.md, assets.json, and failures.json with the prior theme id, the new theme id, and any QC findings introduced by the theme change.',
  },
  {
    type: 'custom',
    id: 'var-artifact-qc',
    enabled: true,
    name: 'artifact-qc',
    description: 'Run pre-export and post-export QC on a produced artifact and report blocked failures and drift.',
    template:
      'Use the `artifact-qc` skill for this request. Inspect the artifact, run the relevant pre-export and post-export checks from the visual-artifact-runner package, refresh build-notes.md, assets.json, and failures.json, and return a concise QC report listing block failures, warnings, and any theme or recipe drift.',
  },
] as const;

const WORKSPACE_AUTOMATION_PROFILE_DEFINITIONS: Record<
  AgentPackageWorkspaceAutomationProfile,
  WorkspaceAutomationProfileDefinition
> = {
  'contextgo-harness': {
    label: 'ContextGo Harness',
    commandSeeds: CONTEXTGO_HARNESS_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
  'everything-claude-code': {
    label: 'Everything Claude Code',
    commandSeeds: CLAUDE_ECC_LEGACY_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
  'startup-strategist': {
    label: 'Startup Strategist',
    commandSeeds: STARTUP_STRATEGIST_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
  'design-director': {
    label: 'Design Director',
    commandSeeds: DESIGN_DIRECTOR_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
  'figma-closed-loop': {
    label: 'Figma Closed Loop',
    commandSeeds: FIGMA_CLOSED_LOOP_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
  'pm-workbench': {
    label: 'PM Workbench',
    commandSeeds: PM_WORKBENCH_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
  'office-analyst': {
    label: 'Office Analyst',
    commandSeeds: OFFICE_ANALYST_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
  'finance-analyst': {
    label: 'Finance Analyst',
    commandSeeds: FINANCE_ANALYST_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
  'marketing-creative-studio': {
    label: 'Marketing Creative Studio',
    commandSeeds: MARKETING_CREATIVE_STUDIO_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
  'motion-studio': {
    label: 'Motion Studio',
    commandSeeds: MOTION_STUDIO_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
  'hyperframes-video-studio': {
    label: 'HyperFrames Video Studio',
    commandSeeds: HYPERFRAMES_VIDEO_STUDIO_COMMAND_SEEDS,
    scheduleSeed: HYPERFRAMES_VIDEO_STUDIO_SCHEDULE_SEED,
  },
  'remotion-video-studio': {
    label: 'Remotion Video Studio',
    commandSeeds: REMOTION_VIDEO_STUDIO_COMMAND_SEEDS,
    scheduleSeed: REMOTION_VIDEO_STUDIO_SCHEDULE_SEED,
  },
  'visual-artifact-runner': {
    label: 'Visual Artifact Runner',
    commandSeeds: VISUAL_ARTIFACT_RUNNER_COMMAND_SEEDS,
    scheduleSeed: EMPTY_SCHEDULE_SEED,
  },
};

export const getWorkspaceAutomationProfileDefinition = (
  profile: AgentPackageWorkspaceAutomationProfile | undefined
): WorkspaceAutomationProfileDefinition | null => {
  if (!profile) {
    return null;
  }

  return WORKSPACE_AUTOMATION_PROFILE_DEFINITIONS[profile] ?? null;
};

export const getWorkspaceAutomationProfileLabel = (
  profile: AgentPackageWorkspaceAutomationProfile | undefined
): string | undefined => {
  return getWorkspaceAutomationProfileDefinition(profile)?.label;
};

export const getWorkspaceCommandSeedKind = (seed: WorkspaceCommandSeed): 'builtin' | 'custom' => {
  return seed.type;
};

export const materializeWorkspaceCommandSeed = (
  seed: WorkspaceCommandSeed,
  resolveText?: SlashCommandTranslationResolver
): ManagedSlashCommandRecord => {
  if (seed.type === 'builtin') {
    return createManagedSlashCommandFromBuiltin(
      {
        builtinId: seed.id,
        enabled: seed.enabled,
        description: seed.descriptionOverride,
        template: seed.templateOverride,
      },
      resolveText
    );
  }

  return {
    id: seed.id,
    enabled: seed.enabled,
    name: seed.name,
    description: seed.description,
    template: seed.template,
  };
};

export const materializeWorkspaceCommandLibrary = (
  seeds: readonly WorkspaceCommandSeed[],
  resolveText?: SlashCommandTranslationResolver
): ManagedSlashCommandRecord[] => {
  return seeds.map((seed) => materializeWorkspaceCommandSeed(seed, resolveText));
};
