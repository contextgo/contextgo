/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { aesEcbPaddedSize } from './aesEcb';
import { downloadAndDecryptBuffer, downloadPlainCdnBuffer, uploadBufferToCdn } from './cdnTransfer';
import { getExtensionFromContentTypeOrUrl, getExtensionFromMime, getMimeFromFilename } from './mime';
import { silkToWav } from './silkTranscode';
import type {
  GetUploadUrlReq,
  MessageItem,
  UploadedFileInfo,
  WeixinInboundAttachment,
  WeixinRawMessage,
} from './weixinApiTypes';
import { MessageItemType, UploadMediaType } from './weixinApiTypes';

export const DEFAULT_WEIXIN_CDN_BASE_URL = 'https://novac2c.cdn.weixin.qq.com/c2c';
const WEIXIN_MEDIA_MAX_BYTES = 100 * 1024 * 1024;

function ensureUnderMaxBytes(buffer: Buffer): void {
  if (buffer.length > WEIXIN_MEDIA_MAX_BYTES) {
    throw new Error(`Media file exceeds max size (${WEIXIN_MEDIA_MAX_BYTES} bytes): ${buffer.length}`);
  }
}

async function saveInboundBuffer(params: {
  dataDir: string;
  accountId: string;
  kind: string;
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
}): Promise<string> {
  const ext = params.fileName ? path.extname(params.fileName) : getExtensionFromMime(params.mimeType);
  const dir = path.join(params.dataDir, 'weixin-media', params.accountId, 'inbound');
  await fs.mkdir(dir, { recursive: true });
  const safeExt = ext || '.bin';
  const filePath = path.join(dir, `${Date.now()}_${params.kind}_${crypto.randomBytes(4).toString('hex')}${safeExt}`);
  ensureUnderMaxBytes(params.buffer);
  await fs.writeFile(filePath, params.buffer);
  return filePath;
}

export async function downloadRemoteMediaToTemp(url: string, dataDir: string, accountId: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`remote media download failed: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  ensureUnderMaxBytes(buffer);
  const ext = getExtensionFromContentTypeOrUrl(res.headers.get('content-type'), url);
  const dir = path.join(dataDir, 'weixin-media', accountId, 'outbound-temp');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

type GetUploadUrlClient = (req: GetUploadUrlReq) => Promise<{ upload_param?: string }>;

async function uploadMediaToWeixinCdn(params: {
  filePath: string;
  toUserId: string;
  mediaType: number;
  cdnBaseUrl: string;
  getUploadUrl: GetUploadUrlClient;
}): Promise<UploadedFileInfo> {
  const plaintext = await fs.readFile(params.filePath);
  ensureUnderMaxBytes(plaintext);

  const rawsize = plaintext.length;
  const rawfilemd5 = crypto.createHash('md5').update(plaintext).digest('hex');
  const filesize = aesEcbPaddedSize(rawsize);
  const filekey = crypto.randomBytes(16).toString('hex');
  const aesKey = crypto.randomBytes(16);

  const uploadUrlResp = await params.getUploadUrl({
    filekey,
    media_type: params.mediaType,
    to_user_id: params.toUserId,
    rawsize,
    rawfilemd5,
    filesize,
    no_need_thumb: true,
    aeskey: aesKey.toString('hex'),
  });
  if (!uploadUrlResp.upload_param) {
    throw new Error('getUploadUrl returned no upload_param');
  }

  const { downloadParam } = await uploadBufferToCdn({
    buf: plaintext,
    uploadParam: uploadUrlResp.upload_param,
    filekey,
    cdnBaseUrl: params.cdnBaseUrl,
    aesKey,
  });

  return {
    filekey,
    downloadEncryptedQueryParam: downloadParam,
    aesKeyHex: aesKey.toString('hex'),
    fileSize: rawsize,
    fileSizeCiphertext: filesize,
  };
}

export async function uploadImageToWeixinCdn(params: {
  filePath: string;
  toUserId: string;
  cdnBaseUrl: string;
  getUploadUrl: GetUploadUrlClient;
}): Promise<UploadedFileInfo> {
  return uploadMediaToWeixinCdn({
    ...params,
    mediaType: UploadMediaType.IMAGE,
  });
}

export async function uploadVideoToWeixinCdn(params: {
  filePath: string;
  toUserId: string;
  cdnBaseUrl: string;
  getUploadUrl: GetUploadUrlClient;
}): Promise<UploadedFileInfo> {
  return uploadMediaToWeixinCdn({
    ...params,
    mediaType: UploadMediaType.VIDEO,
  });
}

export async function uploadFileToWeixinCdn(params: {
  filePath: string;
  toUserId: string;
  cdnBaseUrl: string;
  getUploadUrl: GetUploadUrlClient;
}): Promise<UploadedFileInfo> {
  return uploadMediaToWeixinCdn({
    ...params,
    mediaType: UploadMediaType.FILE,
  });
}

function getFirstMediaItem(message: WeixinRawMessage): MessageItem | undefined {
  return (
    message.item_list?.find((i) => i.type === MessageItemType.IMAGE && i.image_item?.media?.encrypt_query_param) ??
    message.item_list?.find((i) => i.type === MessageItemType.VIDEO && i.video_item?.media?.encrypt_query_param) ??
    message.item_list?.find((i) => i.type === MessageItemType.FILE && i.file_item?.media?.encrypt_query_param) ??
    message.item_list?.find((i) => i.type === MessageItemType.VOICE && i.voice_item?.media?.encrypt_query_param)
  );
}

export function extractInboundText(message: WeixinRawMessage): string {
  for (const item of message.item_list ?? []) {
    if (item.type === MessageItemType.TEXT && item.text_item?.text) {
      return item.text_item.text;
    }
    if (item.type === MessageItemType.VOICE && item.voice_item?.text) {
      return item.voice_item.text;
    }
  }
  return '';
}

export async function downloadInboundAttachment(params: {
  message: WeixinRawMessage;
  dataDir: string;
  accountId: string;
  cdnBaseUrl: string;
}): Promise<WeixinInboundAttachment | null> {
  const mediaItem = getFirstMediaItem(params.message);
  if (!mediaItem) return null;

  if (mediaItem.type === MessageItemType.IMAGE) {
    const image = mediaItem.image_item;
    if (!image?.media?.encrypt_query_param) return null;
    const aesKeyBase64 = image.aeskey ? Buffer.from(image.aeskey, 'hex').toString('base64') : image.media.aes_key;
    const buf = aesKeyBase64
      ? await downloadAndDecryptBuffer(image.media.encrypt_query_param, aesKeyBase64, params.cdnBaseUrl)
      : await downloadPlainCdnBuffer(image.media.encrypt_query_param, params.cdnBaseUrl);
    const filePath = await saveInboundBuffer({
      dataDir: params.dataDir,
      accountId: params.accountId,
      kind: 'image',
      buffer: buf,
      mimeType: 'image/jpeg',
    });
    return { kind: 'image', filePath, mimeType: 'image/jpeg', size: buf.length };
  }

  if (mediaItem.type === MessageItemType.VIDEO) {
    const video = mediaItem.video_item;
    if (!video?.media?.encrypt_query_param || !video.media.aes_key) return null;
    const buf = await downloadAndDecryptBuffer(video.media.encrypt_query_param, video.media.aes_key, params.cdnBaseUrl);
    const filePath = await saveInboundBuffer({
      dataDir: params.dataDir,
      accountId: params.accountId,
      kind: 'video',
      buffer: buf,
      mimeType: 'video/mp4',
    });
    return {
      kind: 'video',
      filePath,
      mimeType: 'video/mp4',
      size: buf.length,
      duration: video.play_length,
    };
  }

  if (mediaItem.type === MessageItemType.FILE) {
    const fileItem = mediaItem.file_item;
    if (!fileItem?.media?.encrypt_query_param || !fileItem.media.aes_key) return null;
    const buf = await downloadAndDecryptBuffer(
      fileItem.media.encrypt_query_param,
      fileItem.media.aes_key,
      params.cdnBaseUrl
    );
    const fileName = fileItem.file_name ?? undefined;
    const mimeType = fileName ? getMimeFromFilename(fileName) : 'application/octet-stream';
    const filePath = await saveInboundBuffer({
      dataDir: params.dataDir,
      accountId: params.accountId,
      kind: 'file',
      buffer: buf,
      mimeType,
      fileName,
    });
    return {
      kind: 'file',
      filePath,
      fileName,
      mimeType,
      size: buf.length,
    };
  }

  if (mediaItem.type === MessageItemType.VOICE) {
    const voice = mediaItem.voice_item;
    if (!voice?.media?.encrypt_query_param || !voice.media.aes_key) return null;
    const silkBuf = await downloadAndDecryptBuffer(
      voice.media.encrypt_query_param,
      voice.media.aes_key,
      params.cdnBaseUrl
    );
    const wavBuf = await silkToWav(silkBuf);
    const filePath = await saveInboundBuffer({
      dataDir: params.dataDir,
      accountId: params.accountId,
      kind: 'voice',
      buffer: wavBuf ?? silkBuf,
      mimeType: wavBuf ? 'audio/wav' : 'audio/silk',
      fileName: wavBuf ? 'voice.wav' : 'voice.silk',
    });
    return {
      kind: 'voice',
      filePath,
      fileName: wavBuf ? 'voice.wav' : 'voice.silk',
      mimeType: wavBuf ? 'audio/wav' : 'audio/silk',
      size: (wavBuf ?? silkBuf).length,
      duration: voice.playtime,
    };
  }

  return null;
}
