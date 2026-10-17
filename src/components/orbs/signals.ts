/**
 * OrbSignals — turns raw audio taps + call mode into smooth, shader-ready
 * values once per animation frame:
 *
 *   input / output   attack-release smoothed loudness (0–1)
 *   energy           whichever side is active, for "one knob" orbs
 *   bands[16]        log-spaced spectrum (80 Hz–8 kHz) of the active side
 *   state            cross-faded weights: idle, listening, thinking, speaking
 *   connecting       separate weight (call being set up)
 *
 * Everything is frame-rate independent (dt-based exponential smoothing).
 */

import type { AudioLevels } from "@/lib/audio/engine";
import type { OrbMode } from "@/lib/call/session";

export const BAND_COUNT = 16;
const FFT_BINS = 256; // analyser fftSize 512
const MIN_HZ = 80;
const MAX_HZ = 8000;

function bandEdges(sampleRate: number): Int16Array {
  const binHz = sampleRate / 2 / FFT_BINS;
  const edges = new Int16Array(BAND_COUNT + 1);
  for (let i = 0; i <= BAND_COUNT; i++) {
    const hz = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, i / BAND_COUNT);
    edges[i] = Math.min(FFT_BINS - 1, Math.max(1, Math.round(hz / binHz)));
  }
  return edges;
}

const OUT_EDGES = bandEdges(24000);
const IN_EDGES = bandEdges(48000);

const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class OrbSignals {
  input = 0;
  output = 0;
  energy = 0;
  readonly bands = new Float32Array(BAND_COUNT);
  /** [idle, listening, thinking, speaking] */
  readonly state = new Float32Array([1, 0, 0, 0]);
  connecting = 0;
  time = 0;

  private readonly bins = new Uint8Array(FFT_BINS);

  update(levels: AudioLevels, mode: OrbMode, dt: number, speed = 1) {
    const d = Math.min(dt, 0.1);
    this.time += d * speed;

    const rawIn = levels.input();
    const rawOut = levels.output();
    // Fast attack, slower release — reads as "alive" without jitter.
    this.input = approach(this.input, rawIn, rawIn > this.input ? 22 : 6, d);
    this.output = approach(this.output, rawOut, rawOut > this.output ? 26 : 7, d);

    const speaking = mode === "speaking" || this.output > 0.04;
    const target = [
      mode === "idle" || mode === "connecting" ? 1 : 0,
      mode === "listening" && !speaking ? 1 : 0,
      mode === "thinking" && !speaking ? 1 : 0,
      speaking && mode !== "idle" ? 1 : 0,
    ];
    for (let i = 0; i < 4; i++) this.state[i] = approach(this.state[i], target[i], 5, d);
    this.connecting = approach(this.connecting, mode === "connecting" ? 1 : 0, 4, d);

    const useOut = this.output >= this.input * 0.8;
    this.energy = approach(this.energy, useOut ? this.output : this.input * 0.85, 14, d);

    if (useOut) levels.outputSpectrum(this.bins);
    else levels.inputSpectrum(this.bins);
    const edges = useOut ? OUT_EDGES : IN_EDGES;
    const gain = useOut ? 1 : 0.85;
    for (let b = 0; b < BAND_COUNT; b++) {
      let sum = 0;
      let n = 0;
      for (let k = edges[b]; k <= Math.max(edges[b], edges[b + 1] - 1); k++) {
        sum += this.bins[k];
        n++;
      }
      // dB-scaled bytes (−100..−30 dBFS) → 0..1, with a soft knee on the floor.
      const v = Math.max(0, (sum / Math.max(1, n) / 255 - 0.12) / 0.88) * gain;
      this.bands[b] = approach(this.bands[b], v, v > this.bands[b] ? 30 : 8, d);
    }
  }
}
