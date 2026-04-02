// WebUI 状态接口 / WebUI status interface
export interface WebUIStatus {
  running: boolean;
  port: number;
  allowRemote: boolean;
  localUrl: string;
  networkUrl?: string;
  lanIP?: string;
  adminUsername: string;
  initialPassword?: string;
  localAccessEnabled: boolean;
  localAccessAllowRemote: boolean;
}

export interface ElectronBridgeAPI {
  emit: (name: string, data: unknown) => Promise<unknown> | void;
  on: (callback: (event: { value: string }) => void) => void;
  // 获取拖拽文件/目录的绝对路径 / Get absolute path for dragged file/directory
  getPathForFile?: (file: File) => string;
  // 直接 IPC: 打开外部链接 / Direct IPC: Open external URL
  shellOpenExternal?: (url: string) => Promise<void>;
  // WeChat QR-code login / 微信二维码登录
  weixinLoginStart?: () => Promise<{ accountId: string; botToken: string; scannerUserId?: string }>;
  weixinLoginOnQR?: (callback: (data: { qrcodeUrl: string }) => void) => () => void;
  weixinLoginOnScanned?: (callback: () => void) => () => void;
  weixinLoginOnDone?: (callback: (data: { accountId: string; scannerUserId?: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI;
  }
}
