"use client";

import { Sparkles, Waves } from "lucide-react";

import { Field, Section, Segmented, Slider, TextInput, ToggleRow } from "@/components/ui/controls";
import { useAgentField } from "@/components/editor/DraftContext";
import type {
  AcknowledgeSoundsConfig,
  BackgroundSoundConfig,
  FillerWordsConfig,
  NoiseGateConfig,
  TaskSoundConfig,
} from "@/lib/zoxa/types";

export function NoiseSection() {
  const [g, setG] = useAgentField<NoiseGateConfig>(["noiseGate"]);
  const set = (p: Partial<NoiseGateConfig>) => setG({ ...g, ...p });
  return (
    <Section
      id="sec-noise"
      title="Noise gate"
      icon={Waves}
      summary={g.enabled ? `${g.model} · ${g.enhancementLevel}` : "Off"}
    >
      <ToggleRow label="Enabled" help="Cleans caller audio before it reaches the transcriber." checked={g.enabled} onChange={(v) => set({ enabled: v })} />
      {g.enabled && (
        <>
          <Field label="Mode">
            <Segmented
              value={g.model}
              onChange={(v) => set({ model: v })}
              options={[
                { value: "voice-focus", label: "Voice focus" },
                { value: "noise-suppression", label: "Noise suppression" },
              ]}
            />
          </Field>
          <Slider label="Enhancement level" value={g.enhancementLevel} min={0} max={1} step={0.05} defaultValue={0.8} onChange={(v) => set({ enhancementLevel: v })} />
        </>
      )}
    </Section>
  );
}

const ORDER_OPTIONS = [
  { value: "round-robin", label: "In order" },
  { value: "random", label: "Random" },
] as const;

export function HumanFeelSection() {
  const [bg, setBg] = useAgentField<BackgroundSoundConfig>(["backgroundSound"]);
  const [task, setTask] = useAgentField<TaskSoundConfig>(["taskSound"]);
  const [ack, setAck] = useAgentField<AcknowledgeSoundsConfig>(["acknowledgeSounds"]);
  const [fill, setFill] = useAgentField<FillerWordsConfig>(["fillerWords"]);
  const on = [bg.enabled && "ambience", task.enabled && "task sounds", ack.enabled && "acknowledgements", fill.enabled && "fillers"].filter(Boolean);

  return (
    <Section id="sec-human" title="Human feel" icon={Sparkles} summary={on.length ? on.join(" · ") : "All off"}>
      <SubBlock title="Background ambience" enabled={bg.enabled} onToggle={(v) => setBg({ ...bg, enabled: v })} help="A low environment loop under the whole call.">
        <Field label="Sound">
          <Segmented
            size="sm"
            value={bg.sound}
            onChange={(v) => setBg({ ...bg, sound: v })}
            options={[
              { value: "library", label: "Library" },
              { value: "crowd", label: "Crowd" },
              { value: "restaurant", label: "Restaurant" },
              { value: "supermarket", label: "Market" },
            ]}
          />
        </Field>
        <Slider label="Volume" value={bg.volume} min={0.02} max={0.2} step={0.01} defaultValue={0.08} onChange={(v) => setBg({ ...bg, volume: v })} />
      </SubBlock>

      <SubBlock title="Task sounds" enabled={task.enabled} onToggle={(v) => setTask({ ...task, enabled: v })} help="Typing or page turns while tools run; stops the instant the agent speaks.">
        <Field label="Sound">
          <Segmented size="sm" value={task.sound} onChange={(v) => setTask({ ...task, sound: v })} options={[{ value: "typing", label: "Typing" }, { value: "page-turn", label: "Page turn" }]} />
        </Field>
        <Slider label="Volume" value={task.volume} min={0.05} max={0.6} step={0.01} defaultValue={0.35} onChange={(v) => setTask({ ...task, volume: v })} />
        <Slider label="Start after" unit="ms" value={task.startAfterMs} min={0} max={5000} step={50} defaultValue={800} onChange={(v) => setTask({ ...task, startAfterMs: v })} />
      </SubBlock>

      <SubBlock title="Acknowledgements" enabled={ack.enabled} onToggle={(v) => setAck({ ...ack, enabled: v })} help="Short 'hmm' in the agent's voice while you talk at length. Never appears in transcripts.">
        <Field label="Words" hint="Comma-separated.">
          <TextInput value={ack.words} onChange={(e) => setAck({ ...ack, words: e.target.value })} />
        </Field>
        <Field label="Order">
          <Segmented size="sm" value={ack.wordOrder} onChange={(v) => setAck({ ...ack, wordOrder: v })} options={ORDER_OPTIONS} />
        </Field>
        <Slider label="Volume" value={ack.volume} min={0.1} max={1.5} step={0.05} defaultValue={1} onChange={(v) => setAck({ ...ack, volume: v })} />
        <Slider label="Every" unit="s" help="Seconds of continuous caller speech per roll." value={ack.thresholdS} min={2} max={15} step={0.5} defaultValue={3} onChange={(v) => setAck({ ...ack, thresholdS: v })} />
        <Slider label="Probability" value={ack.probability} min={0.05} max={1} step={0.05} defaultValue={0.8} onChange={(v) => setAck({ ...ack, probability: v })} />
      </SubBlock>

      <SubBlock title="Filler words" enabled={fill.enabled} onToggle={(v) => setFill({ ...fill, enabled: v })} help="Speaks 'so…' / 'okay…' if the answer hasn't started after the threshold.">
        <Field label="Words" hint="Comma-separated.">
          <TextInput value={fill.words} onChange={(e) => setFill({ ...fill, words: e.target.value })} />
        </Field>
        <Field label="Order">
          <Segmented size="sm" value={fill.wordOrder} onChange={(v) => setFill({ ...fill, wordOrder: v })} options={ORDER_OPTIONS} />
        </Field>
        <Slider label="Threshold" unit="ms" value={fill.thresholdMs} min={100} max={3000} step={50} defaultValue={300} onChange={(v) => setFill({ ...fill, thresholdMs: v })} />
        <Slider label="Probability" value={fill.probability} min={0.05} max={1} step={0.05} defaultValue={0.75} onChange={(v) => setFill({ ...fill, probability: v })} />
      </SubBlock>
    </Section>
  );
}

function SubBlock({
  title,
  help,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  help: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-panel-2/60 p-3 ring-1 ring-line">
      <ToggleRow label={title} help={help} checked={enabled} onChange={onToggle} />
      {enabled && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
}
