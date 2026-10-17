"use client";

import { MessageCircle } from "lucide-react";

import { Field, MessageList, Section, Segmented, Slider, ToggleRow } from "@/components/ui/controls";
import { useAgentField } from "@/components/editor/DraftContext";
import type { GreetingConfig } from "@/lib/zoxa/types";

export function GreetingSection() {
  const [g, setG] = useAgentField<GreetingConfig>(["greeting"]);
  const set = (patch: Partial<GreetingConfig>) => setG({ ...g, ...patch });
  const firsts = g.firstMessages ?? [];

  return (
    <Section
      id="sec-greeting"
      title="Greeting"
      icon={MessageCircle}
      summary={`${g.speakFirst === "agent" ? "Agent" : "Caller"} speaks first · ${firsts.length ? `${firsts.length} opener${firsts.length > 1 ? "s" : ""}` : "LLM improvises"}`}
    >
      <Field label="Who speaks first">
        <Segmented
          value={g.speakFirst}
          onChange={(v) => set({ speakFirst: v })}
          options={[
            { value: "agent", label: "Agent" },
            { value: "user", label: "Caller" },
          ]}
        />
      </Field>

      <Field
        label="Opening lines"
        help="One is picked at random each call. Leave empty to let the LLM improvise the opener. Up to 5."
      >
        <MessageList
          values={firsts}
          onChange={(v) => set({ firstMessages: v })}
          placeholder="Hi {{customer_name}}, thanks for calling…"
          emptyHint="No openers — the LLM will improvise."
        />
      </Field>

      <ToggleRow
        label="Opener can be interrupted"
        help="When off, the caller cannot barge in over the first message."
        checked={g.interruptible}
        onChange={(v) => set({ interruptible: v })}
      />

      {g.speakFirst === "agent" ? (
        <Slider
          label="Delay before speaking"
          unit="s"
          value={g.agentDelayS}
          min={0}
          max={4}
          step={0.1}
          defaultValue={0}
          onChange={(v) => set({ agentDelayS: v })}
        />
      ) : (
        <Slider
          label="Wait for caller"
          help="If the caller stays silent this long, the agent speaks first anyway."
          unit="s"
          value={g.userTimeoutS}
          min={1}
          max={5}
          step={0.1}
          defaultValue={3}
          onChange={(v) => set({ userTimeoutS: v })}
        />
      )}
    </Section>
  );
}
