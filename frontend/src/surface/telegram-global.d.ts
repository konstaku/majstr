// Minimal typings for the Telegram WebApp bridge injected by
// https://telegram.org/js/telegram-web-app.js inside the Mini App.
// We only declare what the surface layer actually reads.

export interface TgWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface TgCloudStorage {
  setItem(
    key: string,
    value: string,
    cb?: (err: Error | null, ok?: boolean) => void
  ): void;
  getItem(
    key: string,
    cb: (err: Error | null, value?: string) => void
  ): void;
  removeItem(
    key: string,
    cb?: (err: Error | null, ok?: boolean) => void
  ): void;
}

export interface TgMainButton {
  setText(text: string): TgMainButton;
  show(): TgMainButton;
  hide(): TgMainButton;
  enable(): TgMainButton;
  disable(): TgMainButton;
  showProgress(leaveActive?: boolean): TgMainButton;
  hideProgress(): TgMainButton;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

export interface TgBackButton {
  show(): TgBackButton;
  hide(): TgBackButton;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

export interface TgHapticFeedback {
  impactOccurred(
    style: "light" | "medium" | "heavy" | "rigid" | "soft"
  ): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
}

export interface TgPopupButton {
  id?: string;
  type?: "default" | "ok" | "close" | "cancel" | "destructive";
  text?: string;
}

export interface TgWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TgWebAppUser;
    start_param?: string;
  };
  themeParams: Record<string, string>;
  colorScheme: "light" | "dark";
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  ready(): void;
  expand(): void;
  close(): void;
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
  CloudStorage?: TgCloudStorage;
  MainButton: TgMainButton;
  BackButton: TgBackButton;
  HapticFeedback: TgHapticFeedback;
  showPopup(
    params: { title?: string; message: string; buttons?: TgPopupButton[] },
    cb?: (buttonId: string) => void
  ): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export {};
