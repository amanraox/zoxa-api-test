"use client";

import { Timer, Webhook } from "lucide-react";

import { Field, KeyValueEditor, MessageList, Note, Section, Segmented, Slider, TextInput, ToggleRow } from "@/components/ui/controls";
import { useAgentField } from "@/components/editor/DraftContext";
import type { WebhookConfig } from "@/lib/zoxa/types";

const safeHost = (url: string) => {
  try {
    return new URL(url).host || url;
  } catch {
    return url || "invalid URL";
  }
};

const fmtDuration = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;

export function CallRulesSection() {
  const [maxDur, setMaxDur] = useAgentField<number>(["maxCallDurationS"]);
  const [idleTimeout, setIdleTimeout] = useAgentField<number>(["userIdleTimeoutS"]);
  const [idleMessages, setIdleMessages] = useAgentField<string[]>(["userIdleMessages"]);
  const [idleRetries, setIdleRetries] = useAgentField<number>(["userIdleMaxRetries"]);
  const [voicemail, setVoicemail] = useAgentField<boolean>(["voicemailDetection"]);
  const [record, setRecord] = useAgentField<boolean | null>(["recordInProviderConsole"]);

  return (
    <Section
      id="sec-rules"
      title="Call rules"
      icon={Timer}
      summary={`max ${fmtDuration(maxDur)} · idle ${idleTimeout}s × ${idleRetries}`}
    >
      <Slider
        label="Max call duration"
        help="The agent ends the call gracefully at this limit. Multiples of 10 seconds."
        unit="s"
        value={maxDur}
        min={10}
        max={7200}
        step={10}
        defaultValue={610}
        hint={fmtDuration(maxDur)}
        onChange={setMaxDur}
      />
      <Slider label="Silence before re-engaging" unit="s" value={idleTimeout} min={3} max={25} step={1} defaultValue={7} onChange={setIdleTimeout} />
      <Field
        label="Re-engage lines"
        help="Retry N speaks line N. Retries past the end of the list say “Are you still there?”. Up to 5."
      >
        <MessageList values={idleMessages ?? []} onChange={setIdleMessages} placeholder="Are you still there?" addLabel="Add line" />
      </Field>
      <Slider label="Re-engage attempts before hanging up" value={idleRetries} min={1} max={5} step={1} defaultValue={2} onChange={setIdleRetries} />

      <ToggleRow label="Voicemail detection" help="Phone calls only — ends the call if an answering machine picks up." checked={voicemail} onChange={setVoicemail} />
      <Field label="Carrier recording" help="Telephony-only. Has no effect on WebSocket calls.">
        <Segmented
          size="sm"
          value={record === null ? "default" : record ? "on" : "off"}
          onChange={(v) => setRecord(v === "default" ? null : v === "on")}
          options={[
            { value: "default", label: "Platform default" },
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
        />
      </Field>
    </Section>
  );
}

export function WebhookSection() {
  const [webhook, setWebhook] = useAgentField<WebhookConfig | null>(["webhook"]);
  const [summarize, setSummarize] = useAgentField<boolean>(["enableSummarization"]);

  return (
    <Section
      id="sec-webhook"
      title="Webhook & analysis"
      icon={Webhook}
      summary={`${webhook ? safeHost(webhook.url) : "No webhook"} · summary ${summarize ? "on" : "off"}`}
    >
      <ToggleRow
        label="Send lifecycle webhooks"
        help="zoxa POSTs call.started / call.ended / call.completed to this URL."
        checked={webhook !== null}
        onChange={(v) => setWebhook(v ? { url: "https://", headers: null } : null)}
      />
      {webhook && (
        <>
          <Field label="URL">
            <TextInput mono value={webhook.url} onChange={(e) => setWebhook({ ...webhook, url: e.target.value })} placeholder="https://example.com/zoxa/webhook" />
          </Field>
          <Field label="Headers">
            <KeyValueEditor
              value={webhook.headers ?? {}}
              onChange={(h) => setWebhook({ ...webhook, headers: Object.keys(h).length ? h : null })}
              keyPlaceholder="Authorization"
              valuePlaceholder="Bearer …"
              addLabel="Add header"
            />
          </Field>
          <Note>The signing secret is write-only on saved agents and can&apos;t be read back through the API.</Note>
        </>
      )}
      <ToggleRow label="Post-call summary" help="Generate a call summary after the call ends (appears in the call report)." checked={summarize} onChange={setSummarize} />
    </Section>
  );
}
