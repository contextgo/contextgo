import { Button } from '@arco-design/web-react';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ContextGoModal } from '@/renderer/components/base';
import type { ContextGoModalProps, ModalFooterConfig, ModalHeaderConfig } from '@/renderer/components/base';

const DEFAULT_HEADER_CLASS = 'px-24px pt-20px';
const DEFAULT_FOOTER_CLASS = 'px-24px pb-20px';
const DEFAULT_CONTENT_PADDING = '12px 24px 24px';
const CANCEL_BUTTON_CLASS = 'min-w-88px px-18px';
const CONFIRM_BUTTON_CLASS = 'min-w-104px px-18px';

type SettingsSubModalProps = Omit<ContextGoModalProps, 'header' | 'title' | 'className'> & {
  title?: React.ReactNode;
  header?: ContextGoModalProps['header'];
  className?: string;
};

const normalizeHeader = (
  title: React.ReactNode,
  header: ContextGoModalProps['header']
): ContextGoModalProps['header'] => {
  if (header === undefined) {
    return {
      title,
      showClose: true,
      className: DEFAULT_HEADER_CLASS,
    } satisfies ModalHeaderConfig;
  }

  if (typeof header === 'string' || typeof header === 'number' || React.isValidElement(header)) {
    return {
      title: header,
      showClose: true,
      className: DEFAULT_HEADER_CLASS,
    } satisfies ModalHeaderConfig;
  }

  const headerConfig = header as ModalHeaderConfig;
  return {
    ...headerConfig,
    showClose: headerConfig.showClose ?? true,
    className: classNames(DEFAULT_HEADER_CLASS, headerConfig.className),
  } satisfies ModalHeaderConfig;
};

const SettingsSubModal: React.FC<SettingsSubModalProps> = ({
  title,
  header,
  footer,
  className,
  contentStyle,
  onCancel,
  onOk,
  okText,
  cancelText,
  confirmLoading,
  okButtonProps,
  children,
  unmountOnExit,
  ...props
}) => {
  const { t } = useTranslation();

  const resolvedHeader = React.useMemo(() => normalizeHeader(title, header), [header, title]);

  const resolvedFooter = React.useMemo<ContextGoModalProps['footer']>(() => {
    if (footer === null) {
      return null;
    }

    if (footer === undefined) {
      return {
        className: DEFAULT_FOOTER_CLASS,
        render: () => (
          <div className='flex justify-end gap-10px pt-4px'>
            <Button onClick={onCancel} className={CANCEL_BUTTON_CLASS}>
              {cancelText ?? t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type='primary'
              onClick={onOk}
              loading={confirmLoading}
              {...okButtonProps}
              className={classNames(CONFIRM_BUTTON_CLASS, okButtonProps?.className)}
            >
              {okText ?? t('common.confirm', { defaultValue: 'Confirm' })}
            </Button>
          </div>
        ),
      } satisfies ModalFooterConfig;
    }

    if (React.isValidElement(footer)) {
      return {
        className: DEFAULT_FOOTER_CLASS,
        render: () => footer,
      } satisfies ModalFooterConfig;
    }

    const footerConfig = footer as ModalFooterConfig;
    return {
      ...footerConfig,
      className: classNames(DEFAULT_FOOTER_CLASS, footerConfig.className),
    } satisfies ModalFooterConfig;
  }, [cancelText, confirmLoading, footer, okButtonProps, okText, onCancel, onOk, t]);

  return (
    <ContextGoModal
      {...props}
      onCancel={onCancel}
      header={resolvedHeader}
      footer={resolvedFooter}
      className={classNames('settings-sub-modal', className)}
      contentStyle={{
        padding: DEFAULT_CONTENT_PADDING,
        ...contentStyle,
      }}
      unmountOnExit={unmountOnExit}
    >
      {children}
    </ContextGoModal>
  );
};

export default SettingsSubModal;
