"use client";

import { AlertTriangle, Loader2, Mic, MicOff, Phone, PhoneOff, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useDraft } from "@/components/editor/DraftContext";
import { Orb, ORBS, type OrbKind } from "@/components/orbs/Orb";
import { PALETTES, isHexColor, type Palette } from "@/components/orbs/palettes";
import { Badge, Segmented, Select, TextInput } from "@/components/ui/controls";
import { useMicrophones } from "@/hooks/useMicrophones";
import { isNumber, isString, usePreference } from "@/hooks/usePreference";
import type { CallSession, CallState } from "@/lib/call/session";
import { toRequestBody } from "@/lib/draft";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<CallState["phase"], string> = {
  idle: "Ready",
  preparing: "Opening microphone",
  creating: "Creating call",
  connecting: "Connecting audio",
  live: "Live",
  ending: "Hanging up",
  ended: "Call ended",
  failed: "Call failed",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const isOrbKind = (v: unknown): v is OrbKind => ORBS.some((o) => o.id === v);
const isPalette = (v: unknown): v is Palette => Array.isArray(v) && v.length === 3 && v.every((c) => typeof c === "string" && isHexColor(c));

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function CallStage({
  session,
  state,
  dark,
  preflightErrors,
}: {
  session: CallSession;
  state: CallState;
  dark: boolean;
  preflightErrors: number;
}) {
  const { draft, setDraft, setMode } = useDraft();
  const [orb, setOrb] = usePreference<OrbKind>("orb", "halo", isOrbKind);
  const [palette, setPalette] = usePreference<Palette>("palette", PALETTES[0].colors, isPalette);
  const [deviceId, setDeviceId] = usePreference<string>("mic", "", isString);
  const [volume, setVolume] = usePreference<number>("volume", 1, isNumber);
  const mics = useMicrophones(state.phase === "live");

  const active = session.isActive;
  const live = state.phase === "live";
  const now = useNow(live);
  const elapsed = state.connectedAt ? (state.endedAt ?? now) - state.connectedAt : 0;
  const maxS = Number(draft.agent.maxCallDurationS) || 610;

  useEffect(() => session.setVolume(volume), [session, volume]);

  const savedModeInvalid = draft.mode === "saved" && !UUID_RE.test(draft.agentId.trim());
  const start = () => {
    void session.start(toRequestBody(draft), { deviceId: deviceId || null });
  };

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={{ background: "var(--stage)" }}>
      {/* Call target */}
      <div className="z-10 flex flex-wrap items-center gap-2 px-4 pt-4">
        <div className="w-full max-w-[280px]">
          <Segmented
            size="sm"
            value={draft.mode}
            onChange={setMode}
            disabled={active}
            options={[
              { value: "inline", label: "Inline config" },
              { value: "saved", label: "zoxa agent by ID" },
            ]}
          />
        </div>
        {draft.mode === "saved" && (
          <TextInput
            mono
            value={draft.agentId}
            disabled={active}
            onChange={(e) => setDraft((d) => ({ ...d, agentId: e.target.value }))}
            placeholder="zoxa agent uuid (from the dashboard)"
            className="h-7 w-full max-w-[320px] min-w-0 text-[11.5px]"
          />
        )}
        {draft.mode === "saved" && savedModeInvalid && <Badge tone="warn">not a UUID</Badge>}
      </div>

      {/* Orb: a size container, so the orb is the largest square that fits the
          free space at any viewport. Nothing here clips — the orb's glow canvas
          bleeds past its box and fades out on its own. */}
      <div className="relative min-h-[140px] flex-1" style={{ containerType: "size" }}>
        <div
          className="absolute top-1/2 left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2"
          style={{ width: "min(100cqw - 32px, 100cqh - 8px, 560px)" }}
        >
          <Orb kind={orb} mode={session.orbMode} levels={session.levels} palette={palette} dark={dark} />
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 flex-col items-center px-4 pb-5">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                live ? "live-dot bg-accent" : active ? "animate-pulse bg-warn" : state.phase === "failed" ? "bg-err" : "bg-line-strong",
              )}
            />
            <span className="font-serif text-[26px] leading-none italic">{PHASE_LABEL[state.phase]}</span>
            {live && <span className="font-mono text-[11px] text-muted">· {orbModeLabel(session.orbMode)}</span>}
          </div>
          <div className="font-mono text-[12px] text-muted tabular-nums">
            {state.connectedAt ? (
              <>
                {fmt(elapsed)} <span className="text-faint">/ {fmt(maxS * 1000)}</span>
              </>
            ) : state.callId ? (
              state.callId
            ) : (
              "wss · 16 kHz up · 24 kHz down"
            )}
          </div>
        </div>

        {state.error && (
          <div className="rise mt-3 max-h-36 w-full max-w-md overflow-y-auto rounded-xl bg-err/8 p-3 ring-1 ring-err/25">
            <div className="flex items-start gap-2 text-[12.5px] text-err">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium">
                  {state.error.status ? `${state.error.status} · ` : ""}
                  {state.error.message}
                </div>
                {state.error.issues.length > 0 && (
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px] opacity-90">
                    {state.error.issues.slice(0, 8).map((i, k) => (
                      <li key={k} className="break-words">
                        {i.path && <b>{i.path}: </b>}
                        {i.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mt-5 flex items-center gap-3">
          {active ? (
            <>
              <button
                type="button"
                onClick={() => session.setMuted(!state.muted)}
                disabled={!live}
                aria-label={state.muted ? "Unmute microphone" : "Mute microphone"}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full ring-1 transition-colors disabled:opacity-40",
                  state.muted ? "bg-warn/15 text-warn ring-warn/40" : "bg-panel text-fg ring-line hover:ring-line-strong",
                )}
              >
                {state.muted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                type="button"
                onClick={() => void session.hangup()}
                disabled={state.phase === "ending"}
                className="flex h-14 items-center gap-2.5 rounded-full bg-err px-7 text-[14px] font-semibold text-white shadow-[0_10px_30px_-10px_var(--err)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              >
                {state.phase === "live" ? <PhoneOff size={18} /> : <Loader2 size={18} className="animate-spin" />}
                {state.phase === "live" ? "End call" : state.phase === "ending" ? "Hanging up…" : "Cancel"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={draft.mode === "saved" && !draft.agentId.trim()}
              className="group flex h-14 items-center gap-2.5 rounded-full bg-accent px-8 text-[14px] font-semibold text-accent-fg shadow-[0_12px_36px_-10px_var(--accent)] transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40"
            >
              {state.phase === "ended" || state.phase === "failed" ? <RotateCcw size={18} /> : <Phone size={18} className="transition-transform group-hover:rotate-12" />}
              {state.phase === "ended" || state.phase === "failed" ? "Call again" : "Start call"}
            </button>
          )}
        </div>
        {!active && preflightErrors > 0 && (
          <p className="mt-2 text-[11.5px] text-warn">
            {preflightErrors} pre-flight error{preflightErrors > 1 ? "s" : ""} — zoxa will likely reject this (see Validate).
          </p>
        )}
      </div>

      {/* Bottom rail: devices + orb look */}
      <div className="z-10 flex flex-col gap-3 border-t border-line/70 px-4 py-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Mic size={13} className="shrink-0 text-faint" />
            <Select
              value={deviceId}
              onChange={setDeviceId}
              disabled={active}
              className="w-full max-w-60 min-w-0"
              options={[
                { value: "", label: "Default microphone" },
                ...mics.map((m, i) => ({ value: m.deviceId, label: m.label || `Microphone ${i + 1}` })),
              ]}
            />
          </div>
          <label className="flex items-center gap-2">
            <Volume2 size={13} className="text-faint" />
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="range w-28"
              style={{ ["--pct" as string]: `${(volume / 1.5) * 100}%` }}
              aria-label="Agent volume"
            />
            <span className="w-9 font-mono text-[10.5px] text-faint">{Math.round(volume * 100)}%</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap rounded-lg bg-input p-0.5 ring-1 ring-line">
            {ORBS.map((o) => (
              <button
                key={o.id}
                type="button"
                title={o.blurb}
                onClick={() => setOrb(o.id)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[11.5px] font-medium transition-colors",
                  orb === o.id ? "bg-panel text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg",
                )}
              >
                {o.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {PALETTES.map((p) => {
              const on = p.colors.every((c, i) => c === palette[i]);
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.name}
                  aria-label={`${p.name} palette`}
                  onClick={() => setPalette(p.colors)}
                  className={cn("h-5 w-5 rounded-full ring-2 ring-offset-2 ring-offset-bg transition-transform hover:scale-110", on ? "ring-fg" : "ring-transparent")}
                  style={{ background: `conic-gradient(${p.colors[0]}, ${p.colors[1]}, ${p.colors[2]}, ${p.colors[0]})` }}
                />
              );
            })}
            <div className="ml-1 flex items-center gap-0.5" title="Custom palette">
              {palette.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  value={c}
                  aria-label={`Palette color ${i + 1}`}
                  onChange={(e) => setPalette(palette.map((x, j) => (j === i ? e.target.value : x)) as unknown as Palette)}
                  className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function orbModeLabel(m: string) {
  return m === "speaking" ? "agent speaking" : m === "thinking" ? "thinking" : m === "listening" ? "listening" : m;
}
