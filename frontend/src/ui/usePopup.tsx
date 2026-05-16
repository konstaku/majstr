import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { isTMA } from "../surface/detect";

export interface PopupButton {
  id: string;
  text: string;
  type?: "default" | "destructive" | "cancel";
}
export interface PopupOptions {
  title?: string;
  message: string;
  buttons?: PopupButton[];
}

type PopupFn = (opts: PopupOptions) => Promise<string>;

const PopupContext = createContext<PopupFn | null>(null);

const DEFAULT_BUTTONS: PopupButton[] = [{ id: "ok", text: "OK" }];

export function PopupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PopupOptions | null>(null);
  const resolverRef = useRef<((id: string) => void) | null>(null);

  const popup = useCallback<PopupFn>((opts) => {
    const buttons = opts.buttons?.length ? opts.buttons : DEFAULT_BUTTONS;

    // Native Telegram popup — no DOM needed.
    if (isTMA() && window.Telegram?.WebApp?.showPopup) {
      return new Promise<string>((resolve) => {
        window.Telegram!.WebApp!.showPopup(
          {
            title: opts.title,
            message: opts.message,
            buttons: buttons.map((b) => ({
              id: b.id,
              text: b.text,
              type: b.type === "destructive" ? "destructive" : "default",
            })),
          },
          (id) => resolve(id || "")
        );
      });
    }

    // Web portal modal.
    return new Promise<string>((resolve) => {
      resolverRef.current = resolve;
      setState({ ...opts, buttons });
    });
  }, []);

  const choose = (id: string) => {
    setState(null);
    resolverRef.current?.(id);
    resolverRef.current = null;
  };

  return (
    <PopupContext.Provider value={popup}>
      {children}
      {state &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => choose("")}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--app-bg)",
                color: "var(--app-fg)",
                borderRadius: 12,
                padding: 20,
                maxWidth: 320,
                width: "85%",
              }}
            >
              {state.title && (
                <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>
                  {state.title}
                </h3>
              )}
              <p style={{ margin: "0 0 16px", color: "var(--app-hint)" }}>
                {state.message}
              </p>
              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
              >
                {state.buttons!.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => choose(b.id)}
                    style={{
                      padding: "8px 14px",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: 600,
                      background:
                        b.type === "destructive"
                          ? "var(--app-destructive)"
                          : b.type === "cancel"
                          ? "var(--app-secondary-bg)"
                          : "var(--app-accent)",
                      color:
                        b.type === "cancel"
                          ? "var(--app-fg)"
                          : "var(--app-accent-fg)",
                    }}
                  >
                    {b.text}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </PopupContext.Provider>
  );
}

export function usePopup(): PopupFn {
  const ctx = useContext(PopupContext);
  if (!ctx) {
    throw new Error("usePopup must be used within <PopupProvider>");
  }
  return ctx;
}
