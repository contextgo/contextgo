/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Typography } from '@arco-design/web-react';
import classNames from 'classnames';
import React from 'react';

export type AutomationPanelVariant = 'page' | 'embedded';

type AutomationPanelProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  variant?: AutomationPanelVariant;
};

type AutomationSectionCardProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  variant?: AutomationPanelVariant;
};

const getSurfaceClassName = (variant: AutomationPanelVariant): string =>
  variant === 'embedded'
    ? 'rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-16px'
    : 'rounded-20px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-20px';

export const AutomationPanel: React.FC<AutomationPanelProps> = ({
  title,
  description,
  icon,
  meta,
  actions,
  children,
  className,
  variant = 'embedded',
}) => {
  const surfaceClassName = getSurfaceClassName(variant);

  return (
    <div className={classNames(surfaceClassName, 'flex flex-col gap-16px', className)}>
      <div className='flex flex-wrap items-start justify-between gap-16px'>
        <div className='min-w-0 flex-1'>
          <div className={classNames({ 'app-icon-row': Boolean(icon) })}>
            {icon ? <span className='app-icon-slot app-icon-slot--lg'>{icon}</span> : null}
            <div className='min-w-0 text-16px font-600 leading-6 text-t-primary'>{title}</div>
          </div>
          {description ? (
            <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>{description}</Typography.Paragraph>
          ) : null}
          {meta ? <div className='mt-12px'>{meta}</div> : null}
        </div>
        {actions ? <div className='flex flex-wrap items-center gap-8px'>{actions}</div> : null}
      </div>

      {children ? <div className='flex flex-col gap-16px'>{children}</div> : null}
    </div>
  );
};

export const AutomationSectionCard: React.FC<AutomationSectionCardProps> = ({
  title,
  description,
  actions,
  extra,
  children,
  className,
  bodyClassName,
  variant = 'embedded',
}) => {
  const surfaceClassName = getSurfaceClassName(variant);

  return (
    <div className={classNames(surfaceClassName, className)}>
      {title || description || actions || extra ? (
        <div className='mb-16px flex flex-wrap items-start justify-between gap-12px'>
          <div className='min-w-0 flex-1'>
            {title ? (
              <Typography.Title heading={6} className='!mb-0'>
                {title}
              </Typography.Title>
            ) : null}
            {description ? (
              <Typography.Paragraph className='mb-0 mt-6px text-t-secondary'>{description}</Typography.Paragraph>
            ) : null}
          </div>
          {extra ? <div className='flex items-center text-12px text-t-secondary'>{extra}</div> : null}
          {actions ? <div className='flex flex-wrap items-center gap-8px'>{actions}</div> : null}
        </div>
      ) : null}
      <div className={classNames('min-w-0', bodyClassName)}>{children}</div>
    </div>
  );
};
