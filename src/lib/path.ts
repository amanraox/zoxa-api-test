/** Immutable get/set by dotted path — the form binds every control this way. */

export type Path = ReadonlyArray<string | number>;

export function getIn(obj: unknown, path: Path): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

export function setIn<T>(obj: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const base: unknown = obj ?? (typeof head === "number" ? [] : {});
  const child = setIn((base as Record<string | number, unknown>)[head], rest, value);
  if (Array.isArray(base)) {
    const copy = base.slice();
    copy[head as number] = child;
    return copy as T;
  }
  return { ...(base as object), [head]: child } as T;
}

/** Structural equality for JSON values (key order independent). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => jsonEqual(v, bb[i]));
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return (
    ka.length === kb.length &&
    ka.every((k) => jsonEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}
