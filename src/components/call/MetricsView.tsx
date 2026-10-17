"use client";

import { useEffect, useState } from "react";

import type { CallSession, CallState } from "@/lib/call/session";
import { cn } from "@/lib/utils";

const kb = (b: number) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`);

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "err" | "ok" }) {
  return (
    <div className="rounded-lg bg-panel px-3 py-2.5 ring-1 ring-line">
      <div className="font-mono text-[10px] tracking-wider text-faint uppercase">{label}</div>
      <div className={cn("mt-0.5 font-mono text-[16px] tabular-nums", tone === "warn" && "text-warn", tone === "err" && "text-err", tone === "ok" && "text-ok")}>
        {value}
      </div>
    </div>
  );
}

/** Client-side view of the call: perceived latency per turn and transport health. */
export function MetricsView({ session, state }: { session: CallSession; state: CallState }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!session.isActive) return;
    const id = setInterval(() => tick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [session, state.phase]);

  const s = session.stats;
  const replies = state.latencies.map((l) => l.replyMs);
  const p50 = percentile(replies, 50);
  const p90 = percentile(replies, 90);
  const max = Math.max(1, ...replies);

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4">
      <div>
        <h3 className="mb-2 text-[12px] font-semibold">Response latency</h3>
        <p className="mb-2 text-[11.5px] leading-snug text-faint">
          Final transcript received → first agent audio heard in this browser. Includes the network round trip; excludes
          the transcriber&apos;s own end-of-turn wait.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="p50" value={p50 === null ? "—" : `${p50} ms`} tone={p50 !== null && p50 > 1500 ? "warn" : undefined} />
          <Stat label="p90" value={p90 === null ? "—" : `${p90} ms`} tone={p90 !== null && p90 > 2500 ? "warn" : undefined} />
          <Stat label="turns" value={String(replies.length)} />
        </div>
        {state.latencies.length > 0 && (
          <div className="mt-3 space-y-1">
            {state.latencies.map((l) => (
              <div key={l.turn} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-6 text-faint">#{l.turn}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(l.replyMs / max) * 100}%` }} />
                </div>
                <span className="w-16 text-right tabular-nums">{l.replyMs} ms</span>
                <span className="w-20 text-right text-info tabular-nums">
                  {l.llmTtfbS !== undefined ? `llm ${Math.round(l.llmTtfbS * 1000)}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-[12px] font-semibold">Transport</h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Mic frames sent" value={s.framesSent.toLocaleString()} />
          <Stat label="Uplink" value={kb(s.bytesSent)} />
          <Stat label="Agent chunks" value={s.audioChunks.toLocaleString()} />
          <Stat label="Downlink" value={kb(s.bytesReceived)} />
          <Stat label="Jitter buffer" value={`${Math.round(s.bufferedMs)} ms`} />
          <Stat label="Underruns" value={String(s.underruns)} tone={s.underruns > 0 ? "warn" : undefined} />
          <Stat label="Latency-trimmed" value={`${Math.round(s.droppedMs)} ms`} tone={s.droppedMs > 0 ? "warn" : undefined} />
          <Stat label="Frames dropped" value={String(s.framesDropped)} tone={s.framesDropped > 0 ? "err" : undefined} />
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-faint">
          capture {s.captureRate ? `${s.captureRate} Hz` : "—"} → 16000 Hz pcm_s16le · playback 24000 Hz pcm_s16le · 20 ms frames
        </p>
      </div>
    </div>
  );
}
