"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal cached async resource. Results are cached per key for the page's
 * lifetime (catalog data rarely changes); `reload()` refetches. A key of
 * `null` skips fetching.
 */

interface Entry<T> {
  promise: Promise<T>;
  data?: T;
  error?: unknown;
}

const cache = new Map<string, Entry<unknown>>();

function load<T>(key: string, fetcher: () => Promise<T>, force: boolean): Entry<T> {
  const existing = cache.get(key) as Entry<T> | undefined;
  if (existing && !force && existing.error === undefined) return existing;
  const entry: Entry<T> = { promise: fetcher() };
  entry.promise.then(
    (data) => (entry.data = data),
    (error) => (entry.error = error),
  );
  cache.set(key, entry as Entry<unknown>);
  return entry;
}

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

export function useResource<T>(key: string | null, fetcher: () => Promise<T>): Resource<T> {
  const [, setTick] = useState(0);
  const [force, setForce] = useState(0);
  const appliedForce = useRef(0);
  const entry = key ? (cache.get(key) as Entry<T> | undefined) : undefined;

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const forced = force !== appliedForce.current;
    appliedForce.current = force;
    const e = load(key, fetcher, forced);
    e.promise.then(
      () => alive && setTick((t) => t + 1),
      () => alive && setTick((t) => t + 1),
    );
    return () => {
      alive = false;
    };
    // fetcher identity is intentionally ignored: the key identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, force]);

  const reload = useCallback(() => setForce((f) => f + 1), []);
  return {
    data: entry?.data,
    error: entry?.error,
    loading: !!key && (!entry || (entry.data === undefined && entry.error === undefined)),
    reload,
  };
}

export function invalidate(prefix: string) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}
