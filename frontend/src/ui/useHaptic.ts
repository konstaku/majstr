import { isTMA } from "../surface/detect";

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationType = "error" | "success" | "warning";

export interface Haptic {
  impact(style?: ImpactStyle): void;
  notify(type: NotificationType): void;
  selection(): void;
}

const noop: Haptic = {
  impact: () => {},
  notify: () => {},
  selection: () => {},
};

// Telegram haptics inside the Mini App, silent no-op on web.
export function useHaptic(): Haptic {
  if (!isTMA()) return noop;
  const hf = window.Telegram?.WebApp?.HapticFeedback;
  if (!hf) return noop;
  return {
    impact: (style = "light") => hf.impactOccurred(style),
    notify: (type) => hf.notificationOccurred(type),
    selection: () => hf.selectionChanged(),
  };
}
