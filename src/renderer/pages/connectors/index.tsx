import { ipcBridge } from '@/common';
import { Button, Tag } from '@arco-design/web-react';
import { ConnectionPoint, Right, Send } from '@icon-park/react';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ConnectorLogo from './ConnectorLogo';
import { CONNECTOR_CATEGORY_ORDER, CONNECTOR_MAP, CONNECTORS } from './connectors';
import styles from './ConnectorsPage.module.css';
import type { ConnectorAuthType, ConnectorCategory, ConnectorResource, ConnectorStage } from './types';

const getResourceKey = (resource: ConnectorResource): string => `settings.connectors.resourceTypes.${resource}`;
const getAuthKey = (authType: ConnectorAuthType): string => `settings.connectors.authTypes.${authType}`;
const getCategoryKey = (category: ConnectorCategory): string => `settings.connectors.categories.${category}`;
const getStageKey = (stage: ConnectorStage): string =>
  stage === 'priority' ? 'settings.connectors.stagePriority' : 'settings.connectors.stagePlanned';
const createInitialCollapsedState = (): Record<ConnectorCategory, boolean> =>
  Object.fromEntries(CONNECTOR_CATEGORY_ORDER.map((category) => [category, false])) as Record<
    ConnectorCategory,
    boolean
  >;

const ConnectorsPage: React.FC = () => {
  const { connectorId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [collapsedCategories, setCollapsedCategories] =
    useState<Record<ConnectorCategory, boolean>>(createInitialCollapsedState);

  const groupedConnectors = useMemo(
    () =>
      CONNECTOR_CATEGORY_ORDER.map((category) => ({
        category,
        items: CONNECTORS.filter((connector) => connector.category === category),
      })).filter((group) => group.items.length > 0),
    []
  );

  const activeConnector = connectorId ? CONNECTOR_MAP.get(connectorId) : undefined;
  const fallbackConnector = CONNECTORS[0];
  const resolvedConnector = activeConnector || fallbackConnector;

  useEffect(() => {
    if (connectorId && activeConnector) {
      return;
    }

    if (!fallbackConnector) {
      return;
    }

    void navigate(`/connectors/${fallbackConnector.id}`, { replace: true });
  }, [activeConnector, connectorId, fallbackConnector, navigate]);

  useEffect(() => {
    if (!resolvedConnector) {
      return;
    }

    setCollapsedCategories((previous) => {
      if (!previous[resolvedConnector.category]) {
        return previous;
      }
      return {
        ...previous,
        [resolvedConnector.category]: false,
      };
    });
  }, [resolvedConnector]);

  if (!resolvedConnector) {
    return null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitleRow}>
              <h1 className={styles.sidebarTitle}>{t('settings.connectors.title')}</h1>
              <div className={styles.eyebrow}>{t('settings.connectors.kind')}</div>
            </div>
            <p className={styles.sidebarDescription}>
              {t('settings.connectors.description')} {t('settings.connectors.count', { count: CONNECTORS.length })}
            </p>
          </div>

          <div className={styles.listWrap}>
            {groupedConnectors.map((group) => (
              <section key={group.category} className={styles.categorySection}>
                <Button
                  type='text'
                  className={styles.categoryToggle}
                  aria-expanded={!collapsedCategories[group.category]}
                  onClick={() => {
                    setCollapsedCategories((previous) => ({
                      ...previous,
                      [group.category]: !previous[group.category],
                    }));
                  }}
                >
                  <span className={styles.categoryTitle}>
                    <span className={styles.categoryTitleMeta}>
                      <Right
                        theme='outline'
                        size='14'
                        className={classNames(
                          styles.categoryChevron,
                          collapsedCategories[group.category] && styles.categoryChevronCollapsed
                        )}
                      />
                      <span className={styles.categoryTitleText}>{t(getCategoryKey(group.category))}</span>
                    </span>
                    <span className={styles.categoryCount}>{group.items.length}</span>
                  </span>
                </Button>

                <div className={styles.categoryItems} hidden={collapsedCategories[group.category]}>
                  {group.items.map((connector) => {
                    const isActive = connector.id === resolvedConnector.id;
                    return (
                      <Button
                        key={connector.id}
                        type='text'
                        className={classNames(styles.connectorItem, isActive && styles.connectorItemActive)}
                        onClick={() => {
                          void navigate(`/connectors/${connector.id}`);
                        }}
                      >
                        <div className={styles.connectorItemInner}>
                          <ConnectorLogo connector={connector} />
                          <div className={styles.connectorMeta}>
                            <div className={styles.connectorNameRow}>
                              <span className={styles.connectorName}>{connector.name}</span>
                              <Tag size='small' color={connector.stage === 'priority' ? 'arcoblue' : 'gray'}>
                                {t(getStageKey(connector.stage))}
                              </Tag>
                            </div>
                            <div className={styles.connectorDomain}>{connector.domain}</div>
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </aside>

        <section className={styles.detail}>
          <div className={styles.detailHero}>
            <ConnectorLogo connector={resolvedConnector} size='large' />
            <div className={styles.detailHeroMeta}>
              <h2 className={styles.detailTitle}>{resolvedConnector.name}</h2>
              <p className={styles.detailSubtitle}>
                {t('settings.connectors.summaryTemplate', {
                  name: resolvedConnector.name,
                  category: t(getCategoryKey(resolvedConnector.category)),
                })}
              </p>
              <div className={styles.detailBadges}>
                <Tag color='arcoblue'>{t(getStageKey(resolvedConnector.stage))}</Tag>
                <Tag color='gray'>{t(getAuthKey(resolvedConnector.authType))}</Tag>
                <Tag color='cyan'>{t('settings.connectors.kind')}</Tag>
              </div>
            </div>
          </div>

          <div className={styles.detailGrid}>
            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>{t('settings.connectors.resources')}</h3>
              <div className={styles.chipWrap}>
                {resolvedConnector.resources.map((resource) => (
                  <Tag key={resource} size='small' color='arcoblue'>
                    {t(getResourceKey(resource))}
                  </Tag>
                ))}
              </div>
            </div>

            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>{t('settings.connectors.auth')}</h3>
              <div className={styles.detailCardText}>{t(getAuthKey(resolvedConnector.authType))}</div>
            </div>

            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>{t('settings.connectors.officialSite')}</h3>
              <div className={styles.detailCardText}>{resolvedConnector.websiteUrl}</div>
            </div>

            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>{t('common.website')}</h3>
              <Button
                type='outline'
                icon={<Send theme='outline' size='14' />}
                onClick={() => {
                  void ipcBridge.shell.openExternal.invoke(resolvedConnector.websiteUrl);
                }}
              >
                {t('settings.connectors.openWebsite')}
              </Button>
            </div>
          </div>

          <div className={styles.footerNote}>
            <ConnectionPoint theme='outline' size='16' className='mr-8px inline-block align-text-bottom' />
            {t('settings.connectors.note')}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ConnectorsPage;
