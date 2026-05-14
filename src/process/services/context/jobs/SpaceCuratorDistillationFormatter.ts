/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export function formatSpaceCuratorProfileMemory(input: {
  title: string;
  summary: string;
  bullets: readonly string[];
  detail?: string;
}): string {
  return [
    '<!-- contextgo-generated -->',
    '',
    `# ${input.title}`,
    '',
    `- Summary: ${input.summary}`,
    '',
    '## Stable Signals',
    '',
    ...(input.bullets.length > 0 ? input.bullets.map((item) => `- ${item}`) : ['- No stable signals yet.']),
    '',
    input.detail ? ['## Detail', '', input.detail, ''].join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatConnectorDigestEntry(input: {
  title: string;
  summary: string;
  bullets: readonly string[];
  detail?: string;
}): string {
  return [
    `### ${input.title}`,
    '',
    `- ${input.summary}`,
    ...input.bullets.map((item) => `- ${item}`),
    input.detail ? ['', input.detail] : [],
  ]
    .flat()
    .join('\n');
}
