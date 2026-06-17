"use client";

import type { ReactNode } from "react";
import { MasterContextProvider } from "./context";
import Root from "./components/Root";

// Seeds the REAL MasterContext with server-fetched data, then renders the REAL
// header/footer (Root) around the page. Because this is a client provider,
// client components nested inside still server-render their initial HTML using
// the seed — so crawlers get the real grid/cards.
export default function AppShell({
  seed,
  children,
  showWordmark = true,
}: {
  // Partial<State> from the server (typed loosely to avoid cross-package friction)
  seed: Record<string, unknown>;
  children: ReactNode;
  // Content pages (About, etc.) hide the big search/main-page wordmark hero.
  showWordmark?: boolean;
}) {
  return (
    <MasterContextProvider initial={seed}>
      <Root showWordmark={showWordmark}>{children}</Root>
    </MasterContextProvider>
  );
}
