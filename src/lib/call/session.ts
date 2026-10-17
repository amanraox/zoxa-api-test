/**
 * CallSession — one WebSocket voice call against zoxa, end to end.
 *
 *   prepare audio (in the click gesture) → POST /call → open wss audio socket
 *   → stream mic PCM / play agent PCM / reduce JSON events → close → report
 *
 * Framework-free: React subscribes through `subscribe()` + `getSnapshot()`
 * (useSyncExternalStore). The snapshot is immutable and only replaced on
 * meaningful change; hot counters live in `stats` and are read on demand so
 * 50 frames/s of audio never re-render the UI.
 */

import { AudioEngine, SILENT_LEVELS, type AudioLevels, type PlayerStats } from "../audio/engine";
import { ApiError, type ApiIssue, zoxa } from "../zoxa/client";
import type { CallRequestBody, CreateCallResponse } from "../zoxa/types";
import { reduceTranscript, type FeedbackEvent, type TranscriptEntry } from "./transcript";

export type CallPhase = "idle" | "preparing" | "creating" | "connecting" | "live" | "ending" | "ended" | "failed";
export type OrbMode = "idle" | "connecting" | "listening" | "thinking" | "speaking";

export interface LogEntry {
  id: number;
  t: number; // ms since the session started
  dir: "in" | "out" | "sys";
  type: string;
  data?: unknown;
}

export interface TurnLatency {
  turn: number;
  /** Final user transcript received → first agent audio audible, as heard here. */
  replyMs: number;
  /** LLM time-to-first-token reported by zoxa for this reply, if any. */
  llmTtfbS?: number;
}

export interface CallState {
  phase: CallPhase;
  callId: string | null;
  error: { message: string; issues: ApiIssue[]; status?: number } | null;
  startedAt: number | null;
  connectedAt: number | null;
  endedAt: number | null;
  close: { code: number; reason: string; by: "you" | "server" } | null;
  muted: boolean;
  agentSpeaking: boolean;
  awaitingReply: boolean;
  toolsRunning: number;
  transcript: TranscriptEntry[];
  log: LogEntry[];
  latencies: TurnLatency[];
  request: CallRequestBody | null;
  response: Omit<CreateCallResponse, "wsUrl"> | null;
}

export interface CallStats {
  framesSent: number;
  framesDropped: number;
  bytesSent: number;
  bytesReceived: number;
  audioChunks: number;
  bufferedMs: number;
  underruns: number;
  droppedMs: number;
  captureRate: number | null;
}

const INITIAL: CallState = {
  phase: "idle",
  callId: null,
  error: null,
  startedAt: null,
  connectedAt: null,
  endedAt: null,
  close: null,
  muted: false,
  agentSpeaking: false,
  awaitingReply: false,
  toolsRunning: 0,
  transcript: [],
  log: [],
  latencies: [],
  request: null,
  response: null,
};

const CONNECT_TIMEOUT_MS = 10_000;
const MAX_LOG = 2000;
const MAX_WS_BUFFERED = 256 * 1024;
const ACTIVE: CallPhase[] = ["preparing", "creating", "connecting", "live", "ending"];

const redactKey = (url: string) => url.replace(/(api_key=)[^&]+/, "$1•••");

export class CallSession {
  private state: CallState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private engine: AudioEngine | null = null;
  private ws: WebSocket | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private t0 = 0;
  private logSeq = 0;
  private replyPendingSince: number | null = null;
  private pendingTtfb: number | undefined;
  private volume = 1;
  private readonly statsData: CallStats = this.freshStats();

  /* ───────────── store API ───────────── */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.state;

  get stats(): Readonly<CallStats> {
    return this.statsData;
  }

  get levels(): AudioLevels {
    return this.engine ?? SILENT_LEVELS;
  }

  get isActive() {
    return ACTIVE.includes(this.state.phase);
  }

  get orbMode(): OrbMode {
    const s = this.state;
    if (s.phase === "preparing" || s.phase === "creating" || s.phase === "connecting") return "connecting";
    if (s.phase !== "live") return "idle";
    if (s.agentSpeaking) return "speaking";
    if (s.awaitingReply || s.toolsRunning > 0) return "thinking";
    return "listening";
  }

  private set(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  private log(dir: LogEntry["dir"], type: string, data?: unknown) {
    const entry: LogEntry = { id: ++this.logSeq, t: Math.round(performance.now() - this.t0), dir, type, data };
    const log = this.state.log.length >= MAX_LOG ? this.state.log.slice(-MAX_LOG + 1) : this.state.log;
    this.set({ log: [...log, entry] });
  }

  /* ───────────── lifecycle ───────────── */

  /**
   * Start a call. Must be invoked synchronously from a click handler: the
   * audio contexts are created before the first await.
   */
  async start(body: CallRequestBody, opts: { deviceId?: string | null } = {}): Promise<void> {
    if (this.isActive) return;
    this.t0 = performance.now();
    this.logSeq = 0;
    this.replyPendingSince = null;
    this.pendingTtfb = undefined;
    Object.assign(this.statsData, this.freshStats());
    this.state = { ...INITIAL, phase: "preparing", startedAt: Date.now(), request: body, muted: false };
    this.set({});

    const engine = new AudioEngine({
      deviceId: opts.deviceId,
      onFrame: (pcm) => this.sendFrame(pcm),
      onPlayerStats: (s) => this.onPlayerStats(s),
    });
    this.engine = engine;
    const prepared = engine.prepare();

    try {
      this.log("sys", "audio.prepare");
      await prepared;
      if (this.engine !== engine) return; // hung up meanwhile
      engine.setOutputVolume(this.volume);
      this.statsData.captureRate = engine.captureSampleRate;
      this.log("sys", "audio.ready", { captureRate: engine.captureSampleRate, playbackRate: 24000 });

      this.set({ phase: "creating" });
      this.log("out", "POST /api/v1/call", body);
      const res = await zoxa.createCall(body);
      const { wsUrl, ...response } = res;
      this.log("in", "201 Created", response);
      if (this.engine !== engine) {
        // Hung up while the call was being created: the row is pending and
        // holds a concurrency slot. Connect + close so zoxa finalizes it.
        CallSession.releaseOrphan(wsUrl);
        return;
      }
      this.set({ phase: "connecting", callId: res.callId, response });
      this.connect(wsUrl, engine);
    } catch (err) {
      if (this.engine !== engine) return; // hung up meanwhile; already ended
      const apiErr = err instanceof ApiError ? err : null;
      this.log("in", apiErr ? `${apiErr.status} error` : "error", apiErr?.raw ?? String(err));
      await this.teardown();
      this.set({
        phase: "failed",
        endedAt: Date.now(),
        error: {
          message: err instanceof Error ? err.message : "Could not start the call",
          issues: apiErr?.issues ?? [],
          status: apiErr?.status,
        },
      });
    }
  }

  private connect(wsUrl: string, engine: AudioEngine) {
    this.log("out", "WS connect", { url: redactKey(wsUrl) });
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    this.connectTimer = setTimeout(() => {
      if (this.state.phase === "connecting") {
        this.log("sys", "WS connect timeout");
        this.fail("The audio socket did not open within 10 s");
      }
    }, CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      this.clearConnectTimer();
      if (this.ws !== ws) return;
      this.log("in", "WS open");
      engine.startStreaming();
      this.set({ phase: "live", connectedAt: Date.now() });
    };

    ws.onmessage = (ev: MessageEvent<ArrayBuffer | string>) => {
      if (this.ws !== ws) return;
      if (typeof ev.data === "string") this.onJson(ev.data);
      else {
        this.statsData.bytesReceived += ev.data.byteLength;
        this.statsData.audioChunks++;
        engine.enqueuePlayback(ev.data);
      }
    };

    ws.onerror = () => {
      if (this.ws === ws) this.log("sys", "WS error");
    };

    ws.onclose = (ev) => {
      this.clearConnectTimer();
      if (this.ws !== ws) return;
      this.ws = null;
      this.log("in", "WS close", { code: ev.code, reason: ev.reason || null, clean: ev.wasClean });
      const byYou = this.state.phase === "ending";
      const neverOpened = this.state.connectedAt === null;
      void this.teardown().then(() => {
        const close = { code: ev.code, reason: ev.reason, by: byYou ? "you" : "server" } as const;
        if (!byYou && (ev.code === 1008 || neverOpened)) {
          this.set({
            phase: "failed",
            close,
            endedAt: Date.now(),
            error: { message: ev.reason || `Socket closed before the call started (code ${ev.code})`, issues: [] },
          });
        } else {
          this.set({
            phase: "ended",
            close,
            endedAt: Date.now(),
            agentSpeaking: false,
            awaitingReply: false,
            toolsRunning: 0,
            error:
              !byYou && ev.code !== 1000
                ? { message: `Connection lost (code ${ev.code}${ev.reason ? `: ${ev.reason}` : ""})`, issues: [] }
                : null,
          });
        }
      });
    };
  }

  /** End the call from this side (also cancels a call that is still connecting). */
  async hangup(): Promise<void> {
    const { phase } = this.state;
    if (phase === "live" || phase === "connecting") {
      this.set({ phase: "ending" });
      this.log("out", "WS close (hangup)");
      this.engine?.clearPlayback();
      const ws = this.ws;
      if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000, "client hangup");
      else await this.finishLocally();
      return;
    }
    if (phase === "preparing" || phase === "creating") {
      // No socket yet. Detaching the engine makes start() bail out; a call
      // row created after this point is released via releaseOrphan().
      await this.finishLocally();
    }
  }

  private async finishLocally() {
    await this.teardown();
    this.set({ phase: "ended", endedAt: Date.now(), close: { code: 1000, reason: "client hangup", by: "you" } });
  }

  private fail(message: string) {
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    void this.teardown().then(() => this.set({ phase: "failed", endedAt: Date.now(), error: { message, issues: [] } }));
  }

  private async teardown() {
    this.clearConnectTimer();
    const engine = this.engine;
    this.engine = null;
    await engine?.dispose();
  }

  /** Release everything (component unmount / page hide). */
  dispose() {
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000, "page closed");
    void this.teardown();
    this.listeners.clear();
  }

  reset() {
    if (this.isActive) return;
    this.state = INITIAL;
    this.listeners.forEach((fn) => fn());
  }

  /* ───────────── controls ───────────── */

  setMuted(muted: boolean) {
    this.engine?.setMuted(muted);
    this.set({ muted });
    this.log("sys", muted ? "mic muted" : "mic unmuted");
  }

  setVolume(volume: number) {
    this.volume = volume;
    this.engine?.setOutputVolume(volume);
  }

  /** Send a JSON control message on the socket (forwarded to the pipeline). */
  sendJson(message: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(message));
    this.log("out", "WS json", message);
    return true;
  }

  /* ───────────── audio + events ───────────── */

  private sendFrame(pcm: ArrayBuffer) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > MAX_WS_BUFFERED) {
      this.statsData.framesDropped++;
      return;
    }
    ws.send(pcm);
    this.statsData.framesSent++;
    this.statsData.bytesSent += pcm.byteLength;
  }

  private onPlayerStats(s: PlayerStats) {
    this.statsData.bufferedMs = s.bufferedMs;
    this.statsData.underruns = s.underruns;
    this.statsData.droppedMs = s.droppedMs;
    if (s.playing === this.state.agentSpeaking) return;
    if (s.playing && this.replyPendingSince !== null) {
      const replyMs = Math.round(performance.now() - this.replyPendingSince);
      this.replyPendingSince = null;
      const latencies = [
        ...this.state.latencies,
        { turn: this.state.latencies.length + 1, replyMs, llmTtfbS: this.pendingTtfb },
      ];
      this.pendingTtfb = undefined;
      this.set({ agentSpeaking: true, awaitingReply: false, latencies });
      return;
    }
    this.set({ agentSpeaking: s.playing, ...(s.playing ? { awaitingReply: false } : {}) });
  }

  private onJson(raw: string) {
    let ev: FeedbackEvent;
    try {
      ev = JSON.parse(raw) as FeedbackEvent;
    } catch {
      this.log("in", "WS text (non-JSON)", raw);
      return;
    }
    if (!ev || typeof ev.type !== "string") {
      this.log("in", "WS json (untyped)", ev);
      return;
    }
    this.log("in", ev.type, ev.payload ?? (ev.message ? { message: ev.message } : undefined));

    const p = ev.payload ?? {};
    const patch: Partial<CallState> = {
      transcript: reduceTranscript(this.state.transcript, ev, Date.now()),
    };
    switch (ev.type) {
      case "rtf-user-transcription":
        if (p.final === true) {
          this.replyPendingSince = performance.now();
          patch.awaitingReply = true;
        }
        break;
      case "rtf-ttfb-metric":
        if (typeof p.ttfb_seconds === "number") this.pendingTtfb = p.ttfb_seconds;
        break;
      case "rtf-function-call-start":
        patch.toolsRunning = this.state.toolsRunning + 1;
        break;
      case "rtf-function-call-end":
        patch.toolsRunning = Math.max(0, this.state.toolsRunning - 1);
        break;
      case "rtf-pipeline-error":
        if (p.fatal === true) patch.error = { message: String(p.error ?? "Fatal pipeline error"), issues: [] };
        break;
      case "error":
        patch.error = { message: ev.message ?? "Server error", issues: [] };
        break;
    }
    this.set(patch);
  }

  private static releaseOrphan(wsUrl: string) {
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => ws.close(1000, "client hangup");
      setTimeout(() => ws.readyState <= WebSocket.OPEN && ws.close(), CONNECT_TIMEOUT_MS);
    } catch {
      /* best effort — the server sweeps stale pending rows */
    }
  }

  private clearConnectTimer() {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  private freshStats(): CallStats {
    return {
      framesSent: 0,
      framesDropped: 0,
      bytesSent: 0,
      bytesReceived: 0,
      audioChunks: 0,
      bufferedMs: 0,
      underruns: 0,
      droppedMs: 0,
      captureRate: null,
    };
  }
}
