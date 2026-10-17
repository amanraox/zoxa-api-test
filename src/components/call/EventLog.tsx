"use client";

import { ArrowDownLeft, ArrowUpRight, Cog, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { IconButton, TextInput } from "@/components/ui/controls";
import type { LogEntry } from "@/lib/call/session";
import { cn } from "@/lib/utils";

const NOISY = new Set(["rtf-bot-text", "rtf-user-transcription"]);
const DIR_ICON = { in: ArrowDownLeft, out: ArrowUpRight, sys: Cog };
const DIR_TONE = { in: "text-info", out: "text-accent", sys: "text-faint" };

/** Every frame of protocol traffic: HTTP, socket lifecycle and JSON events. */
export function EventLog({ log, callId }: { log: LogEntry[]; callId: string | null }) {
  const [filter, setFilter] = useState("");
  const [hideWords, setHideWords] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return log.filter(
      (e) => (!hideWords || !NOISY.has(e.type)) && (!q || e.type.toLowerCase().includes(q) || JSON.stringify(e.data ?? "").toLowerCase().includes(q)),
    );
  }, [log, filter, hideWords]);

  const download = () => {
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zoxa-${callId ?? "session"}-events.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <TextInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter events" className="h-7 text-[12px]" />
        <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
          <input type="checkbox" checked={hideWords} onChange={(e) => setHideWords(e.target.checked)} className="accent-[var(--accent)]" />
          hide captions
        </label>
        <IconButton icon={Download} label="Download log as JSON" size={13} className="h-7 w-7" onClick={download} disabled={!log.length} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px]">
        {rows.length === 0 && <p className="p-6 text-center font-sans text-[12px] text-faint">No events yet.</p>}
        {rows.map((e) => {
          const Icon = DIR_ICON[e.dir];
          const expanded = openId === e.id;
          return (
            <div key={e.id} className="border-b border-line/60">
              <button
                type="button"
                onClick={() => setOpenId(expanded ? null : e.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-panel-2"
              >
                <span className="w-14 shrink-0 text-right text-faint tabular-nums">{(e.t / 1000).toFixed(2)}s</span>
                <Icon size={11} className={cn("shrink-0", DIR_TONE[e.dir])} />
                <span className="truncate text-fg">{e.type}</span>
                {e.data !== undefined && !expanded && (
                  <span className="ml-auto max-w-[45%] truncate text-faint">{JSON.stringify(e.data)}</span>
                )}
              </button>
              {expanded && e.data !== undefined && (
                <pre className="mx-3 mb-2 max-h-80 overflow-auto rounded-md bg-input p-2 leading-relaxed whitespace-pre-wrap ring-1 ring-line">
                  {JSON.stringify(e.data, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
