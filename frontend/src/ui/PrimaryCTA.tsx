import { useEffect, useRef } from "react";
import { isTMA } from "../surface/detect";

export interface PrimaryCTAProps {
  label: string;
  onPress: () => void | Promise<void>;
  isLoading?: boolean;
  isEnabled?: boolean;
}

// The single primary action. Inside Telegram it drives the native
// MainButton; on web it renders a sticky bottom button. Call sites are
// surface-agnostic.
export function PrimaryCTA({
  label,
  onPress,
  isLoading = false,
  isEnabled = true,
}: PrimaryCTAProps) {
  // Keep the latest onPress without re-registering the TG click handler.
  const pressRef = useRef(onPress);
  pressRef.current = onPress;

  if (isTMA()) {
    return (
      <TmaMainButton
        label={label}
        isLoading={isLoading}
        isEnabled={isEnabled}
        pressRef={pressRef}
      />
    );
  }

  return (
    <button
      type="button"
      className="primary-cta"
      disabled={!isEnabled || isLoading}
      onClick={() => pressRef.current()}
      style={{
        position: "sticky",
        bottom: 0,
        width: "100%",
        padding: "16px",
        border: "none",
        fontSize: 16,
        fontWeight: 600,
        cursor: !isEnabled || isLoading ? "not-allowed" : "pointer",
        opacity: !isEnabled ? 0.5 : 1,
        background: "var(--app-accent)",
        color: "var(--app-accent-fg)",
      }}
    >
      {isLoading ? "…" : label}
    </button>
  );
}

function TmaMainButton({
  label,
  isLoading,
  isEnabled,
  pressRef,
}: {
  label: string;
  isLoading: boolean;
  isEnabled: boolean;
  pressRef: React.MutableRefObject<() => void | Promise<void>>;
}) {
  useEffect(() => {
    const mb = window.Telegram?.WebApp?.MainButton;
    if (!mb) return;
    const handler = () => pressRef.current();
    mb.onClick(handler);
    mb.show();
    return () => {
      mb.offClick(handler);
      mb.hide();
    };
  }, [pressRef]);

  useEffect(() => {
    const mb = window.Telegram?.WebApp?.MainButton;
    if (!mb) return;
    mb.setText(label);
    if (isLoading) mb.showProgress(true);
    else mb.hideProgress();
    if (isEnabled && !isLoading) mb.enable();
    else mb.disable();
  }, [label, isLoading, isEnabled]);

  return null;
}
