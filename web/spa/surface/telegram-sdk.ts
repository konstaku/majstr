import { isTMA } from "./detect";

let inited = false;

// Lazily prepare the Telegram environment. Only runs inside a Mini App.
// Raw WebApp.ready()/expand() is the reliable primary. (The optional
// @telegram-apps/sdk init was dropped in the Next collapse — it was a no-op
// opportunistic call with no consumers; re-add the dep here if richer SDK
// APIs are ever needed.)
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
}
