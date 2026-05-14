/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export const MessageItemType = {
  NONE: 0,
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5,
} as const;

export const UploadMediaType = {
  IMAGE: 1,
  VIDEO: 2,
  FILE: 3,
} as const;

export const MessageType = {
  NONE: 0,
  USER: 1,
  BOT: 2,
} as const;

export const MessageState = {
  NEW: 0,
  GENERATING: 1,
  FINISH: 2,
} as const;

export type CDNMedia = {
  encrypt_query_param?: string;
  aes_key?: string;
  encrypt_type?: number;
};

export type TextItem = {
  text?: string;
};

export type ImageItem = {
  media?: CDNMedia;
  thumb_media?: CDNMedia;
  aeskey?: string;
  mid_size?: number;
  thumb_size?: number;
  thumb_height?: number;
  thumb_width?: number;
  hd_size?: number;
};

export type VoiceItem = {
  media?: CDNMedia;
  encode_type?: number;
  bits_per_sample?: number;
  sample_rate?: number;
  playtime?: number;
  text?: string;
};

export type FileItem = {
  media?: CDNMedia;
  file_name?: string;
  md5?: string;
  len?: string;
};

export type VideoItem = {
  media?: CDNMedia;
  video_size?: number;
  play_length?: number;
  video_md5?: string;
  thumb_media?: CDNMedia;
  thumb_size?: number;
  thumb_height?: number;
  thumb_width?: number;
};

export type MessageItem = {
  type?: number;
  text_item?: TextItem;
  image_item?: ImageItem;
  voice_item?: VoiceItem;
  file_item?: FileItem;
  video_item?: VideoItem;
};

export type WeixinRawMessage = {
  from_user_id?: string;
  context_token?: string;
  item_list?: MessageItem[];
};

export type GetUploadUrlReq = {
  filekey?: string;
  media_type?: number;
  to_user_id?: string;
  rawsize?: number;
  rawfilemd5?: string;
  filesize?: number;
  no_need_thumb?: boolean;
  aeskey?: string;
};

export type GetUploadUrlResp = {
  upload_param?: string;
};

export type UploadedFileInfo = {
  filekey: string;
  downloadEncryptedQueryParam: string;
  aesKeyHex: string;
  fileSize: number;
  fileSizeCiphertext: number;
};

export type WeixinInboundAttachment = {
  kind: 'image' | 'voice' | 'file' | 'video';
  filePath: string;
  fileName?: string;
  mimeType: string;
  size?: number;
  duration?: number;
};
