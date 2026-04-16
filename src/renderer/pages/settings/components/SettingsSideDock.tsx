import classNames from 'classnames';
import React from 'react';
import { createPortal } from 'react-dom';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';

type SettingsSideDockProps = {
  variant: 'preview' | 'runtime-config';
  ariaLabel: string;
  dataTestId?: string;
  children: React.ReactNode;
};

const SettingsSideDock: React.FC<SettingsSideDockProps> = ({ variant, ariaLabel, dataTestId, children }) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <aside
      className={classNames('settings-side-dock', {
        'settings-side-dock--preview': variant === 'preview',
        'settings-side-dock--runtime-config': variant === 'runtime-config',
        'settings-side-dock--mobile': isMobile && variant === 'runtime-config',
      })}
      data-testid={dataTestId}
      aria-label={ariaLabel}
    >
      <div className='settings-side-dock__panel'>
        <div className='settings-side-dock__content'>{children}</div>
      </div>
    </aside>,
    document.body
  );
};

export default SettingsSideDock;
