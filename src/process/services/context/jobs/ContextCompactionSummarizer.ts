/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientFactory } from '@/common/api/ClientFactory';
import type { IProvider, TProviderWithModel } from '@/common/config/storage';
import { ProcessConfig } from '@process/utils/initStorage';
import type { ContextJob, SessionCompactionSnapshot } from '../contextDomain';

export type StructuredCompactionSummary = {
  currentTask?: string;
  stableStrategies: readonly string[];
  failureModes: readonly string[];
  pendingConstraints: readonly string[];
};

export type CompactionSummaryInput = {
  job: ContextJob;
  snapshot: SessionCompactionSnapshot;
  signalKinds: readonly string[];
  promotedSummaries: readonly string[];
  pendingSummaries: readonly string[];
  decision: {
    pressure: number;
    strategy: string;
    shouldCompact: boolean;
    rationale: readonly string[];
  };
};

type ChatCompletionLike = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

const SUMMARY_MODEL_MAX_ITEMS = 4;

function normalizeLine(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  return normalized ? normalized : undefined;
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
  const normalized = values.map((value) => normalizeLine(value)).filter((value): value is string => Boolean(value));
  return Array.from(new Set(normalized));
}

function mapSignalToFailureMode(signalKind: string): string | undefined {
  switch (signalKind) {
    case 'user_interrupt':
      return 'Long or low-confidence runs are getting interrupted before the user sees a satisfying result.';
    case 'repeated_request':
      return 'The user is repeating the ask, which means the previous response did not close the task.';
    case 'strategy_shift':
      return 'The implementation strategy changed mid-session, so older plans may now be stale.';
    case 'tool_failure_cluster':
      return 'Tool failures are clustering and should be isolated from the main task path.';
    default:
      return undefined;
  }
}

function buildFallbackSummary(input: CompactionSummaryInput): StructuredCompactionSummary {
  const stableStrategies = uniqueStrings(input.promotedSummaries).slice(0, SUMMARY_MODEL_MAX_ITEMS);
  const pendingConstraints = uniqueStrings(input.pendingSummaries).slice(0, SUMMARY_MODEL_MAX_ITEMS);
  const failureModes = uniqueStrings([
    ...input.signalKinds.map((signalKind) => mapSignalToFailureMode(signalKind)),
    input.snapshot.lastAssistantOutcome && /fail|error|blocked|retry|timeout/i.test(input.snapshot.lastAssistantOutcome)
      ? `Recent assistant outcome indicates execution friction: ${input.snapshot.lastAssistantOutcome}`
      : undefined,
  ]).slice(0, SUMMARY_MODEL_MAX_ITEMS);

  return {
    currentTask: normalizeLine(input.snapshot.lastUserGoal) ?? stableStrategies[0] ?? pendingConstraints[0],
    stableStrategies,
    failureModes,
    pendingConstraints,
  };
}

function selectProvider(providers: readonly IProvider[]): TProviderWithModel | undefined {
  for (const provider of providers) {
    if (provider.enabled === false || !provider.apiKey?.trim()) {
      continue;
    }

    const enabledModels = (provider.model || []).filter((model) => provider.modelEnabled?.[model] !== false);
    const useModel = enabledModels[0];
    if (!useModel) {
      continue;
    }

    return {
      ...provider,
      useModel,
    };
  }

  return undefined;
}

function extractJsonObject(value: string): string | undefined {
  const fencedMatch = value.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = value.indexOf('{');
  const lastBrace = value.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return undefined;
  }

  return value.slice(firstBrace, lastBrace + 1).trim();
}

function readChatContent(response: ChatCompletionLike): string | undefined {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (typeof part === 'object' && part !== null && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .filter(Boolean);
    return textParts.join('\n').trim() || undefined;
  }

  return undefined;
}

function parseStructuredSummary(raw: string): StructuredCompactionSummary | undefined {
  const json = extractJsonObject(raw);
  if (!json) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(json) as Partial<StructuredCompactionSummary>;
    return {
      currentTask: normalizeLine(parsed.currentTask),
      stableStrategies: uniqueStrings(parsed.stableStrategies || []).slice(0, SUMMARY_MODEL_MAX_ITEMS),
      failureModes: uniqueStrings(parsed.failureModes || []).slice(0, SUMMARY_MODEL_MAX_ITEMS),
      pendingConstraints: uniqueStrings(parsed.pendingConstraints || []).slice(0, SUMMARY_MODEL_MAX_ITEMS),
    };
  } catch {
    return undefined;
  }
}

function buildPrompt(input: CompactionSummaryInput): string {
  const stableTakeaways = input.promotedSummaries.length > 0 ? input.promotedSummaries.join('\n- ') : 'None';
  const pendingTakeaways = input.pendingSummaries.length > 0 ? input.pendingSummaries.join('\n- ') : 'None';
  const signalList = input.signalKinds.length > 0 ? input.signalKinds.join(', ') : 'none';

  return [
    'Summarize the session into structured runtime context for future turns.',
    'Return JSON only with keys: currentTask, stableStrategies, failureModes, pendingConstraints.',
    'Rules:',
    '- currentTask should be one short sentence for the active user goal.',
    '- stableStrategies should contain durable strategies that should be reused next turn.',
    '- failureModes should capture recurring friction or breakdown patterns, not one-off noise.',
    '- pendingConstraints should capture unresolved constraints, approvals, or guardrails that still need confirmation.',
    '- Keep each list item under 160 characters.',
    '',
    `Last user goal: ${input.snapshot.lastUserGoal || 'unknown'}`,
    `Last assistant outcome: ${input.snapshot.lastAssistantOutcome || 'unknown'}`,
    `Signal kinds: ${signalList}`,
    `Compaction pressure: ${input.decision.pressure}`,
    `Decision strategy: ${input.decision.strategy}`,
    `Decision rationale: ${input.decision.rationale.join(', ') || 'none'}`,
    '',
    'Promoted stable takeaways:',
    `- ${stableTakeaways}`,
    '',
    'Pending review takeaways:',
    `- ${pendingTakeaways}`,
  ].join('\n');
}

export class ContextCompactionSummarizer {
  constructor(
    private readonly providerLoader: () => Promise<TProviderWithModel | undefined> = async () => {
      const providers = (await ProcessConfig.get('model.config')) as IProvider[] | undefined;
      return selectProvider(Array.isArray(providers) ? providers : []);
    }
  ) {}

  async summarize(input: CompactionSummaryInput): Promise<StructuredCompactionSummary> {
    const fallback = buildFallbackSummary(input);
    const provider: TProviderWithModel | undefined = await this.providerLoader().catch(
      (): TProviderWithModel | undefined => undefined
    );
    if (!provider) {
      return fallback;
    }

    try {
      const client = await ClientFactory.createRotatingClient(provider, {
        timeout: 20_000,
      });
      const response = (await client.createChatCompletion({
        model: provider.useModel,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are ContextGo compaction agent. Abstract durable session context for future turns. Output JSON only.',
          },
          {
            role: 'user',
            content: buildPrompt(input),
          },
        ],
      })) as ChatCompletionLike;
      const parsed = parseStructuredSummary(readChatContent(response) || '');
      if (!parsed) {
        return fallback;
      }

      return {
        currentTask: parsed.currentTask || fallback.currentTask,
        stableStrategies: parsed.stableStrategies.length > 0 ? parsed.stableStrategies : fallback.stableStrategies,
        failureModes: parsed.failureModes.length > 0 ? parsed.failureModes : fallback.failureModes,
        pendingConstraints:
          parsed.pendingConstraints.length > 0 ? parsed.pendingConstraints : fallback.pendingConstraints,
      };
    } catch {
      return fallback;
    }
  }
}
