"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { Button } from "./controls";

/* ───────────────────────────── Toasts ───────────────────────────── */

type Tone = "ok" | "err" | "info" | "warn";
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  detail?: ReactNode;
}

interface FeedbackApi {
  toast: (tone: Tone, title: string, detail?: ReactNode) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

const Ctx = createContext<FeedbackApi | null>(null);
const ICON = { ok: CheckCircle2, err: XCircle, info: Info, warn: AlertTriangle };
const TONE = { ok: "text-ok", err: "text-err", info: "text-info", warn: "text-warn" };
const TOAST_MS = { ok: 3500, info: 4500, warn: 6000, err: 8000 };
const MAX_TOASTS = 4;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (tone: Tone, title: string, detail?: ReactNode) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-(MAX_TOASTS - 1)), { id, tone, title, detail }]);
      timers.current.set(id, setTimeout(() => dismiss(id), TOAST_MS[tone]));
    },
    [dismiss],
  );

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })), []);

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-20 z-[90] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 lg:bottom-4">
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} className="rise pointer-events-auto flex gap-3 rounded-xl bg-panel p-3 shadow-2xl ring-1 ring-line">
              <Icon size={16} className={cn("mt-0.5 shrink-0", TONE[t.tone])} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{t.title}</div>
                {t.detail && <div className="mt-0.5 text-[12px] leading-snug break-words text-muted">{t.detail}</div>}
              </div>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-faint hover:text-fg">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      {pending && <ConfirmDialog {...pending} onClose={close} />}
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}

/* ───────────────────────────── Dialog ───────────────────────────── */

function ConfirmDialog({ title, body, confirmLabel = "Confirm", danger, onClose }: ConfirmOptions & { onClose: (v: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={() => onClose(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="rise w-full max-w-sm rounded-2xl bg-panel p-5 shadow-2xl ring-1 ring-line"
      >
        <h2 className="font-serif text-[22px] leading-tight italic">{title}</h2>
        {body && <div className="mt-2 text-[13px] leading-relaxed text-muted">{body}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button ref={confirmRef} variant={danger ? "danger" : "primary"} onClick={() => onClose(true)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
