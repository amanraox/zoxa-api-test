"use client";

import { AudioLines } from "lucide-react";

import { ModelSelect } from "@/components/editor/ModelSelect";
import { VoicePicker } from "@/components/editor/VoicePicker";
import { Field, Note, Section, Segmented, Slider, ToggleRow } from "@/components/ui/controls";
import { useAgentField } from "@/components/editor/DraftContext";
import { useModels } from "@/hooks/useCatalog";
import { DEFAULT_TTS_MODELS, isElevenDialogueModel, providerLabel } from "@/lib/zoxa/catalog";
import type { TTSConfig, TTSProvider } from "@/lib/zoxa/types";

export function VoiceSection() {
  const [tts, setTts] = useAgentField<TTSConfig>(["tts"]);
  const [languages] = useAgentField<string[]>(["languages"]);
  const models = useModels();
  const set = (patch: Partial<TTSConfig>) => setTts({ ...tts, ...patch });
  const model = tts.model ?? DEFAULT_TTS_MODELS[tts.provider];

  return (
    <Section
      id="sec-voice"
      title="Voice"
      icon={AudioLines}
      summary={`${providerLabel(tts.provider)} · ${model} · ${tts.voice ?? "default voice"}`}
    >
      <Field label="Voice model" hint="Agent audio is generated and delivered at 24 kHz.">
        <ModelSelect
          type="tts"
          models={models.data}
          loading={models.loading}
          error={models.error}
          onRetry={models.reload}
          provider={tts.provider}
          model={model}
          languages={languages ?? []}
          onChange={(provider, m) =>
            // Voice ids are provider-specific: switching provider resets to its default voice.
            set({ provider: provider as TTSProvider, model: m, ...(provider !== tts.provider ? { voice: null } : {}) })
          }
        />
      </Field>

      <Field label="Voice">
        <VoicePicker provider={tts.provider} model={tts.model} value={tts.voice} onChange={(voice) => set({ voice })} />
      </Field>

      <div className="rounded-lg bg-panel-2/60 p-3 ring-1 ring-line">
        <div className="mb-3 font-mono text-[10px] tracking-wider text-faint uppercase">
          {providerLabel(tts.provider)} settings
        </div>
        <div className="space-y-4">
          <TtsKnobs tts={tts} set={set} model={model} />
        </div>
      </div>
    </Section>
  );
}

function TtsKnobs({ tts, set, model }: { tts: TTSConfig; set: (p: Partial<TTSConfig>) => void; model: string }) {
  switch (tts.provider) {
    case "elevenlabs": {
      const t = tts.elevenlabs;
      const s = (p: Partial<typeof t>) => set({ elevenlabs: { ...t, ...p } });
      if (isElevenDialogueModel(model)) {
        return (
          <>
            <Slider label="Stability" help="The only voice setting Eleven v3/v4 read. 0 most expressive, 1 most consistent." value={t.stability} min={0} max={1} step={0.05} defaultValue={0.5} onChange={(v) => s({ stability: v })} />
            <Note>Eleven v3 / v4 stream over Text-to-Dialogue — every other ElevenLabs knob is ignored on these models.</Note>
          </>
        );
      }
      return (
        <>
          <Slider label="Stability" help="Low is expressive but variable, high is consistent but flatter." value={t.stability} min={0} max={1} step={0.05} defaultValue={0.5} onChange={(v) => s({ stability: v })} />
          <Slider label="Similarity boost" value={t.similarityBoost} min={0} max={1} step={0.05} defaultValue={0.75} onChange={(v) => s({ similarityBoost: v })} />
          <Slider label="Style" help="Style exaggeration — anything above 0 adds latency." value={t.style} min={0} max={1} step={0.05} defaultValue={0} onChange={(v) => s({ style: v })} />
          <Slider label="Speed" value={t.speed} min={0.7} max={1.2} step={0.01} defaultValue={1} onChange={(v) => s({ speed: v })} />
          <ToggleRow label="Speaker boost" help="Boosts similarity to the speaker; adds a little latency." checked={t.useSpeakerBoost} onChange={(v) => s({ useSpeakerBoost: v })} />
          <ToggleRow label="Auto mode" help="Synthesizes as soon as a full sentence arrives — lower latency." checked={t.autoMode} onChange={(v) => s({ autoMode: v })} />
          <Field label="Text normalization">
            <Segmented value={t.applyTextNormalization} onChange={(v) => s({ applyTextNormalization: v })} options={[{ value: "auto", label: "Auto" }, { value: "on", label: "On" }, { value: "off", label: "Off" }]} />
          </Field>
        </>
      );
    }
    case "cartesia": {
      const t = tts.cartesia;
      const s = (p: Partial<typeof t>) => set({ cartesia: { ...t, ...p } });
      return (
        <>
          <Slider label="Speed" value={t.speed} min={0.6} max={1.5} step={0.05} defaultValue={1} onChange={(v) => s({ speed: v })} />
          <Slider label="Volume" help="Loudness multiplier — 1.0 leaves the voice unchanged; platform default 1.5." value={t.volume} min={0.5} max={2} step={0.05} defaultValue={1.5} onChange={(v) => s({ volume: v })} />
        </>
      );
    }
    case "smallest": {
      const t = tts.smallest;
      return <Slider label="Speed" value={t.speed} min={0.5} max={2} step={0.05} defaultValue={1} onChange={(v) => set({ smallest: { ...t, speed: v } })} />;
    }
    case "sarvam": {
      const t = tts.sarvam;
      const s = (p: Partial<typeof t>) => set({ sarvam: { ...t, ...p } });
      return (
        <>
          <Slider label="Pace" value={t.pace} min={0.5} max={2} step={0.05} defaultValue={1} onChange={(v) => s({ pace: v })} />
          <Slider label="Temperature" help="Expressive variability (v3)." value={t.temperature} min={0.01} max={1} step={0.01} defaultValue={0.6} onChange={(v) => s({ temperature: v })} />
        </>
      );
    }
    case "xai": {
      const t = tts.xai;
      const s = (p: Partial<typeof t>) => set({ xai: { ...t, ...p } });
      return (
        <>
          <Slider label="Speed" value={t.speed} min={0.7} max={1.5} step={0.05} defaultValue={1} onChange={(v) => s({ speed: v })} />
          <Slider label="Latency mode" help="0 = best quality, 2 = lowest time-to-first-audio." value={t.optimizeStreamingLatency} min={0} max={2} step={1} defaultValue={0} onChange={(v) => s({ optimizeStreamingLatency: v })} />
          <ToggleRow label="Text normalization" help="Speaks numbers and dates naturally — adds a little latency." checked={t.textNormalization} onChange={(v) => s({ textNormalization: v })} />
        </>
      );
    }
    case "inworld": {
      const t = tts.inworld;
      const s = (p: Partial<typeof t>) => set({ inworld: { ...t, ...p } });
      return (
        <>
          <Slider label="Speaking rate" value={t.speakingRate} min={0.5} max={1.5} step={0.05} defaultValue={1} onChange={(v) => s({ speakingRate: v })} />
          {model === "inworld-tts-2" ? (
            <Note>inworld-tts-2 ignores temperature — only tts-2-flash honours it.</Note>
          ) : (
            <Slider label="Temperature" value={t.temperature} min={0.01} max={2} step={0.01} defaultValue={1} onChange={(v) => s({ temperature: v })} />
          )}
        </>
      );
    }
  }
}
