"use client"

import { useState, useMemo } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeft, Circle, Sparkles, Atom, Flame, Droplets, Gem, Waves, Hexagon, Globe } from "lucide-react"
import type { OrbShaderSettings } from "@/components/ui/orb"
import type { SphereOrbSettings } from "@/components/orbs/sphere-orb"
import type { GlowOrbSettings } from "@/components/orbs/glow-orb"
import type { ParticleOrbSettings } from "@/components/orbs/particle-orb"
import type { BlobOrbSettings } from "@/components/orbs/blob-orb"
import type { CrystalOrbSettings } from "@/components/orbs/crystal-orb"
import type { WaveOrbSettings } from "@/components/orbs/wave-orb"
import type { BubbleOrbSettings } from "@/components/orbs/bubble-orb"
import type { WireframeOrbSettings } from "@/components/orbs/wireframe-orb"

const ElevenLabsOrb = dynamic(() => import("@/components/ui/orb").then((m) => m.Orb), { ssr: false })
const SphereOrb = dynamic(() => import("@/components/orbs/sphere-orb").then((m) => m.SphereOrb), { ssr: false })
const GlowOrb = dynamic(() => import("@/components/orbs/glow-orb").then((m) => m.GlowOrb), { ssr: false })
const ParticleOrb = dynamic(() => import("@/components/orbs/particle-orb").then((m) => m.ParticleOrb), { ssr: false })
const BlobOrb = dynamic(() => import("@/components/orbs/blob-orb").then((m) => m.BlobOrb), { ssr: false })
const CrystalOrb = dynamic(() => import("@/components/orbs/crystal-orb").then((m) => m.CrystalOrb), { ssr: false })
const WaveOrb = dynamic(() => import("@/components/orbs/wave-orb").then((m) => m.WaveOrb), { ssr: false })
const BubbleOrb = dynamic(() => import("@/components/orbs/bubble-orb").then((m) => m.BubbleOrb), { ssr: false })
const WireframeOrb = dynamic(() => import("@/components/orbs/wireframe-orb").then((m) => m.WireframeOrb), { ssr: false })

type OrbType = "elevenlabs" | "sphere" | "glow" | "particle" | "blob" | "crystal" | "wave" | "bubble" | "wireframe"

const orbList: { id: OrbType; name: string; desc: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "elevenlabs", name: "ElevenLabs", desc: "Perlin noise flat shader", icon: Circle },
  { id: "sphere", name: "3D Sphere", desc: "Displaced sphere with noise", icon: Atom },
  { id: "blob", name: "Liquid Blob", desc: "Metallic organic blob", icon: Droplets },
  { id: "crystal", name: "Crystal", desc: "Faceted gemstone shape", icon: Gem },
  { id: "wave", name: "Wave Rings", desc: "Animated torus layers", icon: Waves },
  { id: "glow", name: "Glow Orb", desc: "Layered radial glow", icon: Sparkles },
  { id: "particle", name: "Particle Orb", desc: "Points-based sphere", icon: Flame },
  { id: "bubble", name: "Soap Bubble", desc: "Iridescent thin-film", icon: Globe },
  { id: "wireframe", name: "Wireframe", desc: "Spiky wireframe with glow", icon: Hexagon },
]

// Default settings for each orb
const elDefaults: OrbShaderSettings & { color1: string; color2: string } = {
  color1: "#2792dc", color2: "#9ce6e6",
  timeSpeed: 0.5, animSpeedMultiplier: 1.0, distortionMin: 0.08, distortionMax: 0.25,
  ovalSoftness: 0.6, ovalHeightMax: 3.5, ovalHeightMin: 2.5, ovalWidthBase: 0.5,
  ovalWidthNoise: 0.3, ovalAlpha: 0.85, ringIntensity: 1.0, colorLerpSpeed: 0.08,
  gradientContrast: 0.1, morphSpeed: 0.05, flowRadiusScale: 0.03, flowAnimScale: 0.2,
  ovalRotationAmplitude: 0.5, ovalRotationPeriod: 20.0,
}

const sphereDefaults: Required<SphereOrbSettings> = {
  color1: "#2792dc", color2: "#9ce6e6", noiseFrequency: 2.0, noiseAmplitude: 0.3,
  noiseSpeed: 0.8, rotationSpeedX: 0.2, rotationSpeedY: 0.3, segments: 128,
  metalness: 0.3, roughness: 0.4, glowIntensity: 0.5, wireframe: false,
}

const glowDefaults: Required<GlowOrbSettings> = {
  coreColor: "#2792dc", glowColor: "#9ce6e6", pulseSpeed: 1.0, pulseAmount: 0.15,
  coreSize: 1.0, glowSize: 2.5, glowFalloff: 2.0, layers: 5, rotationSpeed: 0.3, brightness: 1.2,
}

const particleDefaults: Required<ParticleOrbSettings> = {
  color1: "#2792dc", color2: "#9ce6e6", particleCount: 3000, particleSize: 2.0,
  radius: 1.5, noiseScale: 1.5, noiseSpeed: 0.3, noiseAmplitude: 0.4, rotationSpeed: 0.15, sparkle: 0.5,
}

const blobDefaults: Required<BlobOrbSettings> = {
  color1: "#2792dc", color2: "#9ce6e6", color3: "#1a5276",
  speed: 0.4, distortion: 0.5, frequency: 1.5, surfaceDistort: 0.8,
  roughness: 0.15, metalness: 0.9, envIntensity: 1.0, iridescence: 0.3,
}

const crystalDefaults: Required<CrystalOrbSettings> = {
  color1: "#2792dc", color2: "#9ce6e6", facets: 4, rotationSpeed: 0.3,
  pulseSpeed: 0.8, pulseAmount: 0.1, edgeGlow: 1.5, innerGlow: 0.5, refraction: 0.3, detail: 1,
}

const waveDefaults: Required<WaveOrbSettings> = {
  color1: "#2792dc", color2: "#9ce6e6", color3: "#1e3a5f",
  waveSpeed: 1.0, waveFrequency: 3.0, waveAmplitude: 0.3,
  layers: 8, rotationSpeed: 0.2, spacing: 0.15, thickness: 0.02, opacity: 0.7,
}

const bubbleDefaults: Required<BubbleOrbSettings> = {
  baseColor: "#c8e6ff", filmThickness: 0.5, filmSpeed: 0.3, deformSpeed: 0.5,
  deformAmount: 0.08, deformFreq: 2.0, fresnelPower: 3.0, rainbowIntensity: 1.0,
  transparency: 0.4, shininess: 64.0,
}

const wireframeDefaults: Required<WireframeOrbSettings> = {
  color1: "#2792dc", color2: "#9ce6e6", spikeAmount: 0.4, spikeFrequency: 3.0,
  spikeSpeed: 0.6, rotationSpeed: 0.15, segments: 32, lineWidth: 1.0,
  pulseSpeed: 1.0, pulseAmount: 0.1, innerSphere: true, glowColor: "#2792dc",
}

type SliderDef = { label: string; key: string; min: number; max: number; step: number; def: number }
type ColorDef = { label: string; key: string; def: string }
type ToggleDef = { label: string; key: string; def: boolean }

function getControls(type: OrbType): { sliders: SliderDef[]; colors: ColorDef[]; toggles: ToggleDef[] } {
  switch (type) {
    case "elevenlabs":
      return {
        colors: [
          { label: "Color 1", key: "color1", def: "#2792dc" },
          { label: "Color 2", key: "color2", def: "#9ce6e6" },
        ],
        toggles: [],
        sliders: [
          { label: "Rotation Speed", key: "timeSpeed", min: 0.05, max: 2, step: 0.05, def: 0.5 },
          { label: "Animation Speed", key: "animSpeedMultiplier", min: 0.1, max: 4, step: 0.1, def: 1.0 },
          { label: "Gradient Contrast", key: "gradientContrast", min: 0, max: 1, step: 0.01, def: 0.1 },
          { label: "Distortion Min", key: "distortionMin", min: 0, max: 1, step: 0.01, def: 0.08 },
          { label: "Distortion Max", key: "distortionMax", min: 0, max: 1, step: 0.01, def: 0.25 },
          { label: "Oval Softness", key: "ovalSoftness", min: 0, max: 1.5, step: 0.05, def: 0.6 },
          { label: "Oval Height Max", key: "ovalHeightMax", min: 0.5, max: 8, step: 0.1, def: 3.5 },
          { label: "Oval Height Min", key: "ovalHeightMin", min: 0.5, max: 8, step: 0.1, def: 2.5 },
          { label: "Oval Width", key: "ovalWidthBase", min: 0.1, max: 2, step: 0.05, def: 0.5 },
          { label: "Oval Width Noise", key: "ovalWidthNoise", min: 0, max: 1, step: 0.05, def: 0.3 },
          { label: "Oval Alpha", key: "ovalAlpha", min: 0, max: 1, step: 0.05, def: 0.85 },
          { label: "Ring Intensity", key: "ringIntensity", min: 0, max: 3, step: 0.1, def: 1.0 },
          { label: "Color Blend Speed", key: "colorLerpSpeed", min: 0.01, max: 0.5, step: 0.01, def: 0.08 },
          { label: "Morph Speed", key: "morphSpeed", min: 0, max: 0.3, step: 0.005, def: 0.05 },
          { label: "Flow Depth", key: "flowRadiusScale", min: 0, max: 0.15, step: 0.005, def: 0.03 },
          { label: "Flow Anim Scale", key: "flowAnimScale", min: 0, max: 1, step: 0.05, def: 0.2 },
          { label: "Petal Rotation Amp", key: "ovalRotationAmplitude", min: 0, max: 2, step: 0.05, def: 0.5 },
          { label: "Petal Rotation Period", key: "ovalRotationPeriod", min: 2, max: 60, step: 1, def: 20 },
        ],
      }
    case "sphere":
      return {
        colors: [
          { label: "Color 1", key: "color1", def: "#2792dc" },
          { label: "Color 2", key: "color2", def: "#9ce6e6" },
        ],
        toggles: [{ label: "Wireframe", key: "wireframe", def: false }],
        sliders: [
          { label: "Noise Frequency", key: "noiseFrequency", min: 0.5, max: 8, step: 0.1, def: 2.0 },
          { label: "Noise Amplitude", key: "noiseAmplitude", min: 0, max: 1.5, step: 0.05, def: 0.3 },
          { label: "Noise Speed", key: "noiseSpeed", min: 0, max: 3, step: 0.1, def: 0.8 },
          { label: "Rotation Speed X", key: "rotationSpeedX", min: 0, max: 2, step: 0.05, def: 0.2 },
          { label: "Rotation Speed Y", key: "rotationSpeedY", min: 0, max: 2, step: 0.05, def: 0.3 },
          { label: "Segments", key: "segments", min: 16, max: 256, step: 16, def: 128 },
          { label: "Glow Intensity", key: "glowIntensity", min: 0, max: 2, step: 0.1, def: 0.5 },
        ],
      }
    case "glow":
      return {
        colors: [
          { label: "Core Color", key: "coreColor", def: "#2792dc" },
          { label: "Glow Color", key: "glowColor", def: "#9ce6e6" },
        ],
        toggles: [],
        sliders: [
          { label: "Pulse Speed", key: "pulseSpeed", min: 0, max: 5, step: 0.1, def: 1.0 },
          { label: "Pulse Amount", key: "pulseAmount", min: 0, max: 1, step: 0.05, def: 0.15 },
          { label: "Core Size", key: "coreSize", min: 0.2, max: 3, step: 0.1, def: 1.0 },
          { label: "Glow Size", key: "glowSize", min: 0.5, max: 5, step: 0.1, def: 2.5 },
          { label: "Glow Falloff", key: "glowFalloff", min: 0.5, max: 5, step: 0.1, def: 2.0 },
          { label: "Layers", key: "layers", min: 1, max: 12, step: 1, def: 5 },
          { label: "Rotation Speed", key: "rotationSpeed", min: 0, max: 2, step: 0.05, def: 0.3 },
          { label: "Brightness", key: "brightness", min: 0.2, max: 3, step: 0.1, def: 1.2 },
        ],
      }
    case "particle":
      return {
        colors: [
          { label: "Color 1", key: "color1", def: "#2792dc" },
          { label: "Color 2", key: "color2", def: "#9ce6e6" },
        ],
        toggles: [],
        sliders: [
          { label: "Particle Count", key: "particleCount", min: 500, max: 10000, step: 500, def: 3000 },
          { label: "Particle Size", key: "particleSize", min: 0.5, max: 6, step: 0.5, def: 2.0 },
          { label: "Radius", key: "radius", min: 0.5, max: 3, step: 0.1, def: 1.5 },
          { label: "Noise Scale", key: "noiseScale", min: 0.1, max: 5, step: 0.1, def: 1.5 },
          { label: "Noise Speed", key: "noiseSpeed", min: 0, max: 2, step: 0.05, def: 0.3 },
          { label: "Noise Amplitude", key: "noiseAmplitude", min: 0, max: 1.5, step: 0.05, def: 0.4 },
          { label: "Rotation Speed", key: "rotationSpeed", min: 0, max: 1, step: 0.05, def: 0.15 },
          { label: "Sparkle", key: "sparkle", min: 0, max: 1, step: 0.05, def: 0.5 },
        ],
      }
    case "blob":
      return {
        colors: [
          { label: "Color 1", key: "color1", def: "#2792dc" },
          { label: "Color 2", key: "color2", def: "#9ce6e6" },
          { label: "Color 3", key: "color3", def: "#1a5276" },
        ],
        toggles: [],
        sliders: [
          { label: "Speed", key: "speed", min: 0.05, max: 2, step: 0.05, def: 0.4 },
          { label: "Distortion", key: "distortion", min: 0, max: 1.5, step: 0.05, def: 0.5 },
          { label: "Frequency", key: "frequency", min: 0.5, max: 5, step: 0.1, def: 1.5 },
          { label: "Surface Detail", key: "surfaceDistort", min: 0, max: 2, step: 0.1, def: 0.8 },
          { label: "Roughness", key: "roughness", min: 0, max: 1, step: 0.05, def: 0.15 },
          { label: "Metalness", key: "metalness", min: 0, max: 1, step: 0.05, def: 0.9 },
          { label: "Iridescence", key: "iridescence", min: 0, max: 1, step: 0.05, def: 0.3 },
        ],
      }
    case "crystal":
      return {
        colors: [
          { label: "Color 1", key: "color1", def: "#2792dc" },
          { label: "Color 2", key: "color2", def: "#9ce6e6" },
        ],
        toggles: [],
        sliders: [
          { label: "Detail", key: "detail", min: 0, max: 4, step: 1, def: 1 },
          { label: "Rotation Speed", key: "rotationSpeed", min: 0, max: 2, step: 0.05, def: 0.3 },
          { label: "Pulse Speed", key: "pulseSpeed", min: 0, max: 3, step: 0.1, def: 0.8 },
          { label: "Pulse Amount", key: "pulseAmount", min: 0, max: 0.5, step: 0.01, def: 0.1 },
          { label: "Edge Glow", key: "edgeGlow", min: 0.5, max: 5, step: 0.1, def: 1.5 },
          { label: "Inner Glow", key: "innerGlow", min: 0, max: 2, step: 0.1, def: 0.5 },
          { label: "Refraction", key: "refraction", min: 0, max: 1, step: 0.05, def: 0.3 },
        ],
      }
    case "bubble":
      return {
        colors: [{ label: "Base Color", key: "baseColor", def: "#c8e6ff" }],
        toggles: [],
        sliders: [
          { label: "Film Thickness", key: "filmThickness", min: 0.1, max: 1.5, step: 0.05, def: 0.5 },
          { label: "Film Speed", key: "filmSpeed", min: 0, max: 2, step: 0.05, def: 0.3 },
          { label: "Deform Speed", key: "deformSpeed", min: 0, max: 2, step: 0.05, def: 0.5 },
          { label: "Deform Amount", key: "deformAmount", min: 0, max: 0.3, step: 0.01, def: 0.08 },
          { label: "Deform Frequency", key: "deformFreq", min: 0.5, max: 6, step: 0.5, def: 2.0 },
          { label: "Fresnel Power", key: "fresnelPower", min: 1, max: 6, step: 0.5, def: 3.0 },
          { label: "Rainbow Intensity", key: "rainbowIntensity", min: 0, max: 3, step: 0.1, def: 1.0 },
          { label: "Transparency", key: "transparency", min: 0.1, max: 1, step: 0.05, def: 0.4 },
          { label: "Shininess", key: "shininess", min: 4, max: 128, step: 4, def: 64 },
        ],
      }
    case "wireframe":
      return {
        colors: [
          { label: "Color 1", key: "color1", def: "#2792dc" },
          { label: "Color 2", key: "color2", def: "#9ce6e6" },
          { label: "Glow Color", key: "glowColor", def: "#2792dc" },
        ],
        toggles: [{ label: "Inner Sphere", key: "innerSphere", def: true }],
        sliders: [
          { label: "Spike Amount", key: "spikeAmount", min: 0, max: 1.5, step: 0.05, def: 0.4 },
          { label: "Spike Frequency", key: "spikeFrequency", min: 0.5, max: 8, step: 0.5, def: 3.0 },
          { label: "Spike Speed", key: "spikeSpeed", min: 0, max: 2, step: 0.05, def: 0.6 },
          { label: "Rotation Speed", key: "rotationSpeed", min: 0, max: 1, step: 0.05, def: 0.15 },
          { label: "Segments", key: "segments", min: 8, max: 64, step: 4, def: 32 },
          { label: "Pulse Speed", key: "pulseSpeed", min: 0, max: 3, step: 0.1, def: 1.0 },
          { label: "Pulse Amount", key: "pulseAmount", min: 0, max: 0.5, step: 0.01, def: 0.1 },
        ],
      }
    case "wave":
      return {
        colors: [
          { label: "Color 1", key: "color1", def: "#2792dc" },
          { label: "Color 2", key: "color2", def: "#9ce6e6" },
          { label: "Color 3", key: "color3", def: "#1e3a5f" },
        ],
        toggles: [],
        sliders: [
          { label: "Wave Speed", key: "waveSpeed", min: 0, max: 3, step: 0.1, def: 1.0 },
          { label: "Wave Amplitude", key: "waveAmplitude", min: 0, max: 1, step: 0.05, def: 0.3 },
          { label: "Layers", key: "layers", min: 3, max: 20, step: 1, def: 8 },
          { label: "Rotation Speed", key: "rotationSpeed", min: 0, max: 1, step: 0.05, def: 0.2 },
          { label: "Spacing", key: "spacing", min: 0.05, max: 0.4, step: 0.01, def: 0.15 },
          { label: "Thickness", key: "thickness", min: 0.005, max: 0.1, step: 0.005, def: 0.02 },
          { label: "Opacity", key: "opacity", min: 0.1, max: 1, step: 0.05, def: 0.7 },
        ],
      }
  }
}

export default function OrbPage() {
  const [selected, setSelected] = useState<OrbType>("elevenlabs")
  const [settings, setSettings] = useState<Record<OrbType, Record<string, unknown>>>({
    elevenlabs: { ...elDefaults },
    sphere: { ...sphereDefaults },
    glow: { ...glowDefaults },
    particle: { ...particleDefaults },
    blob: { ...blobDefaults },
    crystal: { ...crystalDefaults },
    wave: { ...waveDefaults },
    bubble: { ...bubbleDefaults },
    wireframe: { ...wireframeDefaults },
  })

  const currentSettings = settings[selected]
  const controls = useMemo(() => getControls(selected), [selected])

  const update = (key: string, value: unknown) => {
    setSettings((s) => ({ ...s, [selected]: { ...s[selected], [key]: value } }))
  }

  const resetAll = () => {
    const defaults: Record<OrbType, Record<string, unknown>> = {
      elevenlabs: { ...elDefaults },
      sphere: { ...sphereDefaults },
      glow: { ...glowDefaults },
      particle: { ...particleDefaults },
      blob: { ...blobDefaults },
      crystal: { ...crystalDefaults },
      wave: { ...waveDefaults },
      bubble: { ...bubbleDefaults },
      wireframe: { ...wireframeDefaults },
    }
    setSettings((s) => ({ ...s, [selected]: defaults[selected] }))
  }

  const inputCls = "w-full bg-input/50 border border-border/60 rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/50 transition-all"

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Left Panel - Orb Gallery */}
      <aside className="w-[220px] shrink-0 border-r border-border/40 flex flex-col">
        <div className="p-4 border-b border-border/40">
          <Link href="/" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} />
            Back to Call
          </Link>
        </div>
        <div className="p-3">
          <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">Orb Types</h2>
          <div className="space-y-1">
            {orbList.map((orb) => {
              const Icon = orb.icon
              return (
                <button
                  key={orb.id}
                  onClick={() => setSelected(orb.id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    selected === orb.id
                      ? "bg-foreground/5 border border-border"
                      : "hover:bg-foreground/[0.02] border border-transparent"
                  }`}
                >
                  <Icon size={18} className={selected === orb.id ? "text-foreground mt-0.5" : "text-muted-foreground mt-0.5"} />
                  <div>
                    <div className={`text-[13px] font-medium ${selected === orb.id ? "text-foreground" : "text-muted-foreground"}`}>
                      {orb.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground/60">{orb.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Center - Orb Preview */}
      <main className="flex-1 flex items-center justify-center bg-background relative">
        <div className="w-[400px] h-[400px]">
          {selected === "elevenlabs" && (
            <ElevenLabsOrb
              colors={[currentSettings.color1 as string, currentSettings.color2 as string]}
              shader={currentSettings as OrbShaderSettings}
            />
          )}
          {selected === "sphere" && (
            <SphereOrb settings={currentSettings as SphereOrbSettings} />
          )}
          {selected === "glow" && (
            <GlowOrb settings={currentSettings as GlowOrbSettings} />
          )}
          {selected === "particle" && (
            <ParticleOrb settings={currentSettings as ParticleOrbSettings} />
          )}
          {selected === "blob" && (
            <BlobOrb settings={currentSettings as BlobOrbSettings} />
          )}
          {selected === "crystal" && (
            <CrystalOrb settings={currentSettings as CrystalOrbSettings} />
          )}
          {selected === "wave" && (
            <WaveOrb settings={currentSettings as WaveOrbSettings} />
          )}
          {selected === "bubble" && (
            <BubbleOrb settings={currentSettings as BubbleOrbSettings} />
          )}
          {selected === "wireframe" && (
            <WireframeOrb settings={currentSettings as WireframeOrbSettings} />
          )}
        </div>
        <div className="absolute bottom-6 text-[12px] text-muted-foreground/50">
          {orbList.find((o) => o.id === selected)?.name} Orb
        </div>
      </main>

      {/* Right Panel - Settings */}
      <aside className="w-[320px] shrink-0 border-l border-border/40 overflow-y-auto">
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <h2 className="text-sm font-medium">Settings</h2>
          <button onClick={resetAll} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border/40 transition-colors">
            Reset
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Colors */}
          {controls.colors.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Colors</h3>
              {controls.colors.map((c) => (
                <div key={c.key} className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">{c.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(currentSettings[c.key] as string) ?? c.def}
                      onChange={(e) => update(c.key, e.target.value)}
                      className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={(currentSettings[c.key] as string) ?? c.def}
                      onChange={(e) => update(c.key, e.target.value)}
                      className={`${inputCls} font-mono text-[11px]`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Toggles */}
          {controls.toggles.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Options</h3>
              {controls.toggles.map((t) => (
                <div key={t.key} className="flex items-center justify-between">
                  <label className="text-[12px] text-foreground/80">{t.label}</label>
                  <button
                    onClick={() => update(t.key, !(currentSettings[t.key] as boolean))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${(currentSettings[t.key] as boolean) ? "bg-foreground" : "bg-border"}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-background absolute top-0.5 transition-all ${(currentSettings[t.key] as boolean) ? "left-5.5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sliders */}
          {controls.sliders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Parameters</h3>
              {controls.sliders.map((s) => (
                <div key={s.key} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] text-muted-foreground">{s.label}</label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono text-foreground/60">
                        {((currentSettings[s.key] as number) ?? s.def).toFixed(s.step < 0.01 ? 3 : 2)}
                      </span>
                      {(currentSettings[s.key] as number) !== s.def && (
                        <button onClick={() => update(s.key, s.def)} className="text-[9px] text-muted-foreground hover:text-foreground px-1 rounded border border-border/40">
                          rst
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={(currentSettings[s.key] as number) ?? s.def}
                    onChange={(e) => update(s.key, parseFloat(e.target.value))}
                    className="w-full accent-foreground h-1"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
