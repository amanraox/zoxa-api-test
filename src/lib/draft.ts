/**
 * The console's editable state and its mapping to/from the POST /call body.
 *
 * The draft IS the request: the form edits `agent` by path, the raw editor
 * edits the serialized body, and both round-trip through `toRequestBody` /
 * `fromRequestBody`. Keys the form doesn't model are kept in `extras` and
 * sent verbatim, so raw edits are never silently dropped.
 */

import { createDefaultAgent } from "./zoxa/catalog";
import type { AgentConfig, CallRequestBody } from "./zoxa/types";

export type CallMode = "inline" | "saved";

export interface LoadedAgent {
  /** Id of the agent in this browser's local library. */
  uuid: string;
  updatedAt: string;
  /** The config as last saved locally — the baseline for "modified". */
  config: AgentConfig;
}

export interface Draft {
  mode: CallMode;
  /** Edited agent. May be partial after raw edits — read via defaults. */
  agent: AgentConfig;
  /** A zoxa agent UUID, sent as `agentId` in "saved" mode (typed by the user). */
  agentId: string;
  /** Call-time `contextVariables` (override the agent's saved defaults). */
  callVariables: Record<string, string>;
  /** Unmodelled top-level body keys, sent as-is. */
  extras: Record<string, unknown>;
  loaded: LoadedAgent | null;
}

export function createDraft(): Draft {
  return {
    mode: "inline",
    agent: createDefaultAgent(),
    agentId: "",
    callVariables: { customer_name: "Alex" },
    extras: {},
    loaded: null,
  };
}

export function toRequestBody(d: Draft): CallRequestBody {
  const vars = Object.fromEntries(Object.entries(d.callVariables).filter(([k]) => k.trim()));
  return {
    transport: "websocket",
    ...(d.mode === "inline" ? { agent: d.agent } : { agentId: d.agentId }),
    ...(Object.keys(vars).length ? { contextVariables: vars } : {}),
    ...d.extras,
  };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Apply a raw body to the draft. Returns an error string when the body can't
 * be represented (not an object). Mode follows whichever of agent/agentId is
 * present; if both are, the other is kept in `extras` so it is still sent and
 * the server's own validation responds.
 */
export function fromRequestBody(prev: Draft, body: unknown): Draft | string {
  if (!isPlainObject(body)) return "The request body must be a JSON object";
  const { agent, agentId, contextVariables, transport, ...rest } = body;
  const extras: Record<string, unknown> = { ...rest };
  if (transport !== undefined && transport !== "websocket") extras.transport = transport;

  let next: Draft = { ...prev, extras };
  if (isPlainObject(agent)) {
    next = { ...next, mode: "inline", agent: agent as unknown as AgentConfig };
    if (agentId !== undefined) extras.agentId = agentId;
  } else if (agentId !== undefined) {
    next = { ...next, mode: "saved", agentId: typeof agentId === "string" ? agentId : String(agentId) };
    if (agent !== undefined) extras.agent = agent;
  } else {
    // Neither: keep the mode but send neither (server returns its 400).
    next = { ...next, mode: prev.mode };
    if (prev.mode === "inline") extras.agent = undefined;
    else extras.agentId = undefined;
  }

  if (contextVariables === undefined) next.callVariables = {};
  else if (isPlainObject(contextVariables) && Object.values(contextVariables).every((v) => typeof v === "string")) {
    next.callVariables = contextVariables as Record<string, string>;
  } else {
    extras.contextVariables = contextVariables;
    next.callVariables = {};
  }
  return next;
}

/* ───────────── persistence (per-browser convenience only) ───────────── */

const STORAGE_KEY = "zoxa-console:draft:v2";

export function loadStoredDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    if (!isPlainObject(parsed) || !isPlainObject(parsed.agent)) return null;
    return { ...createDraft(), ...parsed } as Draft;
  } catch {
    return null;
  }
}

export function storeDraft(d: Draft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* storage full / disabled — persistence is best-effort */
  }
}
