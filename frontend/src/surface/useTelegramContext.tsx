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

const TelegramContext = createContext<TelegramContextValue | null>(null);

export function TelegramContextProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<TelegramContextValue>(() =>
    readSnapshot()
  );

  useEffect(() => {
    if (!isTMA()) return;
    initTelegramSDK();

    const wa = window.Telegram?.WebApp;
    if (!wa) return;
    const refresh = () => setSnapshot(readSnapshot());
    wa.onEvent("viewportChanged", refresh);
    wa.onEvent("themeChanged", refresh);
    return () => {
      wa.offEvent("viewportChanged", refresh);
      wa.offEvent("themeChanged", refresh);
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
