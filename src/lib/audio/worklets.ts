/**
 * AudioWorklet processor sources, loaded via Blob URLs so no static asset
 * paths are involved. Both run on the audio rendering thread.
 */

/**
 * zoxa-capture — mic (context rate, usually 48 kHz) → 16 kHz PCM-16 frames.
 *
 * Downsampling without a low-pass aliases everything above 8 kHz back into the
 * speech band (STT accuracy suffers), so the signal first goes through a
 * Blackman-windowed-sinc FIR (cutoff 7.2 kHz), then is resampled by fractional
 * linear interpolation, which is accurate once the band is limited. State is
 * carried across render quanta so frame boundaries are seamless.
 *
 * Emits 20 ms frames (320 samples = 640 bytes) — the size zoxa recommends.
 */
export const CAPTURE_WORKLET = /* js */ `
const OUT_RATE = 16000;
const FRAME = 320;
const TAPS = 63;

function designLowpass(cutoffHz, rate) {
  const fc = cutoffHz / rate;
  const m = TAPS - 1;
  const h = new Float32Array(TAPS);
  let sum = 0;
  for (let i = 0; i < TAPS; i++) {
    const x = i - m / 2;
    const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / m) + 0.08 * Math.cos((4 * Math.PI * i) / m);
    h[i] = sinc * w;
    sum += h[i];
  }
  for (let i = 0; i < TAPS; i++) h[i] /= sum;
  return h;
}

class ZoxaCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.muted = false;
    this.step = sampleRate / OUT_RATE;
    this.filter = sampleRate > OUT_RATE ? designLowpass(OUT_RATE * 0.45, sampleRate) : null;
    this.history = new Float32Array(TAPS - 1);
    this.filtered = new Float32Array(0);
    this.pos = 0;
    this.frame = new Int16Array(FRAME);
    this.fill = 0;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === "mute") this.muted = !!e.data.muted;
    };
  }

  lowpass(input) {
    if (!this.filter) return input;
    const h = this.filter;
    const hist = this.history;
    const n = input.length;
    const out = new Float32Array(n);
    const ext = new Float32Array(hist.length + n);
    ext.set(hist, 0);
    ext.set(input, hist.length);
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let k = 0; k < TAPS; k++) acc += h[k] * ext[i + k];
      out[i] = acc;
    }
    this.history = ext.slice(n);
    return out;
  }

  push(sample) {
    const s = this.muted ? 0 : Math.max(-1, Math.min(1, sample));
    this.frame[this.fill++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.fill === FRAME) {
      const out = this.frame;
      this.port.postMessage(out.buffer, [out.buffer]);
      this.frame = new Int16Array(FRAME);
      this.fill = 0;
    }
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    const fresh = this.lowpass(channel);
    const buf = new Float32Array(this.filtered.length + fresh.length);
    buf.set(this.filtered, 0);
    buf.set(fresh, this.filtered.length);

    let pos = this.pos;
    while (Math.floor(pos) + 1 < buf.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      this.push(buf[i] + (buf[i + 1] - buf[i]) * frac);
      pos += this.step;
    }
    const consumed = Math.floor(pos);
    this.filtered = buf.slice(consumed);
    this.pos = pos - consumed;
    return true;
  }
}

registerProcessor("zoxa-capture", ZoxaCapture);
`;

/**
 * zoxa-player — 24 kHz PCM-16 chunks from the socket → speaker, through a
 * small adaptive jitter buffer.
 *
 * - Prebuffers ~60 ms before starting, and again after an underrun.
 * - Starts anyway when the stream stalls with a short tail queued (end of an
 *   utterance shorter than the prebuffer must not get stuck).
 * - Caps latency: if a network burst queues > 600 ms, the oldest audio is
 *   dropped down to 150 ms so the conversation never drifts behind.
 * - Reports { playing, bufferedMs, underruns, droppedMs } ~20×/s; "playing"
 *   is the exact "agent audio is audible right now" signal.
 */
export const PLAYER_WORKLET = /* js */ `
const RATE = sampleRate;
const CAPACITY = RATE * 20;
const PREBUFFER = Math.round(RATE * 0.06);
const STALL_FRAMES = Math.round((RATE * 0.05) / 128);
const MAX_QUEUE = Math.round(RATE * 0.6);
const TRIM_TO = Math.round(RATE * 0.15);
const REPORT_EVERY = Math.round((RATE * 0.05) / 128);

class ZoxaPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ring = new Float32Array(CAPACITY);
    this.read = 0;
    this.write = 0;
    this.size = 0;
    this.started = false;
    this.idle = 0;
    this.tick = 0;
    this.underruns = 0;
    this.dropped = 0;
    this.wasPlaying = false;
    this.drainedAt = -1;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d instanceof ArrayBuffer) this.enqueue(new Int16Array(d));
      else if (d && d.type === "clear") this.clear();
    };
  }

  enqueue(pcm) {
    this.idle = 0;
    // Refilled shortly after running dry mid-stream = an audible gap (underrun);
    // a long silence before refill is just the next utterance.
    if (this.drainedAt >= 0 && currentFrame - this.drainedAt < RATE * 0.25) this.underruns++;
    this.drainedAt = -1;
    for (let i = 0; i < pcm.length; i++) {
      if (this.size === CAPACITY) { this.read = (this.read + 1) % CAPACITY; this.size--; this.dropped++; }
      this.ring[this.write] = pcm[i] / 0x8000;
      this.write = (this.write + 1) % CAPACITY;
      this.size++;
    }
    if (this.size > MAX_QUEUE) {
      const drop = this.size - TRIM_TO;
      this.read = (this.read + drop) % CAPACITY;
      this.size -= drop;
      this.dropped += drop;
    }
  }

  clear() {
    this.read = this.write = this.size = 0;
    this.started = false;
    this.drainedAt = -1;
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    if (!this.started) {
      this.idle++;
      if (this.size >= PREBUFFER || (this.size > 0 && this.idle >= STALL_FRAMES)) this.started = true;
    }
    let audible = false;
    if (this.started) {
      for (let i = 0; i < out.length; i++) {
        if (this.size > 0) {
          out[i] = this.ring[this.read];
          this.read = (this.read + 1) % CAPACITY;
          this.size--;
          audible = true;
        } else {
          out[i] = 0;
        }
      }
      if (this.size === 0) {
        this.started = false;
        this.idle = 0;
        this.drainedAt = currentFrame;
      }
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);

    const playing = audible || this.size > 0;
    if (++this.tick >= REPORT_EVERY || playing !== this.wasPlaying) {
      this.tick = 0;
      this.wasPlaying = playing;
      this.port.postMessage({
        type: "stats",
        playing,
        bufferedMs: (this.size / RATE) * 1000,
        underruns: this.underruns,
        droppedMs: (this.dropped / RATE) * 1000,
      });
    }
    return true;
  }
}

registerProcessor("zoxa-player", ZoxaPlayer);
`;

export async function loadWorklet(ctx: AudioContext, source: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([source], { type: "application/javascript" }));
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
