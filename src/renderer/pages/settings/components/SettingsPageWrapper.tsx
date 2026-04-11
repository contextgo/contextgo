import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { Drawer } from '@arco-design/web-react';
import { createPortal } from 'react-dom';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { SettingsViewModeProvider } from '@/renderer/components/settings/SettingsModal/settingsViewContext';
import { PreviewPanel, usePreviewContext } from '@/renderer/pages/conversation/Preview';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import SettingsSider from './SettingsSider';
import './settings.css';
import { SETTINGS_NAV_DRAWER_EVENT } from './settingsNavigation';

interface SettingsPageWrapperProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

const SettingsPageWrapper: React.FC<SettingsPageWrapperProps> = ({ children, className, contentClassName }) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const isDesktop = isElectronDesktop();
  const { isOpen: isPreviewOpen, activeTab } = usePreviewContext();
  const [mobileNavVisible, setMobileNavVisible] = useState(false);

  useEffect(() => {
    if (!isMobile || typeof window === 'undefined') {
      setMobileNavVisible(false);
      return;
    }

    const handleOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setMobileNavVisible(customEvent.detail?.open !== false);
    };

    window.addEventListener(SETTINGS_NAV_DRAWER_EVENT, handleOpen as EventListener);
    return () => {
      window.removeEventListener(SETTINGS_NAV_DRAWER_EVENT, handleOpen as EventListener);
    };
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    setMobileNavVisible(false);
  }, [isMobile, pathname]);

  const containerClass = classNames(
    'settings-page-wrapper secondary-page-frame w-full min-h-full box-border overflow-y-auto',
    className
  );

  const contentClass = classNames(
    'settings-page-content secondary-page-inner mx-auto w-full md:max-w-[min(1440px,calc(100vw-144px))]',
    contentClassName
  );
  const showPreviewDock = !isMobile && isPreviewOpen && Boolean(activeTab);
  const previewDock =
    showPreviewDock && typeof document !== 'undefined'
      ? createPortal(
          <aside
            className='settings-page-preview-shell'
            data-testid='settings-page-preview'
            aria-label={t('preview.preview', { defaultValue: 'Preview' })}
          >
            <div className='settings-page-preview-panel'>
              <PreviewPanel />
            </div>
          </aside>,
          document.body
        )
      : null;

  return (
    <SettingsViewModeProvider value='page'>
      <div className={containerClass}>
        <div className='settings-page-shell'>
          <div className='settings-page-main'>
            <div className={contentClass}>{children}</div>
          </div>
        </div>
      </div>
      {isMobile ? (
        <Drawer
          visible={mobileNavVisible}
          placement='left'
          width={280}
          footer={null}
          title={t('settings.title')}
          className='settings-mobile-nav-drawer'
          onCancel={() => setMobileNavVisible(false)}
          unmountOnExit
        >
          <div className='settings-mobile-nav-drawer__body'>
            <SettingsSider />
          </div>
        </Drawer>
      ) : null}
      {previewDock}
    </SettingsViewModeProvider>
  );
};

export default SettingsPageWrapper;
