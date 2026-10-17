"use client";

import { Download, LayoutTemplate, Library, Loader2, Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Badge, Button, IconButton, Tabs, TextInput } from "@/components/ui/controls";
import { useFeedback } from "@/components/ui/feedback";
import { useTemplates } from "@/hooks/useCatalog";
import { localAgents } from "@/lib/localAgents";
import { providerLabel } from "@/lib/zoxa/catalog";
import type { AgentTemplate } from "@/lib/zoxa/types";
import { cn } from "@/lib/utils";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/** Drawer over the editor: this browser's agents, templates, export/import. */
export function AgentLibrary({
  open,
  onClose,
  activeId,
  onPick,
  onTemplate,
}: {
  open: boolean;
  onClose: () => void;
  activeId: string | null;
  onPick: (id: string) => void;
  onTemplate: (t: AgentTemplate) => void;
}) {
  const [tab, setTab] = useState<"agents" | "templates">("agents");
  const [query, setQuery] = useState("");
  const agents = useSyncExternalStore(localAgents.subscribe, localAgents.getSnapshot, localAgents.getServerSnapshot);
  const templates = useTemplates(open && tab === "templates");
  const { toast } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? agents.filter((a) => a.config.name?.toLowerCase().includes(q) || a.config.description?.toLowerCase().includes(q))
      : agents;
  }, [agents, query]);

  const exportAll = () => {
    const blob = new Blob([localAgents.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zoxa-console-agents-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importFile = async (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) {
      toast("err", "File too large", "Agent exports are small JSON files.");
      return;
    }
    try {
      const added = localAgents.importJson(await file.text());
      toast("ok", `Imported ${added} agent${added === 1 ? "" : "s"}`);
    } catch (e) {
      toast("err", "Import failed", e instanceof Error ? e.message : String(e));
    }
  };

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg/95 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "agents", label: <><Library size={13} /> My agents</>, count: agents.length },
            { value: "templates", label: <><LayoutTemplate size={13} /> Templates</> },
          ]}
        />
        <IconButton icon={X} label="Close library" className="ml-auto" onClick={onClose} />
      </div>

      {tab === "agents" ? (
        <>
          <div className="flex gap-1.5 px-4 pt-3">
            <div className="relative flex-1">
              <Search size={13} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents" className="pl-8" autoFocus />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
            {filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onPick(a.id)}
                className={cn(
                  "w-full rounded-xl p-3 text-left ring-1 transition-colors",
                  a.id === activeId ? "bg-accent/8 ring-accent/50" : "bg-panel ring-line hover:ring-line-strong",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13.5px] font-medium">{a.config.name || "Untitled agent"}</span>
                  {a.id === activeId && <Badge tone="accent">open</Badge>}
                  <span className="ml-auto shrink-0 font-mono text-[10.5px] text-faint">{ago(a.updatedAt)}</span>
                </div>
                {a.config.description && <p className="mt-0.5 truncate text-[12px] text-muted">{a.config.description}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {a.config.llm?.model && <Badge>{a.config.llm.model}</Badge>}
                  {a.config.tts?.provider && <Badge>{providerLabel(a.config.tts.provider)}</Badge>}
                  {a.config.stt?.provider && <Badge>{providerLabel(a.config.stt.provider)}</Badge>}
                  {!!a.config.languages?.length && <Badge>{a.config.languages.join("·")}</Badge>}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-[12.5px] text-faint">
                {query ? "No agent matches." : "No saved agents yet — build one and press Save."}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-line px-4 py-3">
            <p className="mr-auto text-[11px] leading-snug text-faint">Saved in this browser only.</p>
            <Button size="sm" variant="ghost" icon={Upload} onClick={() => fileRef.current?.click()}>
              Import
            </Button>
            <Button size="sm" variant="secondary" icon={Download} onClick={exportAll} disabled={!agents.length}>
              Export
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void importFile(file);
              }}
            />
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
          {templates.loading && (
            <div className="flex justify-center py-3 text-faint">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
          {!!templates.error && <p className="text-[12px] text-err">Could not load templates.</p>}
          {templates.data?.map((t) => (
            <button key={t.slug} type="button" onClick={() => onTemplate(t)} className="w-full rounded-xl bg-panel p-3 text-left ring-1 ring-line hover:ring-line-strong">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-medium">{t.name}</span>
                <Badge className="ml-auto">{t.category}</Badge>
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">{t.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
