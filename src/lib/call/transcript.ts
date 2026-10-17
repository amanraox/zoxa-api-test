/**
 * Live transcript reducer — a pure function over zoxa realtime-feedback
 * events. Semantics match the zoxa dashboard's live view:
 *
 *  - user interim transcripts replace each other; a final commits the turn
 *    (exact duplicate finals are ignored)
 *  - agent words (`rtf-bot-text`, one word per event, emitted in sync with
 *    playback) append to the open agent bubble, joined by spaces
 *  - `rtf-filler-word` opens an agent bubble the answer then merges into
 *  - `rtf-bot-spoken-correction` trims the last agent bubble to what was
 *    actually heard before a barge-in ("" removes it)
 *  - tool calls render as their own rows, start → done
 */

export type TranscriptEntry =
  | { kind: "user"; id: string; text: string; final: boolean; at: number }
  | { kind: "agent"; id: string; text: string; final: boolean; at: number; ttfbS?: number; interrupted?: boolean }
  | { kind: "tool"; id: string; name: string; status: "running" | "done"; at: number; ttfbS?: number; result?: string | null }
  | { kind: "error"; id: string; text: string; fatal: boolean; at: number };

export interface FeedbackEvent {
  type: string;
  payload?: Record<string, unknown>;
  message?: string;
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function finalizeOpenAgent(list: TranscriptEntry[]): TranscriptEntry[] {
  return list.some((e) => e.kind === "agent" && !e.final)
    ? list.map((e) => (e.kind === "agent" && !e.final ? { ...e, final: true } : e))
    : list;
}

export function reduceTranscript(list: TranscriptEntry[], ev: FeedbackEvent, at: number): TranscriptEntry[] {
  const p = ev.payload ?? {};
  switch (ev.type) {
    case "rtf-user-transcription": {
      const text = str(p.text).trim();
      if (!text) return list;
      const isFinal = p.final === true;
      const base = finalizeOpenAgent(list).filter((e) => !(e.kind === "user" && !e.final));
      if (isFinal) {
        const lastUser = [...base].reverse().find((e) => e.kind === "user");
        if (lastUser && lastUser.kind === "user" && lastUser.final && lastUser.text === text) return base;
      }
      return [...base, { kind: "user", id: nextId("u"), text, final: isFinal, at }];
    }

    case "rtf-bot-text": {
      const word = str(p.text);
      if (!word) return list;
      const ttfbS = num(p.ttfb_seconds);
      const last = list[list.length - 1];
      if (last?.kind === "agent" && !last.final) {
        const joined = last.text ? `${last.text} ${word.trim()}` : word.trim();
        return [...list.slice(0, -1), { ...last, text: joined, ttfbS: last.ttfbS ?? ttfbS }];
      }
      return [...list, { kind: "agent", id: nextId("a"), text: word.trim(), final: false, at, ttfbS }];
    }

    case "rtf-filler-word": {
      const word = str(p.text).trim();
      if (!word) return list;
      return [...finalizeOpenAgent(list), { kind: "agent", id: nextId("a"), text: word, final: false, at }];
    }

    case "rtf-bot-spoken-correction": {
      const heard = str(p.text).trim();
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (e.kind !== "agent") continue;
        if (!heard) return [...list.slice(0, i), ...list.slice(i + 1)];
        return list.map((x, j) => (j === i ? { ...e, text: heard, final: true, interrupted: true } : x));
      }
      return list;
    }

    case "rtf-bot-stopped-speaking":
      return finalizeOpenAgent(list);

    case "rtf-function-call-start": {
      const id = `tool-${str(p.tool_call_id) || nextId("t")}`;
      if (list.some((e) => e.id === id)) return list;
      return [
        ...finalizeOpenAgent(list),
        { kind: "tool", id, name: str(p.function_name) || "tool", status: "running", at, ttfbS: num(p.ttfb_seconds) },
      ];
    }

    case "rtf-function-call-end": {
      const id = `tool-${str(p.tool_call_id)}`;
      const result = typeof p.result === "string" ? p.result : null;
      return list.map((e) => (e.kind === "tool" && e.id === id ? { ...e, status: "done", result } : e));
    }

    case "rtf-pipeline-error":
      return [
        ...list,
        { kind: "error", id: nextId("e"), text: str(p.error) || "Pipeline error", fatal: p.fatal === true, at },
      ];

    case "error":
      return [...list, { kind: "error", id: nextId("e"), text: ev.message || "Server error", fatal: true, at }];

    default:
      return list;
  }
}
