"use client";

import { AlertOctagon, CheckCircle2, Loader2, Wrench } from "lucide-react";
import { useEffect, useRef } from "react";

import type { TranscriptEntry } from "@/lib/call/transcript";
import { cn } from "@/lib/utils";

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function TranscriptView({ entries, live }: { entries: TranscriptEntry[]; live: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Follow the bottom unless the user scrolled up to read.
  useEffect(() => {
    if (stick.current) end.current?.scrollIntoView({ block: "end" });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="font-serif text-[22px] italic text-muted">{live ? "Say hello…" : "No conversation yet"}</p>
        <p className="text-[12px] text-faint">
          Live captions from <code className="font-mono">rtf-user-transcription</code> and{" "}
          <code className="font-mono">rtf-bot-text</code>{" "}appear here, word by word as they&apos;re spoken.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
      className="h-full space-y-3 overflow-y-auto px-4 py-4"
    >
      {entries.map((e) => {
        if (e.kind === "tool") {
          return (
            <div key={e.id} className="mx-auto flex max-w-[92%] items-center gap-2 rounded-lg bg-panel-2 px-3 py-1.5 text-[12px] ring-1 ring-line">
              <Wrench size={12} className="text-info" />
              <code className="font-mono text-fg">{e.name}()</code>
              {e.status === "running" ? (
                <Loader2 size={12} className="ml-auto animate-spin text-faint" />
              ) : (
                <CheckCircle2 size={12} className="ml-auto text-ok" />
              )}
              {e.ttfbS !== undefined && <span className="font-mono text-[10px] text-faint">{Math.round(e.ttfbS * 1000)}ms</span>}
            </div>
          );
        }
        if (e.kind === "error") {
          return (
            <div key={e.id} className="flex items-start gap-2 rounded-lg bg-err/8 px-3 py-2 text-[12px] text-err ring-1 ring-err/25">
              <AlertOctagon size={13} className="mt-0.5 shrink-0" />
              <span className="break-words">
                {e.fatal ? "Fatal: " : ""}
                {e.text}
              </span>
            </div>
          );
        }
        const user = e.kind === "user";
        return (
          <div key={e.id} className={cn("flex flex-col gap-1", user ? "items-end" : "items-start")}>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
              <span className="tracking-wider uppercase">{user ? "You" : "Agent"}</span>
              <span>{clock(e.at)}</span>
              {!user && e.ttfbS !== undefined && <span className="text-info">llm {Math.round(e.ttfbS * 1000)}ms</span>}
              {!user && e.interrupted && <span className="text-warn">interrupted</span>}
            </div>
            <div
              className={cn(
                "max-w-[88%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed",
                user ? "rounded-br-md bg-fg text-bg" : "rounded-bl-md bg-panel ring-1 ring-line",
                !e.final && "opacity-70",
              )}
            >
              {e.text}
              {!e.final && <span className="ml-1 inline-block h-3 w-1 animate-pulse rounded-sm bg-current align-middle opacity-60" />}
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}
