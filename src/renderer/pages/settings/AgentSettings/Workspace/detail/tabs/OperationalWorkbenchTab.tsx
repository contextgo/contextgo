import { Button } from '@arco-design/web-react';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import styles from '../../AssistantWorkspace.module.css';

export type OperationalWorkbenchItem = {
  id: string;
  label: string;
  summary?: string;
};

type OperationalWorkbenchTabProps<TItem extends OperationalWorkbenchItem> = {
  queryKey: string;
  title: string;
  description: string;
  items: TItem[];
  emptyText: string;
  renderDetail: (item: TItem) => React.ReactNode;
  renderItem?: (item: TItem) => React.ReactNode;
  getItemButtonClassName?: (item: TItem) => string | undefined;
};

function OperationalWorkbenchTab<TItem extends OperationalWorkbenchItem>({
  queryKey,
  title,
  description,
  items,
  emptyText,
  renderDetail,
  renderItem,
  getItemButtonClassName,
}: OperationalWorkbenchTabProps<TItem>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedItemId = searchParams.get(queryKey) ?? items[0]?.id ?? null;
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;

  const updateSelection = (nextId: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set(queryKey, nextId);
    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <div className={styles.tabShell}>
      <aside className={styles.indexPane}>
        <div className={styles.paneToolbar}>
          <div>
            <div className={styles.paneTitle}>{title}</div>
            <div className={styles.paneDescription}>{description}</div>
          </div>
        </div>
        {items.length > 0 ? (
          <div className={styles.itemList}>
            {items.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const itemButtonClassName = [
                styles.itemButton,
                isSelected ? styles.itemButtonActive : null,
                getItemButtonClassName?.(item) ?? null,
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <Button key={item.id} className={itemButtonClassName} onClick={() => updateSelection(item.id)}>
                  {renderItem ? (
                    renderItem(item)
                  ) : (
                    <>
                      <div className={styles.itemTitle}>{item.label}</div>
                      {item.summary ? <div className={styles.itemSummary}>{item.summary}</div> : null}
                    </>
                  )}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>{emptyText}</div>
        )}
      </aside>

      <section className={styles.detailPane}>
        {selectedItem ? renderDetail(selectedItem) : <div className={styles.emptyState}>{emptyText}</div>}
      </section>
    </div>
  );
}

export default OperationalWorkbenchTab;
