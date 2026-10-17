"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { createDraft, loadStoredDraft, storeDraft, type CallMode, type Draft } from "@/lib/draft";
import { getIn, jsonEqual, setIn, type Path } from "@/lib/path";
import { schemaDefaults } from "@/lib/zoxa/catalog";
import type { AgentConfig } from "@/lib/zoxa/types";

interface DraftApi {
  draft: Draft;
  setDraft: (update: Draft | ((d: Draft) => Draft)) => void;
  setAgentAt: (path: Path, value: unknown) => void;
  setMode: (mode: CallMode) => void;
  /** Agent edits differ from the loaded server copy. */
  dirty: boolean;
  hydrated: boolean;
}

const Ctx = createContext<DraftApi | null>(null);

const DEFAULTS = schemaDefaults();

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Raw value with schema defaults filled underneath, recursively for objects. */
function withDefaults(fallback: unknown, raw: unknown): unknown {
  if (raw === undefined) return fallback;
  if (isPlainObject(fallback) && isPlainObject(raw)) {
    const out: Record<string, unknown> = { ...fallback };
    for (const [k, v] of Object.entries(raw)) out[k] = withDefaults(fallback[k], v);
    return out;
  }
  if (raw === null && isPlainObject(fallback)) return fallback;
  return raw;
}
const PERSIST_DELAY_MS = 400;

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<Draft>(createDraft);
  const [hydrated, setHydrated] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore after mount (localStorage is unavailable during SSR).
  useEffect(() => {
    const stored = loadStoredDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
    if (stored) setDraftState(stored);
    setHydrated(true);
  }, []);

  // Persist with a short debounce while typing…
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
    if (!hydrated) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => storeDraft(draft), PERSIST_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, hydrated]);

  // …and flush immediately when the page is hidden or unloaded, so a reload or
  // tab close right after an edit never loses it.
  useEffect(() => {
    if (!hydrated) return;
    const flush = () => storeDraft(latest.current);
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hydrated]);

  const setDraft = useCallback((update: Draft | ((d: Draft) => Draft)) => {
    setDraftState((d) => (typeof update === "function" ? update(d) : update));
  }, []);

  const setAgentAt = useCallback((path: Path, value: unknown) => {
    setDraftState((d) => ({ ...d, agent: setIn(d.agent, path, value) }));
  }, []);

  const setMode = useCallback((mode: CallMode) => {
    setDraftState((d) => {
      const extras = { ...d.extras };
      delete extras.agent;
      delete extras.agentId;
      return { ...d, mode, extras };
    });
  }, []);

  const dirty = useMemo(
    () => (draft.loaded ? !jsonEqual(draft.loaded.config, draft.agent) : false),
    [draft.loaded, draft.agent],
  );

  const api = useMemo(
    () => ({ draft, setDraft, setAgentAt, setMode, dirty, hydrated }),
    [draft, setDraft, setAgentAt, setMode, dirty, hydrated],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useDraft(): DraftApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDraft must be used inside <DraftProvider>");
  return ctx;
}

/**
 * Bind one agent field by path. Missing values (partial raw configs) read as
 * the schema default, so every control always has a sane value to show.
 */
export function useAgentField<T>(path: Path): [T, (value: T) => void] {
  const { draft, setAgentAt } = useDraft();
  const raw = getIn(draft.agent, path);
  const value = withDefaults(getIn(DEFAULTS, path), raw) as T;
  const key = path.join(".");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const set = useCallback((v: T) => setAgentAt(path, v), [key, setAgentAt]);
  return [value, set];
}

export function useAgent(): AgentConfig {
  return useDraft().draft.agent;
}
