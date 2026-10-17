"use client";

import { BrainCircuit } from "lucide-react";

import { ModelSelect } from "@/components/editor/ModelSelect";
import { Field, Note, Section, Slider, ToggleRow } from "@/components/ui/controls";
import { useAgentField } from "@/components/editor/DraftContext";
import { useModels } from "@/hooks/useCatalog";
import { providerLabel, temperatureApplies } from "@/lib/zoxa/catalog";
import type { LLMConfig, LLMProvider } from "@/lib/zoxa/types";

export function ModelSection() {
  const [llm, setLlm] = useAgentField<LLMConfig>(["llm"]);
  const models = useModels();
  const set = (patch: Partial<LLMConfig>) => setLlm({ ...llm, ...patch });
  const tMax = llm.provider === "anthropic" ? 1 : 2;
  const showTemp = temperatureApplies(llm.provider, llm.model);

  return (
    <Section
      id="sec-model"
      title="Language model"
      icon={BrainCircuit}
      summary={`${providerLabel(llm.provider)} · ${llm.model || "no model"} · t=${llm.temperature} · ${llm.maxTokens} tok`}
    >
      <Field label="Model">
        <ModelSelect
          type="llm"
          models={models.data}
          loading={models.loading}
          error={models.error}
          onRetry={models.reload}
          provider={llm.provider}
          model={llm.model}
          languages={[]}
          onChange={(provider, model) =>
            set({
              provider: provider as LLMProvider,
              model,
              ...(provider === "anthropic" ? { temperature: Math.min(llm.temperature, 1) } : {}),
            })
          }
        />
      </Field>

      {showTemp ? (
        <Slider
          label="Temperature"
          help="Randomness of the reply — low is consistent, high is varied."
          value={Math.min(llm.temperature, tMax)}
          min={0}
          max={tMax}
          step={0.05}
          defaultValue={1}
          minLabel="0 focused"
          maxLabel={`${tMax} creative`}
          onChange={(v) => set({ temperature: v })}
        />
      ) : (
        <Note>This model ignores temperature — zoxa never sends it.</Note>
      )}
      {llm.provider === "anthropic" && <Note>Anthropic accepts temperature 0–1; higher values are clamped on save.</Note>}

      <Slider
        label="Max output tokens"
        help="Hard cap on reply length. Too low cuts the agent off mid-sentence."
        value={llm.maxTokens}
        min={1}
        max={4096}
        step={1}
        defaultValue={251}
        onChange={(v) => set({ maxTokens: Math.round(v) })}
      />

      <ToggleRow
        label="Prewarm"
        help="Sends a tiny request at call start so the first real turn skips the provider's cold start."
        checked={llm.prewarm}
        onChange={(v) => set({ prewarm: v })}
      />
    </Section>
  );
}
