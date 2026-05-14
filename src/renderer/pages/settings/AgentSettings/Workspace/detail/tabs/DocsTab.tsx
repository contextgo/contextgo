import MarkdownView from '@/renderer/components/Markdown';
import { Button } from '@arco-design/web-react';
import type { AssistantPackageDocTreeNode, AssistantPackageDocument, AssistantWorkspaceModel } from '../../types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import styles from '../../AssistantWorkspace.module.css';

type DocsTabProps = {
  model: AssistantWorkspaceModel;
  docs?: AssistantPackageDocument[];
  docsTree?: AssistantPackageDocTreeNode[];
};

type DocTreeProps = {
  nodes: AssistantPackageDocTreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
};

const DocTree: React.FC<DocTreeProps> = ({ nodes, selectedPath, onSelect }) => {
  return (
    <div className={styles.docTree}>
      {nodes.map((node) => (
        <div key={node.id}>
          {node.path ? (
            <Button
              className={
                selectedPath === node.path ? `${styles.itemButton} ${styles.itemButtonActive}` : styles.itemButton
              }
              onClick={() => onSelect(node.path!)}
            >
              <div className={styles.itemTitle}>{node.label}</div>
            </Button>
          ) : (
            <div className={styles.itemTitle}>{node.label}</div>
          )}
          {node.children.length > 0 ? (
            <div className={styles.docTreeChild}>
              <DocTree nodes={node.children} selectedPath={selectedPath} onSelect={onSelect} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};

const DocsTab: React.FC<DocsTabProps> = ({ model, docs, docsTree }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const resolvedDocs = docs ?? model.docs;
  const resolvedDocsTree = docsTree ?? model.docsTree;
  const selectedDocPath = searchParams.get('doc') ?? resolvedDocs[0]?.relativePath ?? null;
  const selectedDoc =
    resolvedDocs.find((document) => document.relativePath === selectedDocPath) ?? resolvedDocs[0] ?? null;

  if (resolvedDocs.length === 0) {
    return (
      <div className={styles.emptyState}>
        {t('settings.agentWorkspaceDocsEmpty', {
          defaultValue: 'This package does not include additional docs.',
        })}
      </div>
    );
  }

  const updateSelectedDoc = (path: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('doc', path);
    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <div className={styles.tabShell}>
      <aside className={styles.indexPane}>
        <div className={styles.paneToolbar}>
          <div>
            <div className={styles.paneTitle}>{t('settings.agentWorkspaceDocsTab', { defaultValue: 'Docs' })}</div>
            <div className={styles.paneDescription}>
              {t('settings.agentWorkspaceDocsTabDescription', {
                defaultValue: 'Browse package notes and deeper authoring guidance.',
              })}
            </div>
          </div>
        </div>
        <DocTree
          nodes={resolvedDocsTree}
          selectedPath={selectedDoc?.relativePath || null}
          onSelect={updateSelectedDoc}
        />
      </aside>
      <section className={styles.detailPane}>
        {selectedDoc ? (
          <div className={styles.contentStack}>
            <div className={styles.contentCard}>
              <div className={styles.sectionTitle}>{selectedDoc.title}</div>
              <div className={styles.docPath}>{selectedDoc.relativePath}</div>
            </div>
            <div className={styles.markdownReader}>
              <MarkdownView hiddenCodeCopyButton>{selectedDoc.content}</MarkdownView>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            {t('settings.agentWorkspaceDocsEmpty', {
              defaultValue: 'This package does not include additional docs.',
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default DocsTab;
