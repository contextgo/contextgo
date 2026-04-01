export type ContextGoDocBlockPayload = {
  title: string;
  markdown: string;
  preview?: string;
};

export type ContextGoBoardCardPayload = {
  title: string;
  markdown: string;
  preview?: string;
};

function buildPreview(markdown: string): string | undefined {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');
}

export function buildContextGoDocPayloadFromMarkdown(params: {
  title: string;
  markdown: string;
}): ContextGoDocBlockPayload {
  return {
    title: params.title,
    markdown: params.markdown,
    preview: buildPreview(params.markdown),
  };
}

export function buildContextGoBoardPayloadFromMarkdown(params: {
  title: string;
  markdown: string;
}): ContextGoBoardCardPayload {
  return {
    title: params.title,
    markdown: params.markdown,
    preview: buildPreview(params.markdown),
  };
}
