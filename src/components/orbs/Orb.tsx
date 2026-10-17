"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import type { AudioLevels } from "@/lib/audio/engine";
import type { OrbMode } from "@/lib/call/session";

import type { Palette } from "./palettes";
import { ShaderOrb } from "./ShaderOrb";
import { HALO, LIQUID, NEBULA, PULSE } from "./shaders";

const ElevenLabsOrb = dynamic(() => import("@/components/ui/orb").then((m) => m.Orb), {
  ssr: false,
  loading: () => null,
});

export type OrbKind = "halo" | "liquid" | "nebula" | "pulse" | "elevenlabs";

export const ORBS: ReadonlyArray<{ id: OrbKind; name: string; blurb: string }> = [
  { id: "halo", name: "Halo", blurb: "Aurora lobes swirling on a breathing ring" },
  { id: "liquid", name: "Liquid", blurb: "Ray-marched chrome that ripples with the voice" },
  { id: "nebula", name: "Nebula", blurb: "A living gas sphere with a spectral corona" },
  { id: "pulse", name: "Pulse", blurb: "Radial spectrum instrument from the real FFT" },
  { id: "elevenlabs", name: "Classic", blurb: "The ElevenLabs flow orb" },
];

const SHADERS: Record<Exclude<OrbKind, "elevenlabs">, { fragment: string; maxDpr: number }> = {
  halo: { fragment: HALO, maxDpr: 2 },
  liquid: { fragment: LIQUID, maxDpr: 2 },
  nebula: { fragment: NEBULA, maxDpr: 2 },
  pulse: { fragment: PULSE, maxDpr: 2 },
};

const EL_STATE: Record<OrbMode, "thinking" | "listening" | "talking" | null> = {
  idle: null,
  connecting: "thinking",
  thinking: "thinking",
  listening: "listening",
  speaking: "talking",
};

export function Orb({
  kind,
  mode,
  levels,
  palette,
  dark,
}: {
  kind: OrbKind;
  mode: OrbMode;
  levels: AudioLevels;
  palette: Palette;
  dark: boolean;
}) {
  const elColors = useMemo<[string, string]>(() => [palette[0], palette[2]], [palette]);
  const getters = useMemo(() => ({ input: levels.input.bind(levels), output: levels.output.bind(levels) }), [levels]);
  if (kind === "elevenlabs") {
    return (
      <ElevenLabsOrb
        colors={elColors}
        agentState={EL_STATE[mode]}
        getInputVolume={getters.input}
        getOutputVolume={getters.output}
      />
    );
  }
  const s = SHADERS[kind];
  return <ShaderOrb fragment={s.fragment} maxDpr={s.maxDpr} mode={mode} levels={levels} palette={palette} dark={dark} />;
}
