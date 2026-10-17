"use client";

import { ArrowDown, ArrowUp, Fingerprint, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Field, IconButton, Section, Select, TextArea, TextInput } from "@/components/ui/controls";
import { useAgentField } from "@/components/editor/DraftContext";
import { LANGUAGES, languageName } from "@/lib/zoxa/catalog";

function timezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["Asia/Kolkata", "UTC", "America/New_York", "Europe/London"];
  }
}

export function IdentitySection() {
  const [name, setName] = useAgentField<string>(["name"]);
  const [description, setDescription] = useAgentField<string>(["description"]);
  const [languages, setLanguages] = useAgentField<string[]>(["languages"]);
  const [timezone, setTimezone] = useAgentField<string>(["timezone"]);
  const [adding, setAdding] = useState("");
  const zones = useMemo(() => timezones(), []);
  const tzOptions = useMemo(
    () => (zones.includes(timezone) ? zones : [timezone, ...zones]).map((z) => ({ value: z, label: z })),
    [zones, timezone],
  );

  const langs = languages ?? [];
  const move = (i: number, dir: -1 | 1) => {
    const next = [...langs];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setLanguages(next);
  };
  const available = LANGUAGES.filter((l) => !langs.includes(l.id));

  return (
    <Section
      id="sec-identity"
      title="Identity"
      icon={Fingerprint}
      defaultOpen
      summary={`${name || "Unnamed"} · ${langs.map(languageName).join(", ") || "English"} · ${timezone}`}
    >
      <Field label="Agent name" hint="Required, up to 120 characters. Shown in call history and the dashboard.">
        <TextInput value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Support agent" />
      </Field>
      <Field label="Description">
        <TextArea value={description} minRows={1} maxRows={4} onChange={(e) => setDescription(e.target.value)} placeholder="Internal note about this agent" />
      </Field>

      <Field
        label="Languages"
        help="Order is priority: the first language is the primary. Every language must be supported by the chosen transcriber and voice model."
      >
        <div className="space-y-1.5">
          {langs.map((id, i) => (
            <div key={id} className="flex items-center gap-2 rounded-lg bg-input px-2.5 py-1.5 ring-1 ring-line">
              <span className="w-12 font-mono text-[10.5px] text-faint">{i === 0 ? "PRIMARY" : `#${i + 1}`}</span>
              <span className="flex-1 text-[13px]">{languageName(id)}</span>
              <span className="font-mono text-[11px] text-faint">{id}</span>
              <IconButton icon={ArrowUp} label="Move up" size={13} className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon={ArrowDown} label="Move down" size={13} className="h-6 w-6" disabled={i === langs.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon={X} label="Remove" size={13} className="h-6 w-6" disabled={langs.length === 1} onClick={() => setLanguages(langs.filter((l) => l !== id))} />
            </div>
          ))}
          {available.length > 0 && (
            <div className="flex gap-1.5">
              <Select
                value={adding}
                onChange={setAdding}
                className="flex-1"
                options={[{ value: "", label: "Add a language…" }, ...available.map((l) => ({ value: l.id, label: `${l.name} (${l.id})` }))]}
              />
              <IconButton
                icon={Plus}
                label="Add language"
                disabled={!adding}
                onClick={() => {
                  setLanguages([...langs, adding]);
                  setAdding("");
                }}
                className="h-9 w-9 ring-1 ring-line"
              />
            </div>
          )}
        </div>
      </Field>

      <Field label="Timezone" help="Drives {{current_time}}, {{current_date}}, {{current_day}} and {{current_timezone}} at call time.">
        <Select value={timezone} onChange={setTimezone} options={tzOptions} />
      </Field>
    </Section>
  );
}
