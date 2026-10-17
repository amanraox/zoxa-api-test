"use client";

import { Copy, FilePlus2, Library, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { useDraft } from "@/components/editor/DraftContext";
import { Badge, Button, IconButton } from "@/components/ui/controls";
import { Menu } from "@/components/ui/Menu";
import { useFeedback } from "@/components/ui/feedback";
import { agentFromTemplate } from "@/lib/agents";
import { createDraft } from "@/lib/draft";
import { localAgents, type LocalAgent } from "@/lib/localAgents";
import { jsonEqual } from "@/lib/path";
import { createDefaultAgent } from "@/lib/zoxa/catalog";
import type { AgentTemplate } from "@/lib/zoxa/types";

import { AgentLibrary } from "./AgentLibrary";

/** Toolbar for the agent being edited. Agents are saved in this browser only. */
export function AgentBar({ busy }: { busy: boolean }) {
  const { draft, setDraft, dirty } = useDraft();
  const { toast, confirm } = useFeedback();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const loaded = draft.loaded;

  const adopt = (a: LocalAgent) =>
    setDraft((d) => ({
      ...d,
      mode: "inline",
      agent: a.config,
      extras: {},
      loaded: { uuid: a.id, updatedAt: a.updatedAt, config: a.config },
    }));

  const guardDiscard = async (action: string) => {
    const atRisk = loaded ? dirty : !jsonEqual(draft.agent, createDefaultAgent());
    if (!atRisk) return true;
    return confirm({
      title: "Discard unsaved changes?",
      body: `Your edits to “${draft.agent.name || "this agent"}” aren't saved. ${action} will replace them.`,
      confirmLabel: "Discard",
      danger: true,
    });
  };

  /** Run a local-store write, surfacing storage errors (e.g. quota) as a toast. */
  const attempt = (fn: () => void, failTitle: string) => {
    try {
      fn();
    } catch (e) {
      toast("err", failTitle, e instanceof Error ? e.message : String(e));
    }
  };

  const loadAgent = async (id: string) => {
    const agent = localAgents.get(id);
    if (!agent) return;
    if (loaded?.uuid !== id && !(await guardDiscard("Opening another agent"))) return;
    setLibraryOpen(false);
    adopt(agent);
  };

  const fromTemplate = async (t: AgentTemplate) => {
    if (!(await guardDiscard("Starting from a template"))) return;
    setLibraryOpen(false);
    setDraft((d) => ({ ...d, agent: agentFromTemplate(t, createDefaultAgent()), loaded: null, mode: "inline", extras: {} }));
    toast("info", `New agent from “${t.name}”`, "Not saved yet — press Save to keep it in this browser.");
  };

  const newAgent = async () => {
    if (!(await guardDiscard("A new agent"))) return;
    setDraft((d) => ({ ...createDraft(), callVariables: d.callVariables }));
  };

  const save = () =>
    attempt(() => {
      const a = loaded ? localAgents.update(loaded.uuid, draft.agent) : localAgents.create(draft.agent);
      adopt(a);
      toast("ok", loaded ? "Agent updated" : `Saved “${a.config.name || "Untitled agent"}”`);
    }, "Could not save agent");

  const saveAsNew = () =>
    attempt(() => {
      const a = localAgents.create({ ...draft.agent, name: `${draft.agent.name || "Untitled agent"} (copy)`.slice(0, 120) });
      adopt(a);
      toast("ok", `Saved as “${a.config.name}”`);
    }, "Could not save agent");

  const remove = async () => {
    if (!loaded) return;
    const ok = await confirm({
      title: "Delete this agent?",
      body: `“${loaded.config.name || "Untitled agent"}” will be removed from this browser. The editor keeps a copy until you leave it.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    attempt(() => {
      localAgents.remove(loaded.uuid);
      setDraft((d) => ({ ...d, loaded: null }));
      toast("ok", "Agent deleted");
    }, "Could not delete agent");
  };

  const status = !loaded ? (
    <Badge tone="info">not saved</Badge>
  ) : dirty ? (
    <Badge tone="warn">modified</Badge>
  ) : (
    <Badge tone="ok">saved</Badge>
  );

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-1.5 border-b border-line px-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold">{draft.agent.name || "Untitled agent"}</span>
            <span className="shrink-0">{status}</span>
          </div>
          <div className="truncate text-[10.5px] text-faint">{loaded ? "saved in this browser" : "unsaved draft"}</div>
        </div>
        <IconButton icon={Library} label="My agents" onClick={() => setLibraryOpen(true)} disabled={busy} />
        <IconButton icon={FilePlus2} label="New agent" onClick={() => void newAgent()} disabled={busy} />
        {loaded && (
          <Menu
            disabled={busy}
            items={[
              { label: "Save as new agent", icon: Copy, onSelect: saveAsNew },
              { label: "Delete agent", icon: Trash2, onSelect: () => void remove(), danger: true },
            ]}
          />
        )}
        <Button
          size="sm"
          variant={!loaded || dirty ? "accent" : "secondary"}
          icon={Save}
          onClick={save}
          disabled={busy || (!!loaded && !dirty)}
          className="shrink-0"
        >
          {loaded ? "Update" : "Save"}
        </Button>
      </div>
      <AgentLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        activeId={loaded?.uuid ?? null}
        onPick={(id) => void loadAgent(id)}
        onTemplate={(t) => void fromTemplate(t)}
      />
    </>
  );
}
