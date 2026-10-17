"use client";

import { useCallback, useEffect, useState } from "react";

/** A per-browser UI preference in localStorage (best-effort; never required). */
export function usePreference<T>(key: string, initial: T, isValid: (v: unknown) => v is T): [T, (v: T) => void] {
  const storageKey = `zoxa-console:${key}`;
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount
        if (isValid(parsed)) setValue(parsed);
      }
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(storageKey, JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey],
  );
  return [value, set];
}

export const isString = (v: unknown): v is string => typeof v === "string";
export const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
