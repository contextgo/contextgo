export type AffineDocBlockPayload = {
  type: 'affine:page';
  title: string;
  blocks: Array<{
    flavour: 'affine:paragraph' | 'affine:list';
    text: string;
    props?: Record<string, unknown>;
  }>;
};

export type AffineBoardCardPayload = {
  type: 'affine:edgeless-note';
  title: string;
  markdown: string;
  preview: string;
};

function normalizeMarkdown(markdown: string): string[] {
  return markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildPreview(markdown: string): string {
  return normalizeMarkdown(markdown).slice(0, 3).join(' · ');
}

export function buildAffineDocPayloadFromMarkdown(params: { title: string; markdown: string }): AffineDocBlockPayload {
  const lines = normalizeMarkdown(params.markdown);
  const blocks = lines.map((line) => {
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return {
        flavour: 'affine:list' as const,
        text: line.replace(/^[-*]\s+/, ''),
        props: { type: 'bulleted' },
      };
    }

    return {
      flavour: 'affine:paragraph' as const,
      text: line.replace(/^#+\s+/, ''),
    };
  });

  return {
    type: 'affine:page',
    title: params.title,
    blocks,
  };
}

export function buildAffineBoardPayloadFromMarkdown(params: { title: string; markdown: string }): AffineBoardCardPayload {
  return {
    type: 'affine:edgeless-note',
    title: params.title,
    markdown: params.markdown,
    preview: buildPreview(params.markdown),
  };
}
