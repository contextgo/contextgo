/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { decryptAesEcb, encryptAesEcb } from './aesEcb';
import { buildCdnDownloadUrl, buildCdnUploadUrl } from './cdnUrl';

const UPLOAD_MAX_RETRIES = 3;

async function fetchCdnBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)');
    throw new Error(`CDN download ${res.status} ${res.statusText}: ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function parseAesKey(aesKeyBase64: string): Buffer {
  const decoded = Buffer.from(aesKeyBase64, 'base64');
  if (decoded.length === 16) return decoded;
  if (decoded.length === 32 && /^[0-9a-fA-F]{32}$/.test(decoded.toString('ascii'))) {
    return Buffer.from(decoded.toString('ascii'), 'hex');
  }
  throw new Error(`Invalid aes_key payload length: ${decoded.length}`);
}

export async function downloadAndDecryptBuffer(
  encryptedQueryParam: string,
  aesKeyBase64: string,
  cdnBaseUrl: string
): Promise<Buffer> {
  const key = parseAesKey(aesKeyBase64);
  const url = buildCdnDownloadUrl(encryptedQueryParam, cdnBaseUrl);
  const encrypted = await fetchCdnBytes(url);
  return decryptAesEcb(encrypted, key);
}

export async function downloadPlainCdnBuffer(encryptedQueryParam: string, cdnBaseUrl: string): Promise<Buffer> {
  const url = buildCdnDownloadUrl(encryptedQueryParam, cdnBaseUrl);
  return fetchCdnBytes(url);
}

export async function uploadBufferToCdn(params: {
  buf: Buffer;
  uploadParam: string;
  filekey: string;
  cdnBaseUrl: string;
  aesKey: Buffer;
}): Promise<{ downloadParam: string }> {
  const { buf, uploadParam, filekey, cdnBaseUrl, aesKey } = params;
  const ciphertext = encryptAesEcb(buf, aesKey);
  const cdnUrl = buildCdnUploadUrl({ cdnBaseUrl, uploadParam, filekey });

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop
      const res = await fetch(cdnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(ciphertext),
      });

      if (res.status >= 400 && res.status < 500) {
        // oxlint-disable-next-line eslint/no-await-in-loop
        const errMsg = res.headers.get('x-error-message') ?? (await res.text());
        throw new Error(`CDN upload client error ${res.status}: ${errMsg}`);
      }
      if (res.status !== 200) {
        const errMsg = res.headers.get('x-error-message') ?? `status ${res.status}`;
        throw new Error(`CDN upload server error: ${errMsg}`);
      }

      const downloadParam = res.headers.get('x-encrypted-param') ?? undefined;
      if (!downloadParam) {
        throw new Error('CDN upload response missing x-encrypted-param');
      }
      return { downloadParam };
    } catch (err) {
      const typed = err instanceof Error ? err : new Error(String(err));
      lastErr = typed;
      if (typed.message.includes('client error')) break;
    }
  }

  throw lastErr ?? new Error(`CDN upload failed after ${UPLOAD_MAX_RETRIES} attempts`);
}
