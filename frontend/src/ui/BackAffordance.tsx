import { useEffect, useRef } from "react";
import { isTMA } from "../surface/detect";

export interface BackAffordanceProps {
  onBack: () => void;
  // Hide entirely (e.g. wizard step 1). Default visible.
  visible?: boolean;
}

// Back navigation. TMA drives the native BackButton; web renders a
// top-left chevron. Same onBack contract either way.
export function BackAffordance({ onBack, visible = true }: BackAffordanceProps) {
  const backRef = useRef(onBack);
  backRef.current = onBack;

  useEffect(() => {
    if (!isTMA()) return;
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb) return;
    const handler = () => backRef.current();
    if (visible) {
      bb.onClick(handler);
      bb.show();
    } else {
      bb.hide();
    }
    return () => {
      bb.offClick(handler);
      bb.hide();
    };
  }, [visible]);

  if (isTMA() || !visible) return null;

  return (
    <button
      type="button"
      aria-label="Back"
      className="back-affordance"
      onClick={() => backRef.current()}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 8,
        color: "var(--app-fg)",
        fontSize: 20,
        lineHeight: 1,
      }}
    >
      ‹
    </button>
  );
}
