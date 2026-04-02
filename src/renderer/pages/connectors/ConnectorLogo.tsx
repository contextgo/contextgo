import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import type { ConnectorCategory, ConnectorDefinition } from './types';
import styles from './ConnectorsPage.module.css';

type ConnectorLogoProps = {
  connector: ConnectorDefinition;
  size?: 'small' | 'large';
};

const buildLogoCandidates = (connector: ConnectorDefinition): string[] => {
  return connector.localLogo ? [connector.localLogo] : [];
};

const getConnectorInitials = (name: string): string =>
  name
    .split(/[\s/&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

const getCategoryClassName = (category: ConnectorCategory): string => {
  switch (category) {
    case 'contextgo':
      return styles.logoContextgo;
    case 'googleWorkspace':
      return styles.logoGoogleWorkspace;
    case 'collaboration':
      return styles.logoCollaboration;
    case 'development':
      return styles.logoDevelopment;
    case 'knowledge':
      return styles.logoKnowledge;
    case 'design':
      return styles.logoDesign;
    case 'storage':
      return styles.logoStorage;
    case 'business':
      return styles.logoBusiness;
    case 'data':
      return styles.logoData;
    default:
      return styles.logoFallback;
  }
};

const ConnectorLogo: React.FC<ConnectorLogoProps> = ({ connector, size = 'small' }) => {
  const [logoIndex, setLogoIndex] = useState(0);
  const logoCandidates = useMemo(() => buildLogoCandidates(connector), [connector]);
  const logoUrl = logoCandidates[logoIndex];
  const imageFailed = !logoUrl;

  useEffect(() => {
    setLogoIndex(0);
  }, [logoCandidates]);

  const initials = useMemo(() => getConnectorInitials(connector.name), [connector.name]);

  return (
    <div
      className={classNames(
        styles.logoBase,
        size === 'large' ? styles.logoLarge : styles.logoSmall,
        getCategoryClassName(connector.category)
      )}
      aria-hidden='true'
    >
      {!imageFailed ? (
        <img
          src={logoUrl}
          alt=''
          className={classNames(styles.logoImage, connector.category === 'contextgo' && styles.logoImageFullBleed)}
          onError={() => {
            setLogoIndex((currentIndex) => currentIndex + 1);
          }}
        />
      ) : (
        <span className={styles.logoFallbackText}>{initials}</span>
      )}
    </div>
  );
};

export default ConnectorLogo;
