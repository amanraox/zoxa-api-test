"use client";

import { Check, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  Field,
  IconButton,
  KeyValueEditor,
  MessageList,
  Note,
  Segmented,
  Select,
  Slider,
  TextArea,
  TextInput,
  ToggleRow,
} from "@/components/ui/controls";
import { zoxa } from "@/lib/zoxa/client";
import type {
  EndCallTool,
  FunctionTool,
  HttpMethod,
  InlineTool,
  KbDocument,
  KnowledgeBaseEntry,
  MessagesOrder,
  QueryTool,
  TestTool,
  TransferCallTool,
} from "@/lib/zoxa/types";
import { cn } from "@/lib/utils";

import { ParamsEditor } from "./ParamsEditor";

type Editor<T extends InlineTool> = { tool: T; onChange: (t: T) => void };

export function ToolBasics<T extends InlineTool>({ tool, onChange, descriptionHelp }: Editor<T> & { descriptionHelp: string }) {
  return (
    <>
      <Field label="Name" hint="1–64 chars: letters, digits, _ or -. This is the function name the LLM sees.">
        <TextInput mono value={tool.name ?? ""} maxLength={64} onChange={(e) => onChange({ ...tool, name: e.target.value })} />
      </Field>
      <Field label="When to use it" help={descriptionHelp}>
        <TextArea value={tool.description ?? ""} minRows={2} maxRows={8} onChange={(e) => onChange({ ...tool, description: e.target.value })} />
      </Field>
    </>
  );
}

function SpokenMessages({
  messages,
  order,
  onChange,
  label = "Say before running",
}: {
  messages: string[];
  order: MessagesOrder;
  onChange: (messages: string[], order: MessagesOrder) => void;
  label?: string;
}) {
  return (
    <Field
      label={label}
      help="One line is spoken per invocation while the tool runs. Empty = silent."
      right={
        messages.length > 1 && (
          <Segmented
            size="sm"
            value={order}
            onChange={(o) => onChange(messages, o)}
            options={[
              { value: "random", label: "Random" },
              { value: "in-order", label: "In order" },
            ]}
          />
        )
      }
    >
      <MessageList values={messages} onChange={(m) => onChange(m, order)} placeholder="One moment, let me check…" emptyHint="Silent" />
    </Field>
  );
}

export function FunctionToolEditor({ tool, onChange }: Editor<FunctionTool>) {
  const c = tool.config;
  const server = c.server;
  const setConfig = (p: Partial<FunctionTool["config"]>) => onChange({ ...tool, config: { ...c, ...p } });
  const setServer = (p: Partial<FunctionTool["config"]["server"]>) => setConfig({ server: { ...server, ...p } });
  return (
    <>
      <ToolBasics tool={tool} onChange={onChange} descriptionHelp="The LLM decides to call the tool from this description." />
      <Field label="Endpoint" hint="{{variables}} are allowed in the URL. Private and localhost addresses are rejected.">
        <div className="flex gap-1.5">
          <Select<HttpMethod>
            value={server.method}
            onChange={(m) => setServer({ method: m })}
            className="w-28 shrink-0"
            options={(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((m) => ({ value: m, label: m }))}
          />
          <TextInput mono value={server.url} onChange={(e) => setServer({ url: e.target.value })} placeholder="https://api.example.com/orders" />
        </div>
      </Field>
      <Field label="Headers">
        <KeyValueEditor
          value={server.headers ?? {}}
          onChange={(h) => setServer({ headers: Object.keys(h).length ? h : null })}
          keyPlaceholder="Authorization"
          valuePlaceholder="Bearer …"
          addLabel="Add header"
        />
      </Field>
      <Slider label="Timeout" unit="ms" value={server.timeout_ms ?? 10000} min={1000} max={30000} step={500} defaultValue={10000} onChange={(v) => setServer({ timeout_ms: v })} />
      <ParamsEditor value={c.parameters} onChange={(p) => setConfig({ parameters: p })} />
      <ToggleRow
        label="Run asynchronously"
        help="The agent keeps talking instead of waiting for the response."
        checked={!!c.async}
        onChange={(v) => setConfig({ async: v })}
      />
      <SpokenMessages
        messages={c.messages ?? []}
        order={c.messagesOrder ?? "random"}
        onChange={(messages, messagesOrder) => setConfig({ messages, messagesOrder })}
      />
    </>
  );
}

const DOC_PAGE = 100;

/** Pages KB documents on demand (orgs can hold thousands); filters what is loaded. */
function DocumentChooser({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [docs, setDocs] = useState<KbDocument[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  const loadPage = useCallback(async (offset: number) => {
    setLoading(true);
    setError(false);
    try {
      const res = await zoxa.listDocuments(DOC_PAGE, offset);
      setDocs((prev) => (offset === 0 ? res.documents : [...prev, ...res.documents]));
      setTotal(res.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial page fetch on mount
    void loadPage(0);
  }, [loadPage]);

  const q = query.trim().toLowerCase();
  const shown = q ? docs.filter((d) => d.filename.toLowerCase().includes(q) || d.document_uuid.startsWith(q)) : docs;
  const loaded = new Set(docs.map((d) => d.document_uuid));
  const notLoaded = selected.filter((id) => !loaded.has(id));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (error && !docs.length) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-err/8 px-3 py-2 text-[12px] text-err ring-1 ring-err/25">
        Could not load documents
        <IconButton icon={RefreshCw} label="Retry" size={13} className="h-6 w-6" onClick={() => void loadPage(0)} />
      </div>
    );
  }
  if (total === 0) return <Note>No documents in this organization — upload one in the dashboard&apos;s Knowledge Base.</Note>;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by filename" className="h-8 text-[12px]" />
        <span className="shrink-0 font-mono text-[10.5px] text-faint">
          {selected.length} selected · {docs.length}/{total ?? "…"}
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-lg ring-1 ring-line">
        {shown.map((d) => {
          const on = selected.includes(d.document_uuid);
          const ready = d.processing_status === "completed";
          return (
            <button
              key={d.document_uuid}
              type="button"
              onClick={() => toggle(d.document_uuid)}
              className={cn(
                "flex w-full items-center gap-2 border-b border-line px-3 py-1.5 text-left last:border-b-0",
                on ? "bg-accent/10" : "hover:bg-panel-2",
              )}
            >
              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded ring-1", on ? "bg-accent ring-accent" : "ring-line-strong")}>
                {on && <Check size={11} className="text-accent-fg" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{d.filename}</span>
              <span className={cn("shrink-0 font-mono text-[10px]", ready ? "text-faint" : "text-warn")}>
                {ready ? `${d.total_chunks} chunks` : d.processing_status}
              </span>
            </button>
          );
        })}
        {loading && <p className="px-3 py-2 text-[12px] text-faint">Loading documents…</p>}
        {!loading && total !== null && docs.length < total && (
          <button type="button" onClick={() => void loadPage(docs.length)} className="w-full px-3 py-2 text-[12px] text-muted hover:text-fg">
            Load more ({total - docs.length} remaining)
          </button>
        )}
        {!loading && shown.length === 0 && docs.length > 0 && <p className="px-3 py-2 text-[12px] text-faint">No loaded document matches.</p>}
      </div>
      {notLoaded.length > 0 && (
        <p className="text-[11.5px] break-all text-faint">
          Also selected (not in the loaded pages): {notLoaded.join(", ")}{" "}
          <button type="button" className="underline" onClick={() => onChange(selected.filter((id) => loaded.has(id)))}>
            remove
          </button>
        </p>
      )}
    </div>
  );
}

export function QueryToolEditor({ tool, onChange }: Editor<QueryTool>) {
  const c = tool.config;
  const setConfig = (p: Partial<QueryTool["config"]>) => onChange({ ...tool, config: { ...c, ...p } });
  const kbs = c.knowledgeBases ?? [];
  const setKb = (i: number, p: Partial<KnowledgeBaseEntry>) =>
    setConfig({ knowledgeBases: kbs.map((k, j) => (j === i ? { ...k, ...p } : k)) });
  return (
    <>
      <ToolBasics tool={tool} onChange={onChange} descriptionHelp="When the LLM should search these documents." />
      {kbs.map((kb, i) => (
        <div key={i} className="space-y-2 rounded-lg bg-panel-2/60 p-3 ring-1 ring-line">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-faint uppercase">Bucket {i + 1}</span>
            {kbs.length > 1 && (
              <button type="button" className="text-[11.5px] text-muted hover:text-err" onClick={() => setConfig({ knowledgeBases: kbs.filter((_, j) => j !== i) })}>
                Remove
              </button>
            )}
          </div>
          <TextInput value={kb.name} placeholder="Bucket name" onChange={(e) => setKb(i, { name: e.target.value })} />
          <TextInput value={kb.description} placeholder="What's inside (the LLM routes queries by this)" onChange={(e) => setKb(i, { description: e.target.value })} />
          <DocumentChooser selected={kb.documentIds ?? []} onChange={(documentIds) => setKb(i, { documentIds })} />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setConfig({ knowledgeBases: [...kbs, { name: "", description: "", documentIds: [] }] })}
        className="h-8 w-full rounded-lg border border-dashed border-line text-[12px] text-muted hover:border-line-strong hover:text-fg"
      >
        + Add bucket
      </button>
      <Slider label="Retrieval timeout" unit="s" value={c.timeout ?? 5} min={1} max={30} step={1} defaultValue={5} onChange={(v) => setConfig({ timeout: v })} />
      <SpokenMessages
        label="Say while searching"
        messages={c.messages ?? []}
        order={c.messagesOrder ?? "random"}
        onChange={(messages, messagesOrder) => setConfig({ messages, messagesOrder })}
      />
    </>
  );
}

export function EndCallToolEditor({ tool, onChange }: Editor<EndCallTool>) {
  const c = tool.config;
  const setConfig = (p: Partial<EndCallTool["config"]>) => onChange({ ...tool, config: { ...c, ...p } });
  return (
    <>
      <ToolBasics tool={tool} onChange={onChange} descriptionHelp="When the agent should hang up. Feeds the prompt's call-termination hint." />
      <Field label="Before hanging up">
        <Segmented
          value={c.messageType}
          onChange={(messageType) => setConfig({ messageType })}
          options={[
            { value: "custom", label: "Say a farewell" },
            { value: "audio", label: "Play audio" },
            { value: "none", label: "Default" },
          ]}
        />
      </Field>
      {c.messageType === "custom" && (
        <Field label="Farewell lines" help="One is picked at random.">
          <MessageList values={c.customMessages ?? []} onChange={(customMessages) => setConfig({ customMessages })} placeholder="Thanks for calling, goodbye!" />
        </Field>
      )}
      {c.messageType === "audio" && (
        <Field label="Audio recording id" hint="Id of an audio file uploaded in the dashboard.">
          <TextInput mono value={c.audioRecordingId ?? ""} onChange={(e) => setConfig({ audioRecordingId: e.target.value || null })} />
        </Field>
      )}
      {c.messageType === "none" && <Note>zoxa still says its built-in “Goodbye!” — there is no silent hang-up.</Note>}
    </>
  );
}

export function TransferToolEditor({ tool, onChange }: Editor<TransferCallTool>) {
  const c = tool.config;
  const setConfig = (p: Partial<TransferCallTool["config"]>) => onChange({ ...tool, config: { ...c, ...p } });
  return (
    <>
      <Note tone="warn">Transfers only work on phone calls. On this WebSocket call the agent will try and zoxa rejects it at runtime — useful to test that path.</Note>
      <ToolBasics tool={tool} onChange={onChange} descriptionHelp="When the agent should transfer the caller." />
      <Field label="Destination" hint="E.164 phone number or SIP URI.">
        <TextInput mono value={c.destination} onChange={(e) => setConfig({ destination: e.target.value })} placeholder="+15551234567" />
      </Field>
      <Field label="Say before transferring">
        <TextInput value={c.customMessage ?? ""} onChange={(e) => setConfig({ customMessage: e.target.value || null })} placeholder="Connecting you to a specialist now." />
      </Field>
      <Slider label="Ring timeout" unit="s" value={c.timeout ?? 30} min={5} max={300} step={5} defaultValue={30} onChange={(v) => setConfig({ timeout: v })} />
      <ToggleRow label="Record the transfer leg" checked={c.recordTransfer ?? true} onChange={(v) => setConfig({ recordTransfer: v })} />
    </>
  );
}

export function TestToolEditor({ tool, onChange }: Editor<TestTool>) {
  const c = tool.config;
  const setConfig = (p: Partial<TestTool["config"]>) => onChange({ ...tool, config: { ...c, ...p } });
  return (
    <>
      <ToolBasics tool={tool} onChange={onChange} descriptionHelp="The trigger condition — the LLM calls the tool when this matches." />
      <Slider label="Simulated delay" unit="s" value={c.delaySeconds} min={0.5} max={30} step={0.5} defaultValue={6} onChange={(v) => setConfig({ delaySeconds: v })} />
      <Field label="Outcome">
        <Segmented value={c.outcome} onChange={(outcome) => setConfig({ outcome })} options={[{ value: "success", label: "Success" }, { value: "failure", label: "Failure" }]} />
      </Field>
      <Field label={c.outcome === "success" ? "Result returned" : "Error detail"} hint="Blank uses a built-in message the LLM relays naturally.">
        <TextArea value={c.responseText} minRows={2} maxRows={8} onChange={(e) => setConfig({ responseText: e.target.value })} placeholder={c.outcome === "success" ? '{"available": true, "slot": "3pm"}' : "Booking system unavailable"} />
      </Field>
      <SpokenMessages
        messages={c.messages ?? []}
        order={c.messagesOrder ?? "random"}
        onChange={(messages, messagesOrder) => setConfig({ messages, messagesOrder })}
      />
    </>
  );
}
