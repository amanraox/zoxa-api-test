"use client";

import { Ear } from "lucide-react";

import { ModelSelect } from "@/components/editor/ModelSelect";
import { Field, Note, Section, Segmented, Slider, TextInput, ToggleRow } from "@/components/ui/controls";
import { useAgentField } from "@/components/editor/DraftContext";
import { useModels } from "@/hooks/useCatalog";
import { DEFAULT_STT_MODELS, providerLabel } from "@/lib/zoxa/catalog";
import type { STTConfig, STTProvider } from "@/lib/zoxa/types";

export function TranscriberSection() {
  const [stt, setStt] = useAgentField<STTConfig>(["stt"]);
  const [languages] = useAgentField<string[]>(["languages"]);
  const models = useModels();
  const set = (patch: Partial<STTConfig>) => setStt({ ...stt, ...patch });
  const model = stt.model ?? DEFAULT_STT_MODELS[stt.provider];

  return (
    <Section
      id="sec-stt"
      title="Transcriber"
      icon={Ear}
      summary={`${providerLabel(stt.provider)} · ${model} · barge-in ${stt.interruptionMinWords === 0 ? "instant" : `${stt.interruptionMinWords} words`}`}
    >
      <Field label="Speech-to-text model" hint="Turn detection is provider-native — each transcriber decides when you've finished speaking.">
        <ModelSelect
          type="stt"
          models={models.data}
          loading={models.loading}
          error={models.error}
          onRetry={models.reload}
          provider={stt.provider}
          model={model}
          languages={languages ?? []}
          onChange={(provider, m) => set({ provider: provider as STTProvider, model: m })}
        />
      </Field>

      <Slider
        label="Barge-in words"
        help="0 = the agent stops the instant you start speaking. N = it keeps talking until N words are transcribed (filters coughs and 'mm-hm')."
        value={stt.interruptionMinWords}
        min={0}
        max={10}
        step={1}
        defaultValue={0}
        minLabel="instant"
        maxLabel="10 words"
        onChange={(v) => set({ interruptionMinWords: v })}
      />

      <div className="rounded-lg bg-panel-2/60 p-3 ring-1 ring-line">
        <div className="mb-3 font-mono text-[10px] tracking-wider text-faint uppercase">
          {providerLabel(stt.provider)} settings
        </div>
        <div className="space-y-4">
          <SttKnobs stt={stt} set={set} languages={languages ?? []} />
        </div>
      </div>
    </Section>
  );
}

function SttKnobs({ stt, set, languages }: { stt: STTConfig; set: (p: Partial<STTConfig>) => void; languages: string[] }) {
  switch (stt.provider) {
    case "soniox": {
      const c = stt.soniox;
      const s = (p: Partial<typeof c>) => set({ soniox: { ...c, ...p } });
      return (
        <>
          <Field label="Context terms" hint="Comma-separated names, brands and jargon to bias recognition.">
            <TextInput value={c.contextTerms} onChange={(e) => s({ contextTerms: e.target.value })} placeholder="zoxa, Acme, SKU-1042" />
          </Field>
          <Slider label="Endpoint sensitivity" help="Higher ends the turn faster but may clip speech." value={c.endpointSensitivity} min={-1} max={1} step={0.1} defaultValue={0.3} onChange={(v) => s({ endpointSensitivity: v })} />
          <Slider label="Latency reduction" value={c.endpointLatencyAdjustmentLevel} min={0} max={3} step={1} defaultValue={2} minLabel="0 accurate" maxLabel="3 aggressive" onChange={(v) => s({ endpointLatencyAdjustmentLevel: v })} />
          <Slider label="Max endpoint delay" unit="ms" help="Hard cap on how long Soniox waits after you pause." value={c.maxEndpointDelayMs} min={500} max={3000} step={100} defaultValue={2000} onChange={(v) => s({ maxEndpointDelayMs: v })} />
        </>
      );
    }
    case "flux": {
      const c = stt.flux;
      const s = (p: Partial<typeof c>) => set({ flux: { ...c, ...p } });
      return (
        <>
          <Slider label="EOT threshold" help="Confidence needed to end your turn — higher is safer but slower." value={c.eotThreshold} min={0.5} max={0.9} step={0.05} defaultValue={0.7} onChange={(v) => s({ eotThreshold: v })} />
          <Slider label="EOT timeout" unit="ms" help="After this much silence the turn ends regardless." value={c.eotTimeoutMs} min={500} max={60000} step={100} defaultValue={2000} onChange={(v) => s({ eotTimeoutMs: v })} />
          <Field label="Keyterms" hint="Comma-separated.">
            <TextInput value={c.keyterms} onChange={(e) => s({ keyterms: e.target.value })} placeholder="zoxa, Acme" />
          </Field>
        </>
      );
    }
    case "assemblyai": {
      const c = stt.assemblyai;
      const s = (p: Partial<typeof c>) => set({ assemblyai: { ...c, ...p } });
      return (
        <>
          <Field label="Mode" help="Preset: min latency responds fastest, max accuracy waits longest before ending your turn.">
            <Segmented value={c.mode} onChange={(v) => s({ mode: v })} options={[{ value: "balanced", label: "Balanced" }, { value: "min_latency", label: "Min latency" }, { value: "max_accuracy", label: "Max accuracy" }]} />
          </Field>
          <Field label="Keyterms" hint="Up to 100 terms, 50 chars each, comma-separated.">
            <TextInput value={c.keyterms} onChange={(e) => s({ keyterms: e.target.value })} placeholder="zoxa, Acme" />
          </Field>
          <Field label="Voice focus" help="Isolates the primary speaker. Near field suits handsets; far field suits speakerphones.">
            <Segmented value={c.voiceFocus} onChange={(v) => s({ voiceFocus: v })} options={[{ value: "off", label: "Off" }, { value: "near-field", label: "Near field" }, { value: "far-field", label: "Far field" }]} />
          </Field>
          {c.voiceFocus !== "off" && (
            <Slider label="Focus strength" value={c.voiceFocusThreshold} min={0} max={1} step={0.05} defaultValue={0.9} onChange={(v) => s({ voiceFocusThreshold: v })} />
          )}
        </>
      );
    }
    case "sarvam": {
      const c = stt.sarvam;
      const s = (p: Partial<typeof c>) => set({ sarvam: { ...c, ...p } });
      const hinglish = languages.length === 2 && languages.includes("en") && languages.includes("hi");
      return (
        <>
          <Field label="Mode" hint={hinglish ? "English + Hindi only → codemix is applied automatically." : undefined}>
            <Segmented disabled={hinglish} value={hinglish ? "codemix" : c.mode} onChange={(v) => s({ mode: v })} options={[{ value: "transcribe", label: "Transcribe" }, { value: "verbatim", label: "Verbatim" }, { value: "translit", label: "Translit" }, { value: "codemix", label: "Codemix" }]} />
          </Field>
          <ToggleRow label="High sensitivity" help="Ends your turn after ~64 ms of silence instead of ~576 ms — snappier, more prone to cutting you off." checked={c.highVadSensitivity} onChange={(v) => s({ highVadSensitivity: v })} />
          <Note>Sarvam sends final transcripts only, so word-gated barge-in fires after you pause.</Note>
        </>
      );
    }
    case "cartesia": {
      const c = stt.cartesia;
      const s = (p: Partial<typeof c>) => set({ cartesia: { ...c, ...p } });
      const r2 = (x: number) => Math.round(x * 100) / 100;
      // Server requires end < eagerEnd < start: clamp neighbours on every change.
      const setStart = (v: number) => {
        const p: Partial<typeof c> = { turnStartThreshold: v };
        let eager = c.turnEagerEndThreshold;
        if (eager >= v) p.turnEagerEndThreshold = eager = r2(Math.max(0.3, v - 0.05));
        if (c.turnEndThreshold >= eager) p.turnEndThreshold = r2(Math.max(0.05, eager - 0.05));
        s(p);
      };
      const setEnd = (v: number) => {
        const p: Partial<typeof c> = { turnEndThreshold: v };
        let eager = c.turnEagerEndThreshold;
        if (eager <= v) p.turnEagerEndThreshold = eager = r2(Math.min(0.8, v + 0.05));
        if (c.turnStartThreshold <= eager) p.turnStartThreshold = r2(Math.min(0.9, eager + 0.05));
        s(p);
      };
      return (
        <>
          <Slider label="Start threshold" help="Speech confidence needed to open your turn. Must stay above End." value={c.turnStartThreshold} min={0.5} max={0.9} step={0.05} defaultValue={0.8} onChange={setStart} />
          <Slider label="End threshold" help="Confidence below which the turn ends. Must stay below Start." value={c.turnEndThreshold} min={0.05} max={0.5} step={0.05} defaultValue={0.2} onChange={setEnd} />
          <Slider label="End timeout" unit="ms" help="Force-ends the turn when the model stays uncertain." value={c.turnEndTimeoutMs} min={640} max={11200} step={80} defaultValue={2000} onChange={(v) => s({ turnEndTimeoutMs: v })} />
          <Field label="Keyterms" hint="Up to 100 terms / 1200 characters, comma-separated.">
            <TextInput value={c.keyterms} onChange={(e) => s({ keyterms: e.target.value })} placeholder="zoxa, Acme" />
          </Field>
        </>
      );
    }
  }
}
