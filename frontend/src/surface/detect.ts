export type Surface = "tma" | "web";

// We are inside a Telegram Mini App iff the bridge injected a non-empty
// signed initData string. initDataUnsafe can be present in cached states
// without a valid signature, so initData is the only reliable signal.
export function isTMA(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.Telegram?.WebApp?.initData &&
    window.Telegram.WebApp.initData.length > 0
  );
}

export function getSurface(): Surface {
  return isTMA() ? "tma" : "web";
}
