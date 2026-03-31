/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { isElectronDesktop } from '@/renderer/utils/platform';
import PDFPreview from './PDFViewer';
import { Button, Message, Spin } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PptViewerProps {
  filePath?: string;
  content?: string;
}

/**
 * PPT Preview Component
 *
 * Uses LibreOffice headless in the main process to convert PPT/PPTX to a
 * cached PDF, then reuses the existing PDF preview path.
 */
const PptViewer: React.FC<PptViewerProps> = ({ filePath }) => {
  const { t } = useTranslation();
  const [previewPdfPath, setPreviewPdfPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageApi, messageContextHolder] = Message.useMessage();
  const filePathRef = useRef(filePath);

  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);

  const handleOpenInSystem = useCallback(async () => {
    if (!filePathRef.current) {
      messageApi.error(t('preview.errors.openWithoutPath'));
      return;
    }

    try {
      await ipcBridge.shell.openFile.invoke(filePathRef.current);
      messageApi.info(t('preview.openInSystemSuccess'));
    } catch {
      messageApi.error(t('preview.openInSystemFailed'));
    }
  }, [messageApi, t]);

  const handleShowInFolder = useCallback(async () => {
    if (!filePathRef.current) return;

    try {
      await ipcBridge.shell.showItemInFolder.invoke(filePathRef.current);
    } catch {
      // Ignore show-in-folder failures in preview fallback UI.
    }
  }, []);

  useEffect(() => {
    filePathRef.current = filePath;

    if (!filePath) {
      setPreviewPdfPath(null);
      setLoading(false);
      setError(t('preview.errors.missingFilePath'));
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      setLoading(true);
      setPreviewPdfPath(null);
      setError(null);

      try {
        const response = await ipcBridge.document.convert.invoke({
          filePath,
          to: 'ppt-pdf',
        });

        if (response.to !== 'ppt-pdf') {
          throw new Error(t('preview.errors.conversionFailed'));
        }

        if (!response.result.success || !response.result.data?.pdfPath) {
          throw new Error(response.result.error || t('preview.ppt.startFailed'));
        }

        if (!cancelled) {
          setPreviewPdfPath(response.result.data.pdfPath);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : t('preview.ppt.startFailed');
          setError(message);
          setLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [filePath, t]);

  if (loading) {
    return (
      <div className='h-full w-full flex items-center justify-center bg-bg-1'>
        {messageContextHolder}
        <div className='flex flex-col items-center gap-12px'>
          <Spin size={32} />
          <span className='text-13px text-t-secondary'>{t('preview.ppt.loading')}</span>
        </div>
      </div>
    );
  }

  if (error || !previewPdfPath) {
    return (
      <div className='h-full w-full flex items-center justify-center bg-bg-1'>
        {messageContextHolder}
        <div className='text-center max-w-440px px-24px'>
          <div className='text-16px text-t-primary font-medium mb-8px'>{t('preview.pptTitle')}</div>
          <div className='text-13px text-danger mb-8px'>{error || t('preview.ppt.startFailed')}</div>
          <div className='text-12px text-t-secondary mb-24px'>{t('preview.ppt.installHint')}</div>

          {filePath && (
            <div className='flex items-center justify-center gap-12px'>
              <Button size='small' onClick={handleOpenInSystem}>
                {t('preview.pptOpenFile')}
              </Button>
              <Button size='small' onClick={handleShowInFolder}>
                {t('preview.pptShowLocation')}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isElectronDesktop()) {
    return <PDFPreview filePath={previewPdfPath} hideToolbar />;
  }

  const previewUrl = `/api/preview-file?path=${encodeURIComponent(previewPdfPath)}`;
  return <iframe src={previewUrl} className='w-full h-full border-0 bg-bg-1' title={t('preview.pptTitle')} />;
};

export default PptViewer;
