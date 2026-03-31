/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conversionService } from '../../../../src/process/services/conversionService';
import { initDocumentBridge } from '../../../../src/process/bridge/documentBridge';

const providerRef = {
  fn: undefined as ((payload: { filePath: string; to: string }) => Promise<unknown>) | undefined,
};

vi.mock('@/common', () => ({
  ipcBridge: {
    document: {
      convert: {
        provider: vi.fn((fn: (payload: { filePath: string; to: string }) => Promise<unknown>) => {
          providerRef.fn = fn;
        }),
      },
    },
  },
}));

describe('documentBridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    providerRef.fn = undefined;
  });

  it('registers the document conversion provider', () => {
    initDocumentBridge();

    expect(providerRef.fn).toBeDefined();
  });

  it('routes ppt-pdf conversions to conversionService.pptToPdf', async () => {
    const pptToPdfSpy = vi.spyOn(conversionService, 'pptToPdf').mockResolvedValue({
      success: true,
      data: {
        pdfPath: '/cache/ppt-preview.pdf',
      },
    });

    initDocumentBridge();
    const result = await providerRef.fn!({
      filePath: '/workspace/deck.pptx',
      to: 'ppt-pdf',
    });

    expect(pptToPdfSpy).toHaveBeenCalledWith('/workspace/deck.pptx');
    expect(result).toEqual({
      to: 'ppt-pdf',
      result: {
        success: true,
        data: {
          pdfPath: '/cache/ppt-preview.pdf',
        },
      },
    });
  });

  it('rejects ppt-pdf conversions for non-powerpoint files', async () => {
    initDocumentBridge();

    const result = await providerRef.fn!({
      filePath: '/workspace/readme.md',
      to: 'ppt-pdf',
    });

    expect(result).toEqual({
      to: 'ppt-pdf',
      result: {
        success: false,
        error: 'Only PowerPoint files can be converted to PDF',
      },
    });
  });
});
