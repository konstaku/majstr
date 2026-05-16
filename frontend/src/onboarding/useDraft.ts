import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { apiFetch } from "../api/client";
import { usePopup } from "../ui/usePopup";
import type { DraftData } from "./schema";
import { serverDraftToForm } from "./schema";

const QUEUE_KEY = "draft:failed-queue";
const LAST_EDIT_KEY = "draft:last-edit";
const DEBOUNCE_MS = 500;
const MAX_RETRIES = 3;
const CONFLICT_THRESHOLD_MS = 30_000;

interface QueuedPatch {
  payload: Partial<DraftData>;
  timestamp: number;
}

function loadQueue(): QueuedPatch[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function enqueue(payload: Partial<DraftData>) {
  const q = loadQueue();
  q.push({ payload, timestamp: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

async function sendPatch(payload: Partial<DraftData>, attempt = 0): Promise<void> {
  try {
    const res = await apiFetch("/api/masters/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(res.status.toString());
    localStorage.setItem(LAST_EDIT_KEY, Date.now().toString());
  } catch (err) {
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return sendPatch(payload, attempt + 1);
    }
    // All retries exhausted — persist so next session can retry.
    enqueue(payload);
    throw err;
  }
}

async function drainQueue() {
  const q = loadQueue();
  if (!q.length) return;
  const remaining: QueuedPatch[] = [];
  for (const item of q) {
    try {
      await sendPatch(item.payload);
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

function diffPayload(
  current: Partial<DraftData>,
  snap: Partial<DraftData>
): Partial<DraftData> {
  const diff: Partial<DraftData> = {};
  for (const key of Object.keys(current) as Array<keyof DraftData>) {
    if (JSON.stringify(current[key]) !== JSON.stringify(snap[key])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (diff as any)[key] = current[key];
    }
  }
  return diff;
}

export interface UseDraftResult {
  isSyncing: boolean;
  syncError: string | null;
}

export function useDraft(form: UseFormReturn<DraftData>): UseDraftResult {
  const popup = usePopup();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Tracks what the server last confirmed so we only PATCH changed fields.
  const serverSnap = useRef<Partial<DraftData>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount: GET draft, conflict check, hydrate form, drain offline queue.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch("/api/masters/draft", undefined, {
          redirectOn401: false,
        });
        if (res.status === 404 || !res.ok) return; // no draft yet — start fresh

        const { draft } = await res.json();
        if (cancelled || !draft) return;

        serverSnap.current = serverDraftToForm(draft);

        // Conflict: server is >30s newer than our last known local edit.
        const lastEdit = parseInt(localStorage.getItem(LAST_EDIT_KEY) ?? "0", 10);
        const serverTime = new Date(draft.updatedAt).getTime();

        if (lastEdit && serverTime > lastEdit + CONFLICT_THRESHOLD_MS) {
          const choice = await popup({
            title: "Редагувалося на іншому пристрої",
            message:
              "Ви редагували цю картку нещодавно на іншому пристрої. Завантажити останню версію?",
            buttons: [
              { id: "load", text: "Завантажити" },
              { id: "keep", text: "Залишити", type: "cancel" },
            ],
          });
          if (choice !== "load") return;
        }

        form.reset(serverSnap.current);
      } catch {
        // Network error on mount — continue with empty defaults.
      }

      drainQueue();
    })();

    return () => {
      cancelled = true;
    };
    // form.reset identity is stable; popup is stable from context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch form values → debounced differential PATCH.
  useEffect(() => {
    const { unsubscribe } = form.watch((values) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        const diff = diffPayload(values as Partial<DraftData>, serverSnap.current);
        if (!Object.keys(diff).length) return;

        setIsSyncing(true);
        setSyncError(null);
        try {
          await sendPatch(diff);
          serverSnap.current = { ...serverSnap.current, ...diff };
        } catch {
          setSyncError("Не вдалося зберегти. Дані збережено локально.");
        } finally {
          setIsSyncing(false);
        }
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form]);

  return { isSyncing, syncError };
}
