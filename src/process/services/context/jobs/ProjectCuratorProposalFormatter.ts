/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export function formatProjectCuratorProposal(input: {
  title: string;
  targetPath: string;
  summary: string;
  evidence: readonly string[];
  additions: readonly string[];
}): string {
  return [
    '<!-- contextgo-generated -->',
    '',
    `# ${input.title}`,
    '',
    `- Target: \`${input.targetPath}\``,
    `- Summary: ${input.summary}`,
    '',
    '## Evidence',
    '',
    ...(input.evidence.length > 0 ? input.evidence.map((item) => `- ${item}`) : ['- No evidence captured.']),
    '',
    '## Proposed Additions',
    '',
    ...(input.additions.length > 0 ? input.additions.map((item) => `- ${item}`) : ['- No additions proposed.']),
    '',
  ].join('\n');
}
