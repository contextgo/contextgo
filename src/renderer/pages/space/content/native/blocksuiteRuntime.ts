export type ContextGoNativeCanvasMount = {
  destroy: () => void;
};

export type ContextGoNativeCanvasRuntime = {
  source: 'blocksuite-package' | 'local-affine-source';
  mountCanvas: (params: {
    container: HTMLElement;
    spaceId: string;
    boardId?: string;
    selectionSummary?: string;
  }) => Promise<ContextGoNativeCanvasMount> | ContextGoNativeCanvasMount;
};

export type ContextGoNativeCanvasProbeResult =
  | {
      status: 'available';
      runtime: ContextGoNativeCanvasRuntime;
      detail: string;
    }
  | {
      status: 'unavailable';
      detail: string;
    };

async function tryLoadInstalledBlocksuite(): Promise<ContextGoNativeCanvasRuntime | null> {
  try {
    const candidate = (await import(/* @vite-ignore */ '@blocksuite/affine/all')) as Record<string, unknown>;
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    return {
      source: 'blocksuite-package',
      mountCanvas: async ({ container, spaceId, boardId, selectionSummary }) => {
        container.innerHTML = '';
        const shell = document.createElement('div');
        shell.className = 'h-full w-full flex flex-col items-start justify-start bg-[var(--color-bg-1)]';
        shell.innerHTML = `
          <div style="padding:16px;border-bottom:1px solid var(--border-base);width:100%;box-sizing:border-box;">
            <div style="font-weight:600;">ContextGo Native Canvas Runtime</div>
            <div style="font-size:12px;opacity:.72;margin-top:4px;">Blocksuite package detected. Native mount hook is ready for real editor bootstrapping.</div>
            <div style="font-size:12px;opacity:.72;margin-top:8px;">spaceId=${spaceId}${boardId ? ` · boardId=${boardId}` : ''}</div>
            ${selectionSummary ? `<div style="font-size:12px;opacity:.72;margin-top:4px;">selection=${selectionSummary}</div>` : ''}
          </div>
          <div style="padding:20px;font-size:13px;opacity:.75;">Next step: replace this placeholder mount with real Blocksuite/edgeless initialization.</div>
        `;
        container.appendChild(shell);
        return {
          destroy: () => {
            container.innerHTML = '';
          },
        };
      },
    };
  } catch {
    return null;
  }
}

export async function probeContextGoNativeCanvasRuntime(
  _localSourcePath?: string
): Promise<ContextGoNativeCanvasProbeResult> {
  const installedRuntime = await tryLoadInstalledBlocksuite();
  if (installedRuntime) {
    return {
      status: 'available',
      runtime: installedRuntime,
      detail: 'Blocksuite package detected in current runtime.',
    };
  }

  return {
    status: 'unavailable',
    detail:
      'Native canvas runtime is not yet attached to the current build. Keep using the current content surface until Blocksuite code is absorbed into this renderer.',
  };
}
