/**
 * AudioEngine — owns every Web Audio resource for one call.
 *
 * Wire contract (fixed by zoxa): send 16 kHz PCM-16 mono, receive 24 kHz
 * PCM-16 mono. Capture runs in a native-rate context (mixing sample rates
 * across contexts is unsupported in Firefox) and resamples in a worklet;
 * playback runs in a 24 kHz context so received audio needs no resampling.
 *
 * `prepare()` must be called from a user gesture (it creates/resumes the
 * contexts and requests the mic) BEFORE any network await, so autoplay
 * policies never block playback. `dispose()` is idempotent and releases
 * everything: tracks, nodes, ports and both contexts.
 */

import { CAPTURE_WORKLET, PLAYER_WORKLET, loadWorklet } from "./worklets";

export const PLAYBACK_RATE = 24000;

export interface PlayerStats {
  playing: boolean;
  bufferedMs: number;
  underruns: number;
  droppedMs: number;
}

export interface AudioEngineOptions {
  deviceId?: string | null;
  onFrame: (pcm16: ArrayBuffer) => void;
  onPlayerStats: (stats: PlayerStats) => void;
}

/** Read-only level/spectrum taps the orbs pull every animation frame. */
export interface AudioLevels {
  input(): number;
  output(): number;
  outputSpectrum(into: Uint8Array<ArrayBuffer>): void;
  inputSpectrum(into: Uint8Array<ArrayBuffer>): void;
}

const FFT_SIZE = 512;

function rms(analyser: AnalyserNode | null, scratch: Float32Array<ArrayBuffer>): number {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(scratch);
  let sum = 0;
  for (let i = 0; i < scratch.length; i++) sum += scratch[i] * scratch[i];
  // Speech RMS sits around 0.02–0.2; map to a perceptual 0–1.
  return Math.min(1, Math.sqrt(sum / scratch.length) * 4.5);
}

export class AudioEngine implements AudioLevels {
  private captureCtx: AudioContext | null = null;
  private playbackCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private capture: AudioWorkletNode | null = null;
  private player: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  private outputGain: GainNode | null = null;
  private inAnalyser: AnalyserNode | null = null;
  private outAnalyser: AnalyserNode | null = null;
  private readonly scratch = new Float32Array(FFT_SIZE);
  private disposed = false;
  private streaming = false;

  constructor(private readonly opts: AudioEngineOptions) {}

  async prepare(): Promise<void> {
    // Create both contexts synchronously inside the gesture, then await.
    this.captureCtx = new AudioContext({ latencyHint: "interactive" });
    this.playbackCtx = new AudioContext({ sampleRate: PLAYBACK_RATE, latencyHint: "interactive" });
    const resumed = Promise.all([this.captureCtx.resume(), this.playbackCtx.resume()]);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: this.opts.deviceId ? { exact: this.opts.deviceId } : undefined,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") throw new Error("Microphone permission was denied");
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new Error("Selected microphone was not found");
      }
      throw new Error(`Could not open the microphone (${name || String(err)})`);
    }
    if (this.disposed) return this.releaseStream();

    await resumed;
    await Promise.all([
      loadWorklet(this.captureCtx, CAPTURE_WORKLET),
      loadWorklet(this.playbackCtx, PLAYER_WORKLET),
    ]);
    if (this.disposed) return;

    // Capture graph: mic → analyser, mic → resampler → silent sink (keeps it pulled).
    const cctx = this.captureCtx;
    this.source = cctx.createMediaStreamSource(this.stream);
    this.inAnalyser = new AnalyserNode(cctx, { fftSize: FFT_SIZE, smoothingTimeConstant: 0.6 });
    this.capture = new AudioWorkletNode(cctx, "zoxa-capture", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
    });
    this.sink = new GainNode(cctx, { gain: 0 });
    this.source.connect(this.inAnalyser);
    this.source.connect(this.capture).connect(this.sink).connect(cctx.destination);
    this.capture.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (this.streaming) this.opts.onFrame(e.data);
    };

    // Playback graph: player → analyser → volume → speakers.
    const pctx = this.playbackCtx;
    this.player = new AudioWorkletNode(pctx, "zoxa-player", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    this.outAnalyser = new AnalyserNode(pctx, { fftSize: FFT_SIZE, smoothingTimeConstant: 0.55 });
    this.outputGain = new GainNode(pctx, { gain: 1 });
    this.player.connect(this.outAnalyser).connect(this.outputGain).connect(pctx.destination);
    this.player.port.onmessage = (e: MessageEvent<PlayerStats & { type: string }>) => {
      if (e.data?.type === "stats") this.opts.onPlayerStats(e.data);
    };
  }

  /** Begin forwarding mic frames (call once the socket is open). */
  startStreaming(): void {
    this.streaming = true;
  }

  enqueuePlayback(pcm16: ArrayBuffer): void {
    if (pcm16.byteLength < 2) return;
    // Odd byte counts cannot be PCM-16; drop the stray byte rather than throw.
    const even = pcm16.byteLength % 2 === 0 ? pcm16 : pcm16.slice(0, pcm16.byteLength - 1);
    this.player?.port.postMessage(even, [even]);
  }

  clearPlayback(): void {
    this.player?.port.postMessage({ type: "clear" });
  }

  setMuted(muted: boolean): void {
    // Muted frames are still sent (as silence) so the server's audio clock and
    // turn detection see a continuous stream.
    this.capture?.port.postMessage({ type: "mute", muted });
  }

  setOutputVolume(volume: number): void {
    const ctx = this.playbackCtx;
    if (ctx && this.outputGain) this.outputGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  }

  get captureSampleRate(): number | null {
    return this.captureCtx?.sampleRate ?? null;
  }

  input(): number {
    return rms(this.inAnalyser, this.scratch);
  }

  output(): number {
    return rms(this.outAnalyser, this.scratch);
  }

  outputSpectrum(into: Uint8Array<ArrayBuffer>): void {
    if (this.outAnalyser) this.outAnalyser.getByteFrequencyData(into);
    else into.fill(0);
  }

  inputSpectrum(into: Uint8Array<ArrayBuffer>): void {
    if (this.inAnalyser) this.inAnalyser.getByteFrequencyData(into);
    else into.fill(0);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.streaming = false;
    for (const node of [this.capture, this.player]) {
      if (node) {
        node.port.onmessage = null;
        node.port.close();
      }
    }
    for (const node of [this.source, this.capture, this.sink, this.inAnalyser, this.player, this.outAnalyser, this.outputGain]) {
      try {
        node?.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.releaseStream();
    const contexts = [this.captureCtx, this.playbackCtx];
    this.captureCtx = this.playbackCtx = null;
    this.source = this.capture = this.player = null;
    this.sink = this.outputGain = this.inAnalyser = this.outAnalyser = null;
    await Promise.all(contexts.map((c) => (c && c.state !== "closed" ? c.close().catch(() => {}) : null)));
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

/** An inert level source for when no call is running. */
export const SILENT_LEVELS: AudioLevels = {
  input: () => 0,
  output: () => 0,
  outputSpectrum: (into) => into.fill(0),
  inputSpectrum: (into) => into.fill(0),
};
