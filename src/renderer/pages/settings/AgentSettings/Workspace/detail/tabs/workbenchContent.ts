export const toCodeFence = (content: string, language = 'text'): string => {
  const normalized = content.replace(/\r\n/g, '\n').trimEnd();
  return `\`\`\`${language}\n${normalized}\n\`\`\``;
};

export const formatInlineList = (items: readonly string[] | undefined, fallback: string): string => {
  if (!items || items.length === 0) {
    return fallback;
  }

  return items.join(', ');
};

export const stripUndefinedDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)])
    );
  }

  return value;
};

export const toPrettyJson = (value: unknown): string => {
  return JSON.stringify(stripUndefinedDeep(value), null, 2);
};
