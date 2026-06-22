"use client";

import { useEffect, type ReactNode } from "react";
import { TelegramContextProvider } from "@/spa/surface/useTelegramContext";
import { ThemeBridge } from "@/spa/ui/ThemeBridge";
import { PopupProvider } from "@/spa/ui/usePopup";
import { MasterContextProvider } from "@/spa/context";
import { initAnalytics } from "@/spa/analytics";

// Client provider stack for the interactive app surfaces. The
// MasterContextProvider is mounted WITHOUT a server seed, so it runs in the
// app-surface mode (client lang-sync from localStorage; no catalogue prefetch).
export default function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <TelegramContextProvider>
      <ThemeBridge />
      <PopupProvider>
        <MasterContextProvider>{children}</MasterContextProvider>
      </PopupProvider>
    </TelegramContextProvider>
  );
}
