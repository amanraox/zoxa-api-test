"use client";

import { Activity, Eraser, FileText, MessagesSquare, Moon, PhoneCall, ScrollText, SlidersHorizontal, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { clearLocalData } from "@/lib/localData";
import { MAX_RECENT_CALLS, isRecentCallList, type RecentCall } from "@/lib/recentCalls";

import { CallStage } from "@/components/call/CallStage";
import { EventLog } from "@/components/call/EventLog";
import { MetricsView } from "@/components/call/MetricsView";
import { ReportView } from "@/components/call/ReportView";
import { TranscriptView } from "@/components/call/TranscriptView";
import { DraftProvider, useDraft } from "@/components/editor/DraftContext";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { IconButton, Tabs } from "@/components/ui/controls";
import { FeedbackProvider, useFeedback } from "@/components/ui/feedback";
import { useCallSession } from "@/hooks/useCallSession";
import { useModels } from "@/hooks/useCatalog";
import { usePreference } from "@/hooks/usePreference";
import { useResource } from "@/hooks/useResource";
import { cn } from "@/lib/utils";
import { validateAgent } from "@/lib/zoxa/validate";

type Panel = "transcript" | "events" | "metrics" | "report";

/** Below the lg breakpoint one pane shows at a time; all stay mounted so a live call is never interrupted. */
type MobilePane = "agent" | "call" | "activity";

function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the class the pre-paint script applied
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("zoxa-console:theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
    setDark(next);
  };
  return [dark, toggle];
}

function Header({ dark, onTheme }: { dark: boolean; onTheme: () => void }) {
  const { confirm } = useFeedback();
  const status = useResource("status", () =>
    fetch("/api/status", { cache: "no-store" }).then((r) => r.json() as Promise<{ configured: boolean }>),
  );
  const resetLocal = async () => {
    const ok = await confirm({
      title: "Clear data stored in this browser?",
      body: "Removes your agent draft, recent calls and display preferences from this browser. Agents saved to zoxa are not affected.",
      confirmLabel: "Clear local data",
      danger: true,
    });
    if (!ok) return;
    clearLocalData();
    window.location.reload();
  };
  return (
    <header className="flex h-12 min-w-0 shrink-0 items-center gap-4 border-b border-line bg-bg px-4">
      <div className="flex shrink-0 items-baseline gap-1.5">
        <span className="text-[16px] font-bold tracking-tight">zoxa</span>
        <span className="font-serif text-[18px] text-accent italic">console</span>
      </div>
      <span className="hidden min-w-0 truncate font-mono text-[11px] text-faint xl:inline">
        dashboard.zoxa.ai · /api/v1 · websocket transport
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {status.data &&
          (status.data.configured ? (
            <span className="mr-1 flex items-center gap-1.5 text-[11.5px] text-muted" title="API key configured on the server">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              Production
            </span>
          ) : (
            <span className="mr-1 rounded-md bg-err/10 px-2 py-1 text-[11.5px] text-err ring-1 ring-err/30">
              ZOXA_API_KEY missing on the server
            </span>
          ))}
        <IconButton icon={Eraser} label="Clear data stored in this browser" onClick={() => void resetLocal()} />
        <IconButton icon={dark ? Sun : Moon} label="Toggle theme" onClick={onTheme} />
      </div>
    </header>
  );
}

function Workspace({ dark }: { dark: boolean }) {
  const { session, state } = useCallSession();
  const { draft } = useDraft();
  const models = useModels();
  const [panel, setPanel] = useState<Panel>("transcript");
  const [pane, setPane] = useState<MobilePane>("call");
  const preflightErrors = useMemo(
    () => (draft.mode === "inline" ? validateAgent(draft.agent, models.data).filter((i) => i.level === "error").length : 0),
    [draft.mode, draft.agent, models.data],
  );

  const ended = state.phase === "ended" || state.phase === "failed";
  const [recent, setRecent] = usePreference<RecentCall[]>("recent-calls", [], isRecentCallList);
  const [reportId, setReportId] = useState<string | null>(null);

  // Follow the call lifecycle (adjusting state on a phase change during render,
  // React's recommended alternative to a syncing effect): live → transcript,
  // finished → the server's report.
  const [seenPhase, setSeenPhase] = useState(state.phase);
  if (seenPhase !== state.phase) {
    setSeenPhase(state.phase);
    if (ended && state.callId) {
      setPanel("report");
      setReportId(state.callId);
    } else if (state.phase === "live") setPanel("transcript");
    if (state.phase === "live" || state.phase === "failed") setPane("call");
  }

  // Remember finished calls (this browser only) so reports survive reloads.
  const recorded = useRef<string | null>(null);
  const agentName = draft.mode === "inline" ? draft.agent.name : draft.loaded?.config.name ?? draft.agentId;
  useEffect(() => {
    if (!ended || !state.callId || recorded.current === state.callId) return;
    recorded.current = state.callId;
    const entry: RecentCall = {
      callId: state.callId,
      at: state.endedAt ?? Date.now(),
      agent: agentName || "Untitled agent",
      failed: state.phase === "failed",
    };
    setRecent([entry, ...recent.filter((c) => c.callId !== entry.callId)].slice(0, MAX_RECENT_CALLS));
  }, [ended, state.callId, state.endedAt, state.phase, agentName, recent, setRecent]);

  const show = (p: MobilePane) => (pane === p ? "max-lg:flex" : "max-lg:hidden");

  return (
    <>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-1 lg:grid-cols-[minmax(320px,1fr)_minmax(360px,2fr)_minmax(300px,1fr)] 2xl:grid-cols-[minmax(320px,460px)_minmax(360px,1fr)_minmax(300px,440px)]">
      <div className={cn("flex min-h-0 min-w-0 flex-col", show("agent"))}>
        <EditorPanel busy={session.isActive} />
      </div>
      <div className={cn("flex min-h-0 min-w-0 flex-col", show("call"))}>
        <CallStage session={session} state={state} dark={dark} preflightErrors={preflightErrors} />
      </div>
      <aside className={cn("flex min-h-0 min-w-0 flex-col border-line bg-bg lg:border-l", show("activity"))}>
        <div className="@container flex h-16 min-w-0 shrink-0 items-center border-b border-line px-3">
          <Tabs
            className="@max-[400px]:gap-0.5 @max-[400px]:[&_button]:px-2 @max-[400px]:[&_svg]:hidden"
            value={panel}
            onChange={setPanel}
            tabs={[
              { value: "transcript", label: <><MessagesSquare size={13} /> Transcript</> },
              { value: "events", label: <><ScrollText size={13} /> Events</>, count: state.log.length },
              { value: "metrics", label: <><Activity size={13} /> Metrics</> },
              { value: "report", label: <><FileText size={13} /> Report</> },
            ]}
          />
        </div>
        <div className="min-h-0 flex-1">
          {panel === "transcript" && <TranscriptView entries={state.transcript} live={state.phase === "live"} />}
          {panel === "events" && <EventLog log={state.log} callId={state.callId} />}
          {panel === "metrics" && <MetricsView session={session} state={state} />}
          {panel === "report" && (
            <ReportView
              callId={reportId}
              ended={reportId !== state.callId || ended}
              recent={recent}
              onPick={setReportId}
              onForget={() => {
                setRecent([]);
                setReportId(session.isActive ? null : state.callId);
              }}
            />
          )}
        </div>
      </aside>
      </div>
      <MobileNav pane={pane} onChange={setPane} live={state.phase === "live"} unread={state.transcript.length} />
    </>
  );
}

function MobileNav({
  pane,
  onChange,
  live,
  unread,
}: {
  pane: MobilePane;
  onChange: (p: MobilePane) => void;
  live: boolean;
  unread: number;
}) {
  const items: Array<{ id: MobilePane; label: string; icon: typeof PhoneCall }> = [
    { id: "agent", label: "Agent", icon: SlidersHorizontal },
    { id: "call", label: "Call", icon: PhoneCall },
    { id: "activity", label: "Activity", icon: MessagesSquare },
  ];
  return (
    <nav className="grid shrink-0 grid-cols-3 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-current={pane === id ? "page" : undefined}
          className={cn(
            "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
            pane === id ? "text-fg" : "text-faint",
          )}
        >
          <Icon size={18} className={pane === id ? "text-accent" : undefined} />
          {label}
          {id === "call" && live && <span className="live-dot absolute top-2.5 right-[calc(50%-16px)] h-2 w-2 rounded-full bg-accent" />}
          {id === "activity" && unread > 0 && pane !== "activity" && (
            <span className="absolute top-2 right-[calc(50%-20px)] rounded-full bg-accent px-1 font-mono text-[9px] leading-[14px] text-accent-fg">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

export function Studio() {
  const [dark, toggle] = useTheme();
  return (
    <FeedbackProvider>
      <DraftProvider>
        <div className="flex h-dvh flex-col overflow-hidden">
          <Header dark={dark} onTheme={toggle} />
          <Workspace dark={dark} />
        </div>
      </DraftProvider>
    </FeedbackProvider>
  );
}
