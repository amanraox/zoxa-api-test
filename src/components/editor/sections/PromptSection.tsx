"use client";

import { Braces, ScrollText } from "lucide-react";
import { useMemo } from "react";

import { Badge, Field, KeyValueEditor, Note, Section, TextArea, TextInput } from "@/components/ui/controls";
import { useAgentField, useDraft } from "@/components/editor/DraftContext";
import { SYSTEM_VARIABLES, extractVariables, isSystemVariable, normalizeVariable } from "@/lib/zoxa/catalog";

export function PromptSection() {
  const [prompt, setPrompt] = useAgentField<string>(["systemPrompt"]);
  return (
    <Section
      id="sec-prompt"
      title="System prompt"
      icon={ScrollText}
      defaultOpen
      summary={prompt ? `${prompt.length.toLocaleString()} chars` : "Empty"}
    >
      <Field hint="Use {{variable}} placeholders — they are filled from the values below at call time.">
        <TextArea
          value={prompt}
          minRows={8}
          maxRows={30}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="You are a helpful voice agent for…"
          className="text-[13px]"
        />
      </Field>
    </Section>
  );
}

/**
 * Variables: what the prompt/greeting reference, the agent's SAVED defaults
 * (agent.contextVariables) and THIS CALL's values (request contextVariables).
 * Precedence at call time: built-ins > call value (non-blank) > saved default.
 */
export function VariablesSection() {
  const { draft, setDraft } = useDraft();
  const [saved, setSaved] = useAgentField<Record<string, string>>(["contextVariables"]);
  const agent = draft.agent;

  const referenced = useMemo(() => {
    const texts = [
      agent.systemPrompt ?? "",
      ...(agent.greeting?.firstMessages ?? []),
      ...(agent.userIdleMessages ?? []),
    ];
    return extractVariables(texts.join("\n"));
  }, [agent.systemPrompt, agent.greeting?.firstMessages, agent.userIdleMessages]);

  const custom = referenced.filter((v) => !isSystemVariable(v));
  const lookup = (map: Record<string, string> | undefined, name: string) => {
    const key = Object.keys(map ?? {}).find((k) => normalizeVariable(k) === normalizeVariable(name));
    return key === undefined ? undefined : map![key];
  };
  const setCall = (vars: Record<string, string>) => setDraft((d) => ({ ...d, callVariables: vars }));
  const setCallVar = (name: string, value: string) => {
    const existing = Object.keys(draft.callVariables).find((k) => normalizeVariable(k) === normalizeVariable(name)) ?? name;
    setCall({ ...draft.callVariables, [existing]: value });
  };
  const setSavedVar = (name: string, value: string) => {
    const existing = Object.keys(saved ?? {}).find((k) => normalizeVariable(k) === normalizeVariable(name)) ?? name;
    setSaved({ ...(saved ?? {}), [existing]: value });
  };

  return (
    <Section
      id="sec-variables"
      title="Variables"
      icon={Braces}
      summary={`${custom.length} referenced · ${Object.keys(draft.callVariables).length} set for this call`}
    >
      <Note>
        Resolution order: <b>built-ins</b> always win → <b>this call</b> (non-blank) → <b>saved default</b> on the agent.
        Built-ins: {SYSTEM_VARIABLES.map((v) => `{{${v}}}`).join(" ")}
      </Note>

      {custom.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-1 font-mono text-[10px] tracking-wider text-faint uppercase">
            <span>Variable</span>
            <span>Saved default</span>
            <span>This call</span>
          </div>
          {custom.map((name) => {
            const callVal = lookup(draft.callVariables, name);
            const savedVal = lookup(saved, name);
            const unresolved = !callVal?.trim() && savedVal === undefined;
            return (
              <div key={name} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <code className="truncate font-mono text-[12px] text-fg">{`{{${name}}}`}</code>
                  {unresolved && <Badge tone="warn">unset</Badge>}
                </span>
                <TextInput value={savedVal ?? ""} placeholder="—" onChange={(e) => setSavedVar(name, e.target.value)} />
                <TextInput value={callVal ?? ""} placeholder="—" onChange={(e) => setCallVar(name, e.target.value)} />
              </div>
            );
          })}
        </div>
      )}

      <Field
        label="All saved defaults"
        help="agent.contextVariables — stored with the agent. Built-in names are stripped by the server."
      >
        <KeyValueEditor
          value={saved ?? {}}
          onChange={setSaved}
          addLabel="Add default"
          keyHint={(k) => (k && isSystemVariable(k) ? "Built-in — the server drops this key" : null)}
        />
      </Field>
      <Field label="All call-time values" help="contextVariables on the POST /call body (inline and saved-agent calls).">
        <KeyValueEditor value={draft.callVariables} onChange={setCall} addLabel="Add call value" />
      </Field>
    </Section>
  );
}
