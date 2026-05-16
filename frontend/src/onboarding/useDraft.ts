import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { apiFetch } from "../api/client";
import { usePopup } from "../ui/usePopup";
import type { DraftData } from "./schema";
import { serverDraftToForm, formToServerPatch } from "./schema";

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

class PatchError extends Error {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(status: number, body: any) {
    super(`patch_${status}`);
    this.status = status;
    this.body = body;
  }
}

const is4xx = (e: unknown): e is PatchError =>
  e instanceof PatchError && e.status >= 400 && e.status < 500;

function describePatchError(e: unknown): string {
  if (e instanceof PatchError) {
    if (e.status === 409)
      return "У вас вже є активна картка майстра — створити ще одну не можна.";
    if (e.status === 401)
      return "Сесію не підтверджено. Закрийте і відкрийте міні-застосунок.";
    if (e.status === 422) {
      const fields = e.body?.errors
        ? Object.keys(e.body.errors).join(", ")
        : "";
      return `Дані не збережено — помилка перевірки${fields ? ` (${fields})` : ""}.`;
    }
    return `Не вдалося зберегти (помилка ${e.status}).`;
  }
  return "Немає звʼязку. Дані збережено локально — повторимо пізніше.";
}

async function sendPatch(payload: Partial<DraftData>, attempt = 0): Promise<void> {
  let res: Response;
  try {
    res = await apiFetch("/api/masters/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToServerPatch(payload)),
    });
  } catch (netErr) {
    // Network failure — transient, retry then queue for next session.
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return sendPatch(payload, attempt + 1);
    }
    enqueue(payload);
    throw netErr;
  }

  if (res.ok) {
    localStorage.setItem(LAST_EDIT_KEY, Date.now().toString());
    return;
  }

  // 4xx (422 validation, 409 already-has-card, 401 auth) is permanent:
  // retrying or queuing only poisons the offline queue forever and hides
  // the real reason behind a generic "saved locally" message. Surface it.
  if (res.status >= 400 && res.status < 500) {
    const body = await res.json().catch(() => ({}));
    throw new PatchError(res.status, body);
  }

  // 5xx — transient server error: retry then queue.
  if (attempt < MAX_RETRIES - 1) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    return sendPatch(payload, attempt + 1);
  }
  enqueue(payload);
  throw new PatchError(res.status, {});
}

async function drainQueue() {
  const q = loadQueue();
  if (!q.length) return;
  const remaining: QueuedPatch[] = [];
  for (const item of q) {
    try {
      await sendPatch(item.payload);
    } catch (e) {
      // Drop items rejected with 4xx — they will never succeed and would
      // otherwise block every future session with a stale "saved locally".
      if (!is4xx(e)) remaining.push(item);
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

export interface SubmitResult {
  ok: boolean;
  status?: string;
  errors?: Record<string, string>;
  error?: string;
}

export interface UseDraftResult {
  isSyncing: boolean;
  syncError: string | null;
  isSubmitting: boolean;
  submit: () => Promise<SubmitResult>;
}

export function useDraft(form: UseFormReturn<DraftData>): UseDraftResult {
  const popup = usePopup();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        } catch (e) {
          setSyncError(describePatchError(e));
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

  // Flush any pending edits, then promote the draft to a pending master.
  const submit = async (): Promise<SubmitResult> => {
    setIsSubmitting(true);
    try {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      const current = form.getValues() as Partial<DraftData>;
      const diff = diffPayload(current, serverSnap.current);
      if (Object.keys(diff).length) {
        try {
          await sendPatch(diff);
          serverSnap.current = { ...serverSnap.current, ...diff };
        } catch (e) {
          if (e instanceof PatchError && e.status === 409)
            return { ok: false, error: "active_master_exists" };
          if (e instanceof PatchError && e.status === 422)
            return { ok: false, error: "validation", errors: e.body?.errors };
          return { ok: false, error: "offline" };
        }
      }

      const res = await apiFetch("/api/masters/draft/submit", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: true, status: data.status };
      }
      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, errors: data.errors, error: "validation" };
      }
      if (res.status === 409) return { ok: false, error: "active_master_exists" };
      if (res.status === 404) return { ok: false, error: "no_draft" };
      return { ok: false, error: "server" };
    } catch {
      return { ok: false, error: "network" };
    } finally {
      setIsSubmitting(false);
    }
  };

  return { isSyncing, syncError, isSubmitting, submit };
}
