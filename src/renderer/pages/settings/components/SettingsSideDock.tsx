import classNames from 'classnames';
import React from 'react';
import { createPortal } from 'react-dom';

type SettingsSideDockProps = {
  variant: 'preview' | 'runtime-config';
  ariaLabel: string;
  dataTestId?: string;
  children: React.ReactNode;
};

const SettingsSideDock: React.FC<SettingsSideDockProps> = ({ variant, ariaLabel, dataTestId, children }) => {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <aside
      className={classNames('settings-side-dock', {
        'settings-side-dock--preview': variant === 'preview',
        'settings-side-dock--runtime-config': variant === 'runtime-config',
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
