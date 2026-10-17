"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { AudioLevels } from "@/lib/audio/engine";
import type { OrbMode } from "@/lib/call/session";
import { cn } from "@/lib/utils";

import { hexToRgb, type Palette } from "./palettes";
import { BAND_COUNT, OrbSignals } from "./signals";

/**
 * WebGL2 full-quad runner for the fragment-shader orbs.
 *
 * Uniforms every shader receives:
 *   u_res, u_time, u_dark
 *   u_in, u_out, u_energy           smoothed loudness
 *   u_bands[16]                     log spectrum of the active side
 *   u_state (idle, listen, think, speak) cross-faded weights
 *   u_connecting
 *   u_c1, u_c2, u_c3                palette (linear-ish RGB)
 *   u_bleed                         canvas size / orb box size
 *
 * The canvas is BLEED× the orb's layout box (centred, overflowing it) so
 * glows and coronas fall off naturally instead of being cut at a square edge;
 * shaders scale coordinates by u_bleed so the orb itself keeps its size.
 *
 * Renders only while visible (IntersectionObserver + page visibility), starts
 * at the DPR cap and steps resolution down on sustained slow frames, rebuilds
 * on context loss, and honours prefers-reduced-motion.
 */

const VERTEX = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

/** Canvas edge length relative to the orb box (35% overflow per side). */
const BLEED = 1.7;

export const SHADER_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform vec2 u_res;
uniform float u_time;
uniform float u_dark;
uniform float u_in;
uniform float u_out;
uniform float u_energy;
uniform float u_bands[${BAND_COUNT}];
uniform vec4 u_state;
uniform float u_connecting;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform float u_bleed;
#define PI 3.14159265359
#define TAU 6.28318530718
`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile error: ${log}`);
  }
  return sh;
}

interface GlState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  vao: WebGLVertexArrayObject;
  u: Record<string, WebGLUniformLocation | null>;
}

const UNIFORMS = [
  "u_res", "u_time", "u_dark", "u_in", "u_out", "u_energy", "u_bands",
  "u_state", "u_connecting", "u_c1", "u_c2", "u_c3", "u_bleed",
] as const;

function setup(gl: WebGL2RenderingContext, fragment: string): GlState {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, SHADER_HEADER + fragment);
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }
  const buffer = gl.createBuffer()!;
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u: GlState["u"] = {};
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
  return { gl, program, buffer, vao, u };
}

function destroy(s: GlState | null) {
  if (!s || s.gl.isContextLost()) return;
  s.gl.deleteBuffer(s.buffer);
  s.gl.deleteVertexArray(s.vao);
  s.gl.deleteProgram(s.program);
}

export interface ShaderOrbProps {
  fragment: string;
  mode: OrbMode;
  levels: AudioLevels;
  palette: Palette;
  dark: boolean;
  /** Upper bound on device-pixel ratio — lower for expensive (ray-marched) shaders. */
  maxDpr?: number;
  className?: string;
}

export function ShaderOrb({ fragment, mode, levels, palette, dark, maxDpr = 2, className }: ShaderOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Per-frame inputs live in a ref so prop changes never restart the loop.
  const live = useRef({ mode, levels, palette, dark });
  useLayoutEffect(() => {
    live.current = { mode, levels, palette, dark };
  }, [mode, levels, palette, dark]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) {
      setFailed(true);
      return;
    }

    let state: GlState | null = null;
    try {
      state = setup(gl, fragment);
    } catch (err) {
      console.error(err);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- shader compile failure → static fallback
      setFailed(true);
      return;
    }

    const signals = new OrbSignals();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = performance.now();
    let visible = true;
    // Adaptive resolution: start at the cap, step down while frames run slow.
    let scale = Math.min(maxDpr, window.devicePixelRatio || 1);
    let slowFrames = 0;

    const resize = () => {
      const dpr = Math.min(scale, window.devicePixelRatio || 1);
      const { width, height } = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(width * dpr));
      const h = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (!state || gl.isContextLost()) return;
      const dt = (now - last) / 1000;
      last = now;
      // >24 ms frames for ~0.75 s straight → render 25% fewer pixels per axis.
      if (dt > 0.024 && dt < 0.25) slowFrames++;
      else slowFrames = Math.max(0, slowFrames - 2);
      if (slowFrames > 30 && scale > 1) {
        scale = Math.max(1, scale - 0.25);
        slowFrames = 0;
      }
      const { mode: m, levels: lv, palette: pal, dark: dk } = live.current;
      signals.update(lv, m, dt, reduced.matches ? 0.35 : 1);

      resize();
      const { u } = state;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(state.program);
      gl.bindVertexArray(state.vao);
      gl.uniform2f(u.u_res, canvas.width, canvas.height);
      gl.uniform1f(u.u_time, signals.time);
      gl.uniform1f(u.u_dark, dk ? 1 : 0);
      gl.uniform1f(u.u_in, signals.input);
      gl.uniform1f(u.u_out, signals.output);
      gl.uniform1f(u.u_energy, signals.energy);
      gl.uniform1fv(u.u_bands, signals.bands);
      gl.uniform4fv(u.u_state, signals.state);
      gl.uniform1f(u.u_connecting, signals.connecting);
      gl.uniform3fv(u.u_c1, hexToRgb(pal[0]));
      gl.uniform3fv(u.u_c2, hexToRgb(pal[1]));
      gl.uniform3fv(u.u_c3, hexToRgb(pal[2]));
      gl.uniform1f(u.u_bleed, BLEED);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      schedule();
    };

    const schedule = () => {
      if (!raf && visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      last = performance.now();
      schedule();
    });
    io.observe(canvas);
    const onVisibility = () => {
      last = performance.now();
      schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      raf = 0;
      state = null;
    };
    const onRestored = () => {
      try {
        state = setup(gl, fragment);
        schedule();
      } catch (err) {
        console.error(err);
      }
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    schedule();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      destroy(state);
    };
  }, [fragment, maxDpr]);

  if (failed) {
    return (
      <div
        className={cn("h-full w-full rounded-full opacity-80 blur-sm", className)}
        style={{ background: `radial-gradient(circle at 40% 35%, ${palette[2]}, ${palette[0]} 45%, ${palette[1]} 75%, transparent 76%)` }}
        aria-hidden
      />
    );
  }
  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none absolute -inset-[35%] block h-[170%] w-[170%]", className)}
      aria-hidden
    />
  );
}
