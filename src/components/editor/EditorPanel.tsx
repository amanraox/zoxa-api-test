"use client";

import { Braces, ListChecks, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { AgentBar } from "@/components/agents/AgentBar";
import { Boundary } from "@/components/ui/Boundary";
import { Tabs } from "@/components/ui/controls";
import { useModels } from "@/hooks/useCatalog";
import { validateAgent } from "@/lib/zoxa/validate";

import { useDraft } from "./DraftContext";
import { RawEditor } from "./RawEditor";
import { ResolvedView } from "./ResolvedView";
import { HumanFeelSection, NoiseSection } from "./sections/AudioSection";
import { CallRulesSection, WebhookSection } from "./sections/CallRulesSection";
import { GreetingSection } from "./sections/GreetingSection";
import { IdentitySection } from "./sections/IdentitySection";
import { ModelSection } from "./sections/ModelSection";
import { PromptSection, VariablesSection } from "./sections/PromptSection";
import { ToolsSection } from "./sections/ToolsSection";
import { TranscriberSection } from "./sections/TranscriberSection";
import { VoiceSection } from "./sections/VoiceSection";

const SECTIONS = [
  ["Identity", IdentitySection],
  ["System prompt", PromptSection],
  ["Variables", VariablesSection],
  ["Greeting", GreetingSection],
  ["Language model", ModelSection],
  ["Voice", VoiceSection],
  ["Transcriber", TranscriberSection],
  ["Tools", ToolsSection],
  ["Call rules", CallRulesSection],
  ["Noise gate", NoiseSection],
  ["Human feel", HumanFeelSection],
  ["Webhook", WebhookSection],
] as const;

export function EditorPanel({ busy }: { busy: boolean }) {
  const { draft } = useDraft();
  const [tab, setTab] = useState<"form" | "raw" | "resolved">("form");
  const models = useModels();
  const issues = useMemo(() => validateAgent(draft.agent, models.data), [draft.agent, models.data]);
  const errorCount = issues.filter((i) => i.level === "error").length;

  return (
    <aside className="relative flex min-h-0 min-w-0 flex-1 flex-col border-line bg-bg lg:border-r">
      <AgentBar busy={busy} />
      <div className="@container flex min-w-0 items-center gap-2 border-b border-line px-4 py-2">
        <Tabs
          className="@max-[340px]:[&_button]:px-2 @max-[340px]:[&_svg]:hidden"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "form", label: <><SlidersHorizontal size={13} /> Form</> },
            { value: "raw", label: <><Braces size={13} /> Raw request</> },
            {
              value: "resolved",
              label: (
                <>
                  <ListChecks size={13} /> Validate
                  {errorCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-err" />}
                </>
              ),
            },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "form" && (
          <div className="space-y-2.5 p-4">
            {SECTIONS.map(([label, Comp]) => (
              <Boundary key={label} label={label} resetKey={draft.agent}>
                <Comp />
              </Boundary>
            ))}
          </div>
        )}
        {tab === "raw" && (
          <div className="h-full p-4">
            <RawEditor />
          </div>
        )}
        {tab === "resolved" && (
          <div className="p-4">
            <ResolvedView issues={issues} />
          </div>
        )}
      </div>
    </aside>
  );
}
