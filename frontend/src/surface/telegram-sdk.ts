import { isTMA } from "./detect";

let inited = false;

// Lazily prepare the Telegram environment. Only runs inside a Mini App.
// Raw WebApp.ready()/expand() is the reliable primary; the @telegram-apps
// SDK is initialised opportunistically for richer APIs later, but a failure
// there must never break the (web or TMA) app.
export async function initTelegramSDK(): Promise<void> {
  if (inited || !isTMA()) return;
  inited = true;

  const wa = window.Telegram?.WebApp;
  try {
    wa?.ready();
    wa?.expand();
  } catch (e) {
    console.error("Telegram WebApp ready/expand failed", e);
  }

  try {
    const sdk = await import("@telegram-apps/sdk");
    if (typeof (sdk as { init?: () => void }).init === "function") {
      (sdk as { init: () => void }).init();
    }
  } catch (e) {
    console.error("@telegram-apps/sdk init skipped", e);
  }
}
