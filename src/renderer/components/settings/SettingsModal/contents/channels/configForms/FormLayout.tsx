/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import classNames from 'classnames';
import React from 'react';
import styles from './FormLayout.module.css';

export const FormSectionHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className={styles.sectionHeader}>
    <h3 className={styles.sectionTitle}>{title}</h3>
    {action}
  </div>
);

export const FormPreferenceRow: React.FC<{
  label: string;
  description?: React.ReactNode;
  extra?: React.ReactNode;
  required?: boolean;
  stacked?: boolean;
  children: React.ReactNode;
}> = ({ label, description, extra, required, stacked = false, children }) => (
  <div className={classNames(styles.preferenceRow, stacked && styles.preferenceRowStacked)}>
    <div className={classNames(styles.preferenceInfo, stacked && styles.preferenceInfoStacked)}>
      <div className={styles.preferenceLabelRow}>
        <span className={styles.preferenceLabel}>
          {label}
          {required ? <span className='ml-2px text-red-500'>*</span> : null}
        </span>
        {extra}
      </div>
      {description ? <div className={styles.preferenceDescription}>{description}</div> : null}
    </div>
    <div className={classNames(styles.preferenceControl, stacked && styles.preferenceControlStacked)}>{children}</div>
  </div>
);

export { default as formLayoutStyles } from './FormLayout.module.css';
