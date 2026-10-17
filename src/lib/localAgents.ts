/**
 * The visitor's agent library, stored only in this browser (localStorage).
 *
 * The console has no accounts and uses one server-side zoxa key, so agents
 * are never written to the zoxa organization: each visitor sees only their
 * own agents, and calls use them as inline (transient) configs. Export/import
 * as JSON is the way to back them up or move them to another browser.
 */

import type { AgentConfig } from "./zoxa/types";

export interface LocalAgent {
  id: string;
  createdAt: string;
  updatedAt: string;
  config: AgentConfig;
}

const STORAGE_KEY = "zoxa-console:agents:v1";
export const MAX_LOCAL_AGENTS = 200;
const EXPORT_FORMAT = "zoxa-console/agents@1";

let agents: LocalAgent[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: LocalAgent[] = [];

const isAgent = (v: unknown): v is LocalAgent =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as LocalAgent).id === "string" &&
  typeof (v as LocalAgent).createdAt === "string" &&
  typeof (v as LocalAgent).updatedAt === "string" &&
  typeof (v as LocalAgent).config === "object" &&
  (v as LocalAgent).config !== null;

function load(): LocalAgent[] {
  if (loaded || typeof window === "undefined") return agents;
  loaded = true;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (Array.isArray(parsed)) agents = parsed.filter(isAgent);
  } catch {
    agents = [];
  }
  return agents;
}

/** Persist, or throw a readable error (e.g. storage full) without changing state. */
function commit(next: LocalAgent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error("This browser's storage is full or disabled — export your agents, then delete some.");
  }
  agents = next;
  listeners.forEach((fn) => fn());
}

const now = () => new Date().toISOString();
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const localAgents = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot: (): LocalAgent[] => load(),
  getServerSnapshot: (): LocalAgent[] => EMPTY,

  get(id: string): LocalAgent | undefined {
    return load().find((a) => a.id === id);
  },

  create(config: AgentConfig): LocalAgent {
    const list = load();
    if (list.length >= MAX_LOCAL_AGENTS) {
      throw new Error(`You can keep up to ${MAX_LOCAL_AGENTS} agents in this browser — delete some first.`);
    }
    const at = now();
    const agent: LocalAgent = { id: newId(), createdAt: at, updatedAt: at, config: clone(config) };
    commit([agent, ...list]);
    return agent;
  },

  update(id: string, config: AgentConfig): LocalAgent {
    const list = load();
    const existing = list.find((a) => a.id === id);
    if (!existing) throw new Error("This agent no longer exists in this browser.");
    const updated: LocalAgent = { ...existing, updatedAt: now(), config: clone(config) };
    commit([updated, ...list.filter((a) => a.id !== id)]);
    return updated;
  },

  remove(id: string) {
    commit(load().filter((a) => a.id !== id));
  },

  /** A JSON document of every agent, for backup or moving browsers. */
  exportJson(): string {
    return JSON.stringify({ format: EXPORT_FORMAT, exportedAt: now(), agents: load() }, null, 2);
  },

  /**
   * Import agents from an export. Each gets a fresh id (re-importing never
   * overwrites). Returns how many were added.
   */
  importJson(text: string): number {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("That file isn't valid JSON.");
    }
    const incoming =
      typeof parsed === "object" && parsed !== null && (parsed as { format?: unknown }).format === EXPORT_FORMAT
        ? (parsed as { agents?: unknown }).agents
        : null;
    if (!Array.isArray(incoming)) throw new Error("That file isn't a zoxa console agent export.");
    const valid = incoming.filter(isAgent);
    const list = load();
    const room = MAX_LOCAL_AGENTS - list.length;
    if (valid.length > room) throw new Error(`Only ${room} more agents fit in this browser.`);
    const at = now();
    const added = valid.map((a) => ({ ...a, id: newId(), updatedAt: at, config: clone(a.config) }));
    commit([...added, ...list]);
    return added.length;
  },
};
