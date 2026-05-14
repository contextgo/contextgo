/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { TypingManager } from './WeixinTyping';
import {
  DEFAULT_WEIXIN_CDN_BASE_URL,
  downloadInboundAttachment,
  downloadRemoteMediaToTemp,
  extractInboundText,
  uploadFileToWeixinCdn,
  uploadImageToWeixinCdn,
  uploadVideoToWeixinCdn,
} from './media/mediaIO';
import { getMimeFromFilename } from './media/mime';
import type {
  GetUploadUrlReq,
  GetUploadUrlResp,
  MessageItem,
  WeixinInboundAttachment,
  WeixinRawMessage,
} from './media/weixinApiTypes';
import { MessageItemType, MessageState, MessageType } from './media/weixinApiTypes';

// ==================== Public types ====================

export type WeixinChatRequest = {
  conversationId: string;
  text?: string;
  contextToken?: string;
  attachments?: WeixinInboundAttachment[];
};

export type WeixinChatResponse = {
  text?: string;
  media?: {
    /**
     * Absolute/relative local path, file:// URL, or remote HTTP(S) URL.
     * Remote URLs are downloaded to a temp file before upload.
     */
    filePath: string;
    fileName?: string;
    mimeType?: string;
  };
};

export type WeixinAgent = {
  chat: (req: WeixinChatRequest) => Promise<WeixinChatResponse>;
};

export type MonitorOptions = {
  baseUrl: string;
  cdnBaseUrl?: string;
  token: string;
  accountId: string;
  /** Directory used to persist get_updates_buf. Pass getPlatformServices().paths.getDataDir(). */
  dataDir: string;
  agent: WeixinAgent;
  abortSignal?: AbortSignal;
  log?: (msg: string) => void;
};

// ==================== Utilities ====================

function formatError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    return cause !== undefined ? `${err.message}: ${String(cause)}` : err.message;
  }
  return String(err);
}

// ==================== Constants ====================

const LONG_POLL_TIMEOUT_MS = 35_000;
const API_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 2_000;
const BACKOFF_DELAY_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 3;

type GetUpdatesResp = {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinRawMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
};

type SendMessageBody = {
  msg: {
    to_user_id: string;
    client_id: string;
    message_type: number;
    message_state: number;
    item_list: MessageItem[];
    context_token?: string;
  };
};

// ==================== HTTP ====================

async function apiPost<T>(
  baseUrl: string,
  endpoint: string,
  bodyObj: unknown,
  token: string,
  wechatUin: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}/${endpoint}`;
  const body = JSON.stringify(bodyObj);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        AuthorizationType: 'ilink_bot_token',
        Authorization: `Bearer ${token}`,
        'Content-Length': String(Buffer.byteLength(body, 'utf-8')),
        'X-WECHAT-UIN': wechatUin,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// ==================== API calls ====================

async function callGetUpdates(
  baseUrl: string,
  token: string,
  wechatUin: string,
  buf: string,
  signal?: AbortSignal
): Promise<GetUpdatesResp> {
  return apiPost<GetUpdatesResp>(
    baseUrl,
    'ilink/bot/getupdates',
    { get_updates_buf: buf, base_info: {} },
    token,
    wechatUin,
    LONG_POLL_TIMEOUT_MS,
    signal
  );
}

async function callSendMessage(
  baseUrl: string,
  token: string,
  wechatUin: string,
  body: SendMessageBody
): Promise<void> {
  await apiPost(
    baseUrl,
    'ilink/bot/sendmessage',
    { ...body, base_info: {} },
    token,
    wechatUin,
    API_TIMEOUT_MS
    // No abort signal — send should complete even if the monitor is stopping
  );
}

async function callGetUploadUrl(
  baseUrl: string,
  token: string,
  wechatUin: string,
  req: GetUploadUrlReq
): Promise<GetUploadUrlResp> {
  return apiPost<GetUploadUrlResp>(
    baseUrl,
    'ilink/bot/getuploadurl',
    {
      ...req,
      base_info: {},
    },
    token,
    wechatUin,
    API_TIMEOUT_MS
  );
}

// ==================== Buf persistence ====================

function getBufPath(dataDir: string, accountId: string): string {
  return path.join(dataDir, 'weixin-monitor', `${accountId}.buf`);
}

function loadBuf(dataDir: string, accountId: string): string {
  try {
    return fs.readFileSync(getBufPath(dataDir, accountId), 'utf-8');
  } catch {
    return '';
  }
}

function saveBuf(dataDir: string, accountId: string, buf: string): void {
  const dir = path.join(dataDir, 'weixin-monitor');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getBufPath(dataDir, accountId), buf, 'utf-8');
}

// ==================== Monitor loop ====================

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function runMonitor(
  baseUrl: string,
  cdnBaseUrl: string,
  token: string,
  accountId: string,
  dataDir: string,
  agent: WeixinAgent,
  wechatUin: string,
  signal: AbortSignal | undefined,
  log: (msg: string) => void
): Promise<void> {
  let buf = loadBuf(dataDir, accountId);
  let consecutiveFailures = 0;
  const typingMgr = new TypingManager({ baseUrl, token, wechatUin, abortSignal: signal, log });

  // oxlint-disable-next-line eslint/no-unmodified-loop-condition
  while (!signal?.aborted) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop
      const resp = await callGetUpdates(baseUrl, token, wechatUin, buf, signal);

      const isApiError =
        (resp.ret !== undefined && resp.ret !== 0) || (resp.errcode !== undefined && resp.errcode !== 0);

      if (isApiError) {
        consecutiveFailures++;
        log(
          `[weixin] getUpdates failed: ret=${resp.ret} errcode=${resp.errcode} (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`
        );
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          consecutiveFailures = 0;
          // oxlint-disable-next-line eslint/no-await-in-loop
          await sleep(BACKOFF_DELAY_MS, signal);
        } else {
          // oxlint-disable-next-line eslint/no-await-in-loop
          await sleep(RETRY_DELAY_MS, signal);
        }
        continue;
      }

      consecutiveFailures = 0;

      if (resp.get_updates_buf) {
        buf = resp.get_updates_buf;
        saveBuf(dataDir, accountId, buf);
      }

      for (const msg of resp.msgs ?? []) {
        const conversationId = msg.from_user_id ?? '';
        if (!conversationId) continue;

        const text = extractInboundText(msg);
        let attachment: WeixinInboundAttachment | null = null;
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop
          attachment = await downloadInboundAttachment({
            message: msg,
            dataDir,
            accountId,
            cdnBaseUrl,
          });
        } catch (attachmentErr) {
          log(`[weixin] attachment parse failed for ${conversationId}: ${formatError(attachmentErr)}`);
        }

        if (!text && !attachment) continue;

        // oxlint-disable-next-line eslint/no-await-in-loop
        const stopTyping = await typingMgr.startTyping(conversationId, msg.context_token);
        let response: WeixinChatResponse | undefined;
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop
          response = await agent.chat({
            conversationId,
            text,
            contextToken: msg.context_token,
            attachments: attachment ? [attachment] : undefined,
          });
        } catch (agentErr) {
          // oxlint-disable-next-line eslint/no-await-in-loop
          await stopTyping();
          log(`[weixin] agent error for ${conversationId}: ${formatError(agentErr)}`);
          continue;
        }
        // oxlint-disable-next-line eslint/no-await-in-loop
        await stopTyping();
        if (!response) continue;

        if (response.media?.filePath) {
          try {
            let localPath = response.media.filePath;
            if (localPath.startsWith('file://')) {
              localPath = new URL(localPath).pathname;
            } else if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
              // oxlint-disable-next-line eslint/no-await-in-loop
              localPath = await downloadRemoteMediaToTemp(localPath, dataDir, accountId);
            } else if (!path.isAbsolute(localPath)) {
              localPath = path.resolve(localPath);
            }

            const mimeType = response.media.mimeType || getMimeFromFilename(response.media.fileName || localPath);
            const uploadGetUploadUrl = (req: GetUploadUrlReq) => callGetUploadUrl(baseUrl, token, wechatUin, req);

            if (mimeType.startsWith('video/')) {
              // oxlint-disable-next-line eslint/no-await-in-loop
              const uploaded = await uploadVideoToWeixinCdn({
                filePath: localPath,
                toUserId: conversationId,
                cdnBaseUrl,
                getUploadUrl: uploadGetUploadUrl,
              });

              if (response.text?.trim()) {
                // oxlint-disable-next-line eslint/no-await-in-loop
                await callSendMessage(baseUrl, token, wechatUin, {
                  msg: {
                    to_user_id: conversationId,
                    client_id: crypto.randomUUID(),
                    message_type: MessageType.BOT,
                    message_state: MessageState.FINISH,
                    item_list: [{ type: MessageItemType.TEXT, text_item: { text: response.text } }],
                    context_token: msg.context_token,
                  },
                });
              }
              // oxlint-disable-next-line eslint/no-await-in-loop
              await callSendMessage(baseUrl, token, wechatUin, {
                msg: {
                  to_user_id: conversationId,
                  client_id: crypto.randomUUID(),
                  message_type: MessageType.BOT,
                  message_state: MessageState.FINISH,
                  item_list: [
                    {
                      type: MessageItemType.VIDEO,
                      video_item: {
                        media: {
                          encrypt_query_param: uploaded.downloadEncryptedQueryParam,
                          aes_key: Buffer.from(uploaded.aesKeyHex).toString('base64'),
                          encrypt_type: 1,
                        },
                        video_size: uploaded.fileSizeCiphertext,
                      },
                    },
                  ],
                  context_token: msg.context_token,
                },
              });
            } else if (mimeType.startsWith('image/')) {
              // oxlint-disable-next-line eslint/no-await-in-loop
              const uploaded = await uploadImageToWeixinCdn({
                filePath: localPath,
                toUserId: conversationId,
                cdnBaseUrl,
                getUploadUrl: uploadGetUploadUrl,
              });

              if (response.text?.trim()) {
                // oxlint-disable-next-line eslint/no-await-in-loop
                await callSendMessage(baseUrl, token, wechatUin, {
                  msg: {
                    to_user_id: conversationId,
                    client_id: crypto.randomUUID(),
                    message_type: MessageType.BOT,
                    message_state: MessageState.FINISH,
                    item_list: [{ type: MessageItemType.TEXT, text_item: { text: response.text } }],
                    context_token: msg.context_token,
                  },
                });
              }
              // oxlint-disable-next-line eslint/no-await-in-loop
              await callSendMessage(baseUrl, token, wechatUin, {
                msg: {
                  to_user_id: conversationId,
                  client_id: crypto.randomUUID(),
                  message_type: MessageType.BOT,
                  message_state: MessageState.FINISH,
                  item_list: [
                    {
                      type: MessageItemType.IMAGE,
                      image_item: {
                        media: {
                          encrypt_query_param: uploaded.downloadEncryptedQueryParam,
                          aes_key: Buffer.from(uploaded.aesKeyHex).toString('base64'),
                          encrypt_type: 1,
                        },
                        mid_size: uploaded.fileSizeCiphertext,
                      },
                    },
                  ],
                  context_token: msg.context_token,
                },
              });
            } else {
              // oxlint-disable-next-line eslint/no-await-in-loop
              const uploaded = await uploadFileToWeixinCdn({
                filePath: localPath,
                toUserId: conversationId,
                cdnBaseUrl,
                getUploadUrl: uploadGetUploadUrl,
              });
              const fileName = response.media.fileName || path.basename(localPath);

              if (response.text?.trim()) {
                // oxlint-disable-next-line eslint/no-await-in-loop
                await callSendMessage(baseUrl, token, wechatUin, {
                  msg: {
                    to_user_id: conversationId,
                    client_id: crypto.randomUUID(),
                    message_type: MessageType.BOT,
                    message_state: MessageState.FINISH,
                    item_list: [{ type: MessageItemType.TEXT, text_item: { text: response.text } }],
                    context_token: msg.context_token,
                  },
                });
              }
              // oxlint-disable-next-line eslint/no-await-in-loop
              await callSendMessage(baseUrl, token, wechatUin, {
                msg: {
                  to_user_id: conversationId,
                  client_id: crypto.randomUUID(),
                  message_type: MessageType.BOT,
                  message_state: MessageState.FINISH,
                  item_list: [
                    {
                      type: MessageItemType.FILE,
                      file_item: {
                        media: {
                          encrypt_query_param: uploaded.downloadEncryptedQueryParam,
                          aes_key: Buffer.from(uploaded.aesKeyHex).toString('base64'),
                          encrypt_type: 1,
                        },
                        file_name: fileName,
                        len: String(uploaded.fileSize),
                      },
                    },
                  ],
                  context_token: msg.context_token,
                },
              });
            }
          } catch (sendErr) {
            log(`[weixin] send media error for ${conversationId}: ${formatError(sendErr)}`);
          }
          continue;
        }

        if (response.text) {
          try {
            // oxlint-disable-next-line eslint/no-await-in-loop
            await callSendMessage(baseUrl, token, wechatUin, {
              msg: {
                to_user_id: conversationId,
                client_id: crypto.randomUUID(),
                message_type: MessageType.BOT,
                message_state: MessageState.FINISH,
                item_list: [{ type: MessageItemType.TEXT, text_item: { text: response.text } }],
                context_token: msg.context_token,
              },
            });
          } catch (sendErr) {
            log(`[weixin] send text error for ${conversationId}: ${formatError(sendErr)}`);
          }
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      consecutiveFailures++;
      log(`[weixin] getUpdates error (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${String(err)}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        consecutiveFailures = 0;
        // oxlint-disable-next-line eslint/no-await-in-loop
        await sleep(BACKOFF_DELAY_MS, signal);
      } else {
        // oxlint-disable-next-line eslint/no-await-in-loop
        await sleep(RETRY_DELAY_MS, signal);
      }
    }
  }
}

/**
 * Start the long-poll monitor in the background (non-blocking).
 * Errors are logged via opts.log. Loop stops when abortSignal fires.
 */
export function startMonitor(opts: MonitorOptions): void {
  const { baseUrl, cdnBaseUrl, token, accountId, dataDir, agent, abortSignal, log } = opts;
  const logFn = log ?? ((_msg: string) => {});
  const wechatUin = crypto.randomBytes(4).toString('base64');
  const resolvedCdnBaseUrl = cdnBaseUrl || DEFAULT_WEIXIN_CDN_BASE_URL;

  void runMonitor(baseUrl, resolvedCdnBaseUrl, token, accountId, dataDir, agent, wechatUin, abortSignal, logFn).catch(
    (err: unknown) => {
      if (!abortSignal?.aborted) {
        logFn(`[weixin] monitor terminated unexpectedly: ${String(err)}`);
      }
    }
  );
}
