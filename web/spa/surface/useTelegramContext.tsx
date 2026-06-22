"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSurface, isTMA, type Surface } from "./detect";
import { initTelegramSDK } from "./telegram-sdk";
import type { TgWebAppUser } from "./telegram-global";

export type TelegramUser = TgWebAppUser;

export interface CloudAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface TelegramContextValue {
  surface: Surface;
  isTMA: boolean;
  initData: string | null;
  user: TelegramUser | null;
  theme: Record<string, string>;
  colorScheme: "light" | "dark";
  viewport: { height: number; stable: number; isExpanded: boolean };
  startParam: string | null;
  cloud: CloudAdapter;
}

const localStorageCloud: CloudAdapter = {
  async get(k) {
    return localStorage.getItem(k);
  },
  async set(k, v) {
    localStorage.setItem(k, v);
  },
  async remove(k) {
    localStorage.removeItem(k);
  },
};

function makeTmaCloud(): CloudAdapter {
  const cs = window.Telegram?.WebApp?.CloudStorage;
  if (!cs) return localStorageCloud;
  return {
    get: (k) =>
      new Promise((resolve) =>
        cs.getItem(k, (err, val) => resolve(err ? null : val ?? null))
      ),
    set: (k, v) =>
      new Promise((resolve, reject) =>
        cs.setItem(k, v, (err) => (err ? reject(err) : resolve()))
      ),
    remove: (k) =>
      new Promise((resolve) => cs.removeItem(k, () => resolve())),
  };
}

function readSnapshot(): TelegramContextValue {
  const surface = getSurface();
  const tma = isTMA();
  const wa = tma ? window.Telegram?.WebApp : undefined;

  return {
    surface,
    isTMA: tma,
    initData: wa?.initData ?? null,
    user: wa?.initDataUnsafe?.user ?? null,
    theme: wa?.themeParams ?? {},
    colorScheme: wa?.colorScheme ?? "light",
    viewport: {
      height: wa?.viewportHeight ?? (typeof window !== "undefined" ? window.innerHeight : 0),
      stable: wa?.viewportStableHeight ?? (typeof window !== "undefined" ? window.innerHeight : 0),
      isExpanded: wa?.isExpanded ?? true,
    },
    startParam: wa?.initDataUnsafe?.start_param ?? null,
    cloud: tma ? makeTmaCloud() : localStorageCloud,
  };
}

// Deterministic, window-free default. Used as the initial state so the server
// render and the first client render are identical (no hydration mismatch) —
// equal to what readSnapshot() returns when window is absent.
const WEB_DEFAULT: TelegramContextValue = {
  surface: "web",
  isTMA: false,
  initData: null,
  user: null,
  theme: {},
  colorScheme: "light",
  viewport: { height: 0, stable: 0, isExpanded: true },
  startParam: null,
  cloud: localStorageCloud,
};

const TelegramContext = createContext<TelegramContextValue | null>(null);

export function TelegramContextProvider({ children }: { children: ReactNode }) {
  // Start from the static default; the effect re-reads the real Telegram
  // snapshot after mount. Reading window.Telegram during the initial render
  // would desync from the server HTML.
  const [snapshot, setSnapshot] = useState<TelegramContextValue>(WEB_DEFAULT);

  useEffect(() => {
    // The Telegram bridge (telegram-web-app.js) may not have executed yet when
    // this effect runs — under Next the script doesn't block hydration the way
    // Vite's classic <head> script did. A one-shot `if (!isTMA()) return` would
    // then latch into "web" mode forever (no user → name never prefills → the
    // wizard's Next button stays disabled). So poll briefly for the bridge and
    // wire up the moment it appears.
    let cleanup: (() => void) | undefined;

    const wire = (): boolean => {
      const wa = window.Telegram?.WebApp;
      setSnapshot(readSnapshot());
      if (!wa || !isTMA()) return false;
      initTelegramSDK();
      const refresh = () => setSnapshot(readSnapshot());
      wa.onEvent("viewportChanged", refresh);
      wa.onEvent("themeChanged", refresh);
      cleanup = () => {
        wa.offEvent("viewportChanged", refresh);
        wa.offEvent("themeChanged", refresh);
      };
      return true;
    };

    if (wire()) return () => cleanup?.();

    // Bridge not ready — poll for up to ~3s (50ms × 60), then give up (web).
    let tries = 0;
    const id = setInterval(() => {
      if (wire() || ++tries > 60) clearInterval(id);
    }, 50);
    return () => {
      clearInterval(id);
      cleanup?.();
    };
  }, []);

  const value = useMemo(() => snapshot, [snapshot]);

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegramContext(): TelegramContextValue {
  const ctx = useContext(TelegramContext);
  if (!ctx) {
    throw new Error(
      "useTelegramContext must be used within <TelegramContextProvider>"
    );
  }
  return ctx;
}
