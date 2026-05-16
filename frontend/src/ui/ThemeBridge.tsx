import { useEffect } from "react";
import { useTelegramContext } from "../surface/useTelegramContext";

// Reflects the surface + Telegram theme onto <html> so tokens.css can
// remap --app-* without any component touching --tg-theme-* directly.
export function ThemeBridge() {
  const { isTMA, theme, colorScheme } = useTelegramContext();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.surface = isTMA ? "tma" : "web";

    if (isTMA) {
      root.style.colorScheme = colorScheme;
      for (const [key, value] of Object.entries(theme)) {
        // themeParams keys are snake_case e.g. bg_color → --tg-theme-bg-color
        root.style.setProperty(
          `--tg-theme-${key.replace(/_/g, "-")}`,
          value
        );
      }
    }
  }, [isTMA, theme, colorScheme]);

  return null;
}
