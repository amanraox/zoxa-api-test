"use client";

import { ChevronDown, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Badge, Button, IconButton, Select } from "@/components/ui/controls";
import type { RecentCall } from "@/lib/recentCalls";
import { ApiError, zoxa } from "@/lib/zoxa/client";
import type { CallReport } from "@/lib/zoxa/types";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;
const MAX_POLLS = 10;

/** Post-processing (cost, transcript upload, summary) runs asynchronously after hangup. */
const isComplete = (r: CallReport) =>
  !!r.detail.endedAt && r.detail.cost != null && (r.transcript !== null || !r.detail.transcript_url);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-1.5 last:border-b-0">
      <span className="shrink-0 text-[12px] text-muted">{label}</span>
      <span className="min-w-0 text-right font-mono text-[12px] break-words">{children}</span>
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg bg-panel ring-1 ring-line">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2 text-[12.5px] font-medium">
        {title}
        <ChevronDown size={14} className={cn("text-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-line p-3">{children}</div>}
    </div>
  );
}

const Json = ({ value }: { value: unknown }) => (
  <pre className="max-h-80 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
);

interface TranscriptMessage {
  role?: string;
  content?: unknown;
  timestamp?: string;
  [k: string]: unknown;
}

/** GET /api/v1/calls/{callId}: the server's own record of this call. */
export function ReportView({
  callId,
  ended,
  recent,
  onPick,
  onForget,
}: {
  callId: string | null;
  ended: boolean;
  recent: RecentCall[];
  onPick: (callId: string) => void;
  onForget: () => void;
}) {
  const [report, setReport] = useState<CallReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const polls = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!callId) return null;
    setLoading(true);
    try {
      const r = await zoxa.getCallReport(callId);
      setReport(r);
      setError(null);
      return r;
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status} · ${e.message}` : "Could not load the call record");
      return null;
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- new call → clear the previous report
    setReport(null);
    setError(null);
    setExhausted(false);
    polls.current = 0;
    if (!callId || !ended) return;
    let alive = true;
    const loop = async () => {
      const r = await fetchOnce();
      polls.current++;
      if (!alive || (r && isComplete(r))) return;
      if (polls.current < MAX_POLLS) timer.current = setTimeout(loop, POLL_MS);
      else setExhausted(true);
    };
    // Give the completion task a head start.
    timer.current = setTimeout(loop, 1500);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [callId, ended, fetchOnce]);

  const picker = recent.length > 0 && (
    <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
      <Select
        value={callId ?? ""}
        onChange={(id) => id && onPick(id)}
        className="min-w-0 flex-1"
        options={[
          ...(callId && !recent.some((c) => c.callId === callId) ? [{ value: callId, label: callId }] : []),
          ...(!callId ? [{ value: "", label: "Pick a recent call…" }] : []),
          ...recent.map((c) => ({
            value: c.callId,
            label: `${new Date(c.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${c.agent}${c.failed ? " · failed" : ""}`,
          })),
        ]}
      />
      <IconButton icon={Trash2} label="Forget recent calls (this browser)" size={13} className="h-8 w-8" onClick={onForget} />
    </div>
  );

  if (!callId || !ended) {
    return (
      <div className="flex h-full flex-col">
        {picker}
        <p className="p-8 text-center text-[12.5px] text-faint">
          {callId ? "Available when the call ends." : "The server's record of each call appears here after it ends."}
        </p>
      </div>
    );
  }

  const d = report?.detail;
  const messages = (report?.transcript as { messages?: TranscriptMessage[] } | null)?.messages;
  const recordings = (d?.recordings ?? []).filter((r) => typeof r.url === "string" && r.url.startsWith("http"));

  return (
    <div className="flex h-full flex-col">
    {picker}
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11.5px] text-muted">GET /api/v1/calls/{callId}</span>
        {loading && <Loader2 size={13} className="animate-spin text-faint" />}
        {report && !isComplete(report) && !loading && !exhausted && <Badge tone="info">processing…</Badge>}
        <IconButton icon={RefreshCw} label="Refresh" size={13} className="ml-auto h-7 w-7" onClick={() => void fetchOnce()} />
      </div>
      {error && <p className="text-[12px] text-err">{error}</p>}
      {!d && !error && <p className="text-[12px] text-faint">Waiting for the call record…</p>}

      {d && (
        <>
          <div className="rounded-lg bg-panel px-3 py-1 ring-1 ring-line">
            <Row label="Status">
              <Badge tone={d.status === "completed" ? "ok" : d.status === "error" ? "err" : "neutral"}>{d.status}</Badge>
            </Row>
            <Row label="Connection">{d.connectionStatus ?? "—"}</Row>
            <Row label="Ended reason">{d.endedReason ?? "—"}</Row>
            <Row label="Duration">{d.durationSeconds != null ? `${d.durationSeconds.toFixed(1)} s` : "—"}</Row>
            <Row label="Cost">{d.cost != null ? `$${d.cost.toFixed(4)}` : "pending"}</Row>
            <Row label="Agent">{d.agentName ?? "—"}</Row>
            <Row label="Transport">{d.transport}</Row>
            <Row label="Tags">{d.tags.join(", ") || "—"}</Row>
          </div>

          {recordings.length > 0 && (
            <div className="space-y-2 rounded-lg bg-panel p-3 ring-1 ring-line">
              <div className="text-[12.5px] font-medium">Recording{recordings.length > 1 ? "s" : ""}</div>
              {recordings.map((r, i) => (
                <div key={i} className="space-y-1">
                  {r.kind && <span className="font-mono text-[10.5px] text-faint">{String(r.kind)}</span>}
                  <audio controls preload="none" src={r.url} className="w-full" />
                </div>
              ))}
            </div>
          )}

          {messages && messages.length > 0 && (
            <Collapsible title={`Stored transcript · ${messages.length} messages`} defaultOpen>
              <div className="space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className="text-[12.5px] leading-relaxed">
                    <span className={cn("mr-2 font-mono text-[10.5px] uppercase", m.role === "user" ? "text-accent" : m.role === "assistant" ? "text-info" : "text-faint")}>
                      {m.role ?? "?"}
                    </span>
                    {typeof m.content === "string" ? m.content : <Json value={m} />}
                  </div>
                ))}
              </div>
            </Collapsible>
          )}

          {d.turns.length > 0 && (
            <Collapsible title={`Turns · ${d.turns.length}`}>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-[11px]">
                  <thead className="text-faint">
                    <tr className="text-left">
                      <th className="pr-2 font-normal">#</th>
                      <th className="pr-2 font-normal">user→bot</th>
                      <th className="pr-2 font-normal">stt</th>
                      <th className="pr-2 font-normal">llm</th>
                      <th className="pr-2 font-normal">tts</th>
                      <th className="pr-2 font-normal">tok in/out</th>
                      <th className="font-normal">tools</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.turns.map((t) => (
                      <tr key={t.turnNo} className={cn(t.wasInterrupted && "text-warn")}>
                        <td className="pr-2">{t.turnNo}</td>
                        <td className="pr-2">{t.userToBotMs ?? "—"}</td>
                        <td className="pr-2">{t.sttTtfbMs ?? "—"}</td>
                        <td className="pr-2">{t.llmTtfbMs ?? "—"}</td>
                        <td className="pr-2">{t.ttsTtfbMs ?? "—"}</td>
                        <td className="pr-2">
                          {t.tokensIn ?? "—"}/{t.tokensOut ?? "—"}
                        </td>
                        <td>{t.toolCallCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Collapsible>
          )}

          {d.analysis && (
            <Collapsible title="Analysis / summary" defaultOpen>
              <Json value={d.analysis} />
            </Collapsible>
          )}
          {d.latencySummary && (
            <Collapsible title="Latency summary">
              <Json value={d.latencySummary} />
            </Collapsible>
          )}
          {d.costBreakdown && (
            <Collapsible title="Cost breakdown">
              <Json value={d.costBreakdown} />
            </Collapsible>
          )}
          {d.usageInfo && (
            <Collapsible title="Usage">
              <Json value={d.usageInfo} />
            </Collapsible>
          )}
          <Collapsible title="Config snapshot (what the runner used)">
            <Json value={d.configSnapshot} />
          </Collapsible>
          <Collapsible title="Raw record">
            <Json value={d} />
          </Collapsible>
          {report && !isComplete(report) && exhausted && (
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => void fetchOnce()} className="w-full">
              Still processing — refresh
            </Button>
          )}
        </>
      )}
    </div>
    </div>
  );
}
