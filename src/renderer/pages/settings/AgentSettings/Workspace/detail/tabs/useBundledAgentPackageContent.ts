import { ipcBridge } from '@/common';
import type { AssistantPackageDocTreeNode, AssistantPackageDocument, AssistantWorkspaceModel } from '../../types';
import { buildDocTree, toDocumentTitle } from '../../viewModel';
import { useEffect, useMemo, useState } from 'react';

type BundledAgentPackageContentState = {
  agentsDocument: AssistantPackageDocument | null;
  docs: AssistantPackageDocument[];
  docsTree: AssistantPackageDocTreeNode[];
};

const toDocument = (document: AssistantPackageDocument): AssistantPackageDocument => ({
  ...document,
  title: toDocumentTitle(document),
});

const buildInitialState = (model: AssistantWorkspaceModel): BundledAgentPackageContentState => ({
  agentsDocument: model.agentsDocument ? toDocument(model.agentsDocument) : null,
  docs: model.docs.map(toDocument),
  docsTree: model.docsTree,
});

export const useBundledAgentPackageContent = (
  assistantId: string,
  model: AssistantWorkspaceModel
): BundledAgentPackageContentState => {
  const [state, setState] = useState<BundledAgentPackageContentState>(() => buildInitialState(model));

  useEffect(() => {
    setState(buildInitialState(model));

    if (!model.packageManifest) {
      return;
    }

    let cancelled = false;

    void ipcBridge.fs.readBundledAgentPackageContent
      .invoke({ assistantId })
      .then((result) => {
        if (!result.success || cancelled || !result.data) {
          return;
        }

        const agentsDocument = result.data.agentsDocument ? toDocument(result.data.agentsDocument) : null;
        const docs = result.data.docs.map(toDocument);

        setState({
          agentsDocument,
          docs,
          docsTree: buildDocTree(docs),
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error('[useBundledAgentPackageContent] Failed to load package content:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assistantId, model.packageManifest?.packageId, model.agentsDocument, model.docs, model.docsTree]);

  return useMemo(() => state, [state]);
};
